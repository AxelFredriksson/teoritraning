import type { Supa } from '../lib/supabase'
import type { CardRow, CardState, ConceptRow, GradeResult, Verdict } from '../types'

export interface Stats {
  points: number
  streak: number
  lastActive: string | null
}

export interface ReviewWrite {
  cardId: string
  verdict: Verdict
  source: 'ai' | 'mc' | 'self'
  state: CardState
  stats: Stats
}

export interface CourseData {
  concepts: ConceptRow[]
  cards: CardRow[]
  states: Map<string, CardState>
  stats: Stats
}

const PENDING = 'pendingReviews'

function readPending(): ReviewWrite[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING) ?? '[]')
  } catch {
    return []
  }
}

function writePending(list: ReviewWrite[]) {
  try {
    if (list.length) localStorage.setItem(PENDING, JSON.stringify(list))
    else localStorage.removeItem(PENDING)
  } catch {
    // storage unavailable: nothing more to do
  }
}

export function createApi(client: Supa) {
  async function userId(): Promise<string> {
    const { data } = await client.auth.getUser()
    if (!data.user) throw new Error('not signed in')
    return data.user.id
  }

  async function write(r: ReviewWrite): Promise<void> {
    const uid = await userId()
    const results = await Promise.all([
      client.from('card_state').upsert({ user_id: uid, card_id: r.cardId, fsrs: r.state.fsrs, due: r.state.due }),
      client.from('review_log').insert({ user_id: uid, card_id: r.cardId, verdict: r.verdict, source: r.source }),
      client.from('user_stats').upsert({ user_id: uid, points: r.stats.points, streak: r.stats.streak, last_active: r.stats.lastActive }),
    ])
    const failed = results.find((x) => x.error)
    if (failed) throw new Error(failed.error!.message)
  }

  return {
    async saveReview(r: ReviewWrite): Promise<void> {
      try {
        await write(r)
      } catch {
        writePending([...readPending(), r])
      }
    },

    async flushPending(): Promise<number> {
      const queue = readPending()
      const left: ReviewWrite[] = []
      let done = 0
      for (const r of queue) {
        try {
          await write(r)
          done++
        } catch {
          left.push(r)
        }
      }
      writePending(left)
      return done
    },

    async loadCourse(courseId: string): Promise<CourseData> {
      const uid = await userId()
      const [concepts, cards, states, stats] = await Promise.all([
        client.from('concepts').select('*').eq('course_id', courseId),
        client.from('cards').select('*').eq('course_id', courseId),
        client.from('card_state').select('card_id, fsrs, due').eq('user_id', uid),
        client.from('user_stats').select('*').eq('user_id', uid).maybeSingle(),
      ])
      const err = [concepts, cards, states, stats].find((x) => x.error)
      if (err) throw new Error(err.error!.message)
      return {
        concepts: concepts.data as ConceptRow[],
        cards: cards.data as CardRow[],
        states: new Map((states.data ?? []).map((s) => [s.card_id as string, { fsrs: s.fsrs, due: s.due } as CardState])),
        stats: stats.data
          ? { points: stats.data.points, streak: stats.data.streak, lastActive: stats.data.last_active }
          : { points: 0, streak: 0, lastActive: null },
      }
    },

    async listCourses(): Promise<{ id: string; name: string; archived: boolean }[]> {
      const { data, error } = await client.from('courses').select('*').order('id')
      if (error) throw new Error(error.message)
      return data
    },

    async reportCard(cardId: string, note: string): Promise<void> {
      const uid = await userId()
      const { error } = await client.from('card_reports').insert({ user_id: uid, card_id: cardId, note })
      if (error) throw new Error(error.message)
    },

    async getSettings(): Promise<Record<string, unknown>> {
      const { data, error } = await client.from('settings').select('key, value')
      if (error) throw new Error(error.message)
      return Object.fromEntries(data.map((r) => [r.key, r.value]))
    },

    async isAdmin(): Promise<boolean> {
      const { data } = await client.from('allowed_users').select('is_admin').maybeSingle()
      return !!data?.is_admin
    },

    async gradeOpen(cardId: string, input: { text?: string; imageBase64?: string }): Promise<GradeResult> {
      const { data, error } = await client.functions.invoke('grade', {
        body: { card_id: cardId, text: input.text, image_base64: input.imageBase64 },
      })
      if (error) throw error
      return data as GradeResult
    },
  }
}

export type Api = ReturnType<typeof createApi>
