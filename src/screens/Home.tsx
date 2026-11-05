import { useState } from 'react'
import type { CourseData } from '../data/api'
import { LEVEL_SCOPES, readMaxLevel, saveMaxLevel } from '../game/levels'
import type { PickFilter } from '../session/picker'

export function Home({
  courseId,
  data,
  isAdmin,
  onStart,
  onOverview,
  onAdmin,
  onSwitchCourse,
  onSignOut,
}: {
  courseId: string
  data: CourseData
  isAdmin: boolean
  onStart: (filter: PickFilter) => void
  onOverview: () => void
  onAdmin: () => void
  onSwitchCourse: () => void
  onSignOut: () => void
}) {
  const [maxLevel, setMaxLevel] = useState(readMaxLevel)
  const now = new Date()
  const active = data.cards.filter((c) => c.status === 'active' && (c.level ?? 2) <= maxLevel)
  const due = active.filter((c) => data.states.has(c.id) && new Date(data.states.get(c.id)!.due) <= now).length
  const unseen = active.filter((c) => !data.states.has(c.id))
  const conceptById = new Map(data.concepts.map((k) => [k.id, k]))
  const rareUnseen = new Set(unseen.filter((c) => (conceptById.get(c.concept_id)?.exam_count ?? 0) <= 1).map((c) => c.concept_id)).size
  const lectures = [...new Set(data.concepts.map((k) => k.lecture))].sort((a, b) => a - b)

  return (
    <main className="screen">
      <div className="row">
        <div className="stack" style={{ gap: 2 }}>
          <span className="muted">{courseId}</span>
          <h1>Dags att plugga</h1>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={onSwitchCourse}>Byt kurs</button>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="panel stack" style={{ flex: 1, gap: 4, padding: 16 }}>
          <span className="muted">Streak</span>
          <span className="mono streak" style={{ fontSize: 30 }}>{data.stats.streak} <span className="muted">dagar</span></span>
        </div>
        <div className="panel stack" style={{ flex: 1, gap: 4, padding: 16 }}>
          <span className="muted">Poäng</span>
          <span className="mono points" style={{ fontSize: 30 }}>{data.stats.points}</span>
        </div>
      </div>

      <section className="hero">
        <span className="muted">Dags att repetera</span>
        <span style={{ fontSize: 22, fontWeight: 600 }}>{due} kort väntar · {unseen.length} nya</span>
        {rareUnseen > 0 && <span className="muted">Varav {rareUnseen} sällsynta begrepp du inte sett</span>}
        <button className="btn primary" onClick={() => onStart({ maxLevel })}>Fortsätt öva</button>
      </section>

      <section className="stack">
        <h2 className="muted" style={{ fontSize: 14 }}>Nivå</h2>
        <div className="row" role="radiogroup" aria-label="Nivå">
          {LEVEL_SCOPES.map((s) => (
            <label key={s.max} className={maxLevel === s.max ? 'chip on' : 'chip'} title={s.hint}>
              <input
                type="radio"
                name="level"
                className="sr-only"
                checked={maxLevel === s.max}
                onChange={() => {
                  setMaxLevel(s.max)
                  saveMaxLevel(s.max)
                }}
              />
              {s.label}
            </label>
          ))}
        </div>
        <span className="muted">{LEVEL_SCOPES.find((s) => s.max === maxLevel)?.hint}</span>
      </section>

      <section className="stack">
        <h2 className="muted" style={{ fontSize: 14 }}>Fokusera</h2>
        <div className="row">
          <button className="chip" onClick={() => onStart({ unseenOnly: true, maxLevel })}>Aldrig sedda</button>
          {lectures.map((l) => (
            <button key={l} className="chip" onClick={() => onStart({ lecture: l, maxLevel })}>F{l}</button>
          ))}
        </div>
      </section>

      <div className="spacer" />
      <button className="row-btn" onClick={onOverview}>
        <span className="row-title">Kursöversikt</span>
        <span className="muted">{data.concepts.length} begrepp · {active.length} kort</span>
      </button>
      <div className="row">
        {isAdmin && <button className="btn ghost" onClick={onAdmin}>Admin</button>}
        <span className="spacer" />
        <button className="btn ghost" onClick={onSignOut}>Logga ut</button>
      </div>
      <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>Version {new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "short" }).format(new Date(__APP_BUILD__))}</p>
    </main>
  )
}
