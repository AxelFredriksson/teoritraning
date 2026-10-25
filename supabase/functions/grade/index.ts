import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { GoogleGenAI } from 'npm:@google/genai'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { estimateCostSek } from '../_shared/cost.ts'
import { checkLimits, LIMITS } from '../_shared/limits.ts'
import { buildGradingPrompt, type GradableCard } from '../_shared/prompt.ts'
import { parseVerdict, VERDICT_JSON_SCHEMA, type GradeResult } from '../_shared/verdict.ts'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173').split(',').map((s) => s.trim())

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })

const PROVIDER_TIMEOUT_MS = 25_000

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

interface Usage {
  input_tokens: number
  output_tokens: number
}

async function gradeWithClaude(model: string, system: string, userText: string, image?: string): Promise<{ result: GradeResult; usage: Usage }> {
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY'), timeout: PROVIDER_TIMEOUT_MS, maxRetries: 1 })
  const content: Anthropic.ContentBlockParam[] = []
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } })
  content.push({ type: 'text', text: userText })
  const msg = await client.messages.create({
    model,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: VERDICT_JSON_SCHEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming)
  if (msg.stop_reason !== 'end_turn') throw new Error(`stop_reason ${msg.stop_reason}`)
  const text = msg.content.find((b) => b.type === 'text')
  const result = text && text.type === 'text' ? parseVerdict(JSON.parse(text.text)) : null
  if (!result) throw new Error('unparseable verdict')
  return { result, usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens } }
}

async function gradeWithGemini(model: string, system: string, userText: string, image?: string): Promise<{ result: GradeResult; usage: Usage }> {
  const ai = new GoogleGenAI({ apiKey: Deno.env.get('GEMINI_API_KEY')!, httpOptions: { timeout: PROVIDER_TIMEOUT_MS } })
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = []
  if (image) parts.push({ inlineData: { mimeType: 'image/jpeg', data: image } })
  parts.push({ text: userText })
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: { systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: VERDICT_JSON_SCHEMA },
  })
  const result = parseVerdict(JSON.parse(res.text ?? 'null'))
  if (!result) throw new Error('unparseable verdict')
  return { result, usage: { input_tokens: 0, output_tokens: 0 } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'method' })

  // 1. who is calling, and are they allowed?
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData } = await admin.auth.getUser(jwt)
  const user = userData?.user
  if (!user) return json(req, 401, { error: 'unauthenticated' })
  const { data: allowed } = await admin.from('allowed_users').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!allowed) return json(req, 403, { error: 'forbidden' })

  let body: { card_id?: string; text?: string; image_base64?: string }
  try {
    body = await req.json()
  } catch {
    return json(req, 400, { error: 'bad json' })
  }
  if (!body.card_id || (!body.text && !body.image_base64)) return json(req, 400, { error: 'missing fields' })
  const kind = body.image_base64 ? 'image' : 'text'

  // 2. limits: size here, counts atomically in the database (reserves a log row)
  const size = checkLimits({ hour: 0, day: 0, imageDay: 0 }, kind, {
    chars: body.text?.length,
    bytes: body.image_base64 ? Math.floor((body.image_base64.length * 3) / 4) : undefined,
  })
  if (!size.ok) return json(req, 429, { error: size.reason })
  const { data: reservation, error: resErr } = await admin.rpc('reserve_grading', {
    p_user: user.id,
    p_kind: kind,
    p_hour_max: LIMITS.perHour,
    p_day_max: LIMITS.perDay,
    p_image_max: LIMITS.imagesPerDay,
  })
  if (resErr || !reservation) return json(req, 502, { error: 'reservation failed' })
  if (reservation.reason) return json(req, 429, { error: reservation.reason })
  const logId: number = reservation.id
  const finish = (fields: Record<string, unknown>) => admin.from('grading_log').update(fields).eq('id', logId)

  // 3. card from the database, never from the client
  const { data: card } = await admin.from('cards').select('prompt_md, reference_answer_md, rubric_md').eq('id', body.card_id).maybeSingle()
  if (!card) {
    await finish({ provider: 'none', model: 'none' })
    return json(req, 404, { error: 'card' })
  }

  // 4. settings
  const { data: rows } = await admin.from('settings').select('key, value')
  const settings = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  const provider = settings.provider === 'gemini' ? 'gemini' : 'claude'
  const model: string | null =
    provider === 'gemini' ? settings.gemini_model : kind === 'image' ? settings.claude_image_model : settings.claude_text_model
  if (!model) {
    await finish({ provider, model: 'none' })
    return json(req, 502, { error: 'no model configured' })
  }

  // 5. grade
  const { system, userText } = buildGradingPrompt(card as GradableCard, { text: body.text, hasImage: kind === 'image' })
  try {
    const { result, usage } =
      provider === 'gemini'
        ? await gradeWithGemini(model, system, userText, body.image_base64)
        : await gradeWithClaude(model, system, userText, body.image_base64)
    await finish({ provider, model, ok: true, est_cost_sek: estimateCostSek(model, usage) })
    return json(req, 200, result)
  } catch (e) {
    await finish({ provider, model })
    console.error('grading failed', e)
    return json(req, 502, { error: 'provider error' })
  }
})
