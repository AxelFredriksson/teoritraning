import { useEffect, useState } from 'react'
import { stockholmDate } from '../game/points'
import { MathText } from '../math/MathText'
import type { CardRow } from '../types'

export type FlaggedCard = CardRow & { reports: string[] }
export interface LogRow {
  est_cost_sek: number
  created_at: string
  kind: 'text' | 'image'
}

export interface AdminApi {
  listFlagged(): Promise<FlaggedCard[]>
  setCardStatus(id: string, status: 'active' | 'rejected'): Promise<void>
  updateCard(id: string, patch: Pick<CardRow, 'prompt_md' | 'reference_answer_md' | 'rubric_md'>): Promise<void>
  getSettings(): Promise<Record<string, unknown>>
  setSetting(key: string, value: unknown): Promise<void>
  /** This calendar month's grading rows, all users. */
  gradingLog(): Promise<LogRow[]>
}

export const MONTHLY_CAP_SEK = 50

const monthKey = (d: Date) => stockholmDate(d).slice(0, 7)

export function sumThisMonth(rows: LogRow[], now: Date): number {
  const m = monthKey(now)
  return rows.filter((r) => monthKey(new Date(r.created_at)) === m).reduce((s, r) => s + Number(r.est_cost_sek), 0)
}

function FlaggedItem({ card, api, onDone }: { card: FlaggedCard; api: AdminApi; onDone: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ prompt_md: card.prompt_md, reference_answer_md: card.reference_answer_md, rubric_md: card.rubric_md })

  return (
    <div className="panel stack">
      <span className="muted">{card.id}</span>
      {card.verify_note && <p className="alert">Kontroll: {card.verify_note}</p>}
      {card.reports.map((r, i) => <p key={i} className="muted">Rapport: {r || '(ingen kommentar)'}</p>)}
      {editing ? (
        <>
          <label htmlFor={`p-${card.id}`}>Fråga</label>
          <textarea id={`p-${card.id}`} value={draft.prompt_md} onChange={(e) => setDraft({ ...draft, prompt_md: e.target.value })} />
          <label htmlFor={`a-${card.id}`}>Referenssvar</label>
          <textarea id={`a-${card.id}`} value={draft.reference_answer_md} onChange={(e) => setDraft({ ...draft, reference_answer_md: e.target.value })} />
          <label htmlFor={`r-${card.id}`}>Rättningsmall</label>
          <textarea id={`r-${card.id}`} value={draft.rubric_md ?? ''} onChange={(e) => setDraft({ ...draft, rubric_md: e.target.value || null })} />
          <div className="row">
            <button className="btn primary" onClick={async () => { await api.updateCard(card.id, draft); await api.setCardStatus(card.id, 'active'); onDone() }}>Spara och godkänn</button>
            <button className="btn ghost" onClick={() => setEditing(false)}>Avbryt</button>
          </div>
        </>
      ) : (
        <>
          <MathText md={card.prompt_md} />
          <div className="panel"><span className="muted">Referenssvar</span><MathText md={card.reference_answer_md} /></div>
          <div className="row">
            <button className="btn" onClick={async () => { await api.setCardStatus(card.id, 'active'); onDone() }}>Godkänn</button>
            <button className="btn" onClick={() => setEditing(true)}>Redigera</button>
            <button className="btn" onClick={async () => { await api.setCardStatus(card.id, 'rejected'); onDone() }}>Stryk</button>
          </div>
        </>
      )}
    </div>
  )
}

export function Admin({ api, onBack }: { api: AdminApi; onBack: () => void }) {
  const [flagged, setFlagged] = useState<FlaggedCard[] | null>(null)
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api.listFlagged().then(setFlagged, () => setError('Kunde inte hämta granskningskön.'))
    api.getSettings().then(setSettings, () => setError('Kunde inte hämta inställningar.'))
    api.gradingLog().then(setLog, () => {})
  }
  useEffect(load, [api])

  async function set(key: string, value: unknown) {
    setSettings((s) => ({ ...s, [key]: value }))
    try {
      await api.setSetting(key, value)
    } catch {
      setError('Kunde inte spara inställningen.')
    }
  }

  const now = new Date()
  const spent = sumThisMonth(log, now)
  const today = log.filter((r) => stockholmDate(new Date(r.created_at)) === stockholmDate(now))

  return (
    <main className="screen">
      <div className="row">
        <button className="btn" onClick={onBack}>‹ Tillbaka</button>
        <h1>Admin</h1>
      </div>
      {error && <p role="alert" className="alert">{error}</p>}

      <section className="stack">
        <h2>Kostnad</h2>
        <div className="panel stack">
          <span className="mono" style={{ fontSize: 24 }}>{spent.toFixed(2)} kr <span className="muted">av {MONTHLY_CAP_SEK} kr denna månad</span></span>
          <span className="muted">Idag: {today.length} rättningar (max 300), varav {today.filter((r) => r.kind === 'image').length} handskrift (max 40)</span>
        </div>
      </section>

      <section className="stack">
        <h2>Rättning</h2>
        {settings && (
          <div className="panel stack">
            <div className="row" role="radiogroup" aria-label="Leverantör">
              {(['claude', 'gemini'] as const).map((p) => (
                <label key={p} className="row" style={{ gap: 6 }}>
                  <input type="radio" name="provider" style={{ width: 'auto', minHeight: 0 }} checked={settings.provider === p} onChange={() => set('provider', p)} />
                  {p === 'claude' ? 'Claude' : 'Gemini'}
                </label>
              ))}
            </div>
            {(['claude_text_model', 'claude_image_model', 'gemini_model'] as const).map((k) => (
              <div key={k} className="stack" style={{ gap: 4 }}>
                <label htmlFor={k}>{k === 'claude_text_model' ? 'Claude, fritext' : k === 'claude_image_model' ? 'Claude, handskrift' : 'Gemini-modell'}</label>
                <input id={k} defaultValue={(settings[k] as string | null) ?? ''} onBlur={(e) => set(k, e.target.value.trim() || null)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <h2>Granskningskö {flagged ? `(${flagged.length})` : ''}</h2>
        {flagged?.length === 0 && <p className="muted">Inga flaggade kort.</p>}
        {flagged?.map((c) => <FlaggedItem key={c.id} card={c} api={api} onDone={load} />)}
      </section>
    </main>
  )
}
