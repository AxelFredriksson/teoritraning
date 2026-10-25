import type { CourseData } from '../data/api'
import type { PickFilter } from '../session/picker'

export function Home({
  courseId,
  data,
  isAdmin,
  onStart,
  onOverview,
  onAdmin,
  onSwitchCourse,
}: {
  courseId: string
  data: CourseData
  isAdmin: boolean
  onStart: (filter: PickFilter) => void
  onOverview: () => void
  onAdmin: () => void
  onSwitchCourse: () => void
}) {
  const now = new Date()
  const active = data.cards.filter((c) => c.status === 'active')
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
        <button className="btn primary" onClick={() => onStart({})}>Fortsätt öva</button>
      </section>

      <section className="stack">
        <h2 className="muted" style={{ fontSize: 14 }}>Fokusera</h2>
        <div className="row">
          <button className="chip" onClick={() => onStart({ unseenOnly: true })}>Aldrig sedda</button>
          {lectures.map((l) => (
            <button key={l} className="chip" onClick={() => onStart({ lecture: l })}>F{l}</button>
          ))}
        </div>
      </section>

      <div className="spacer" />
      <button className="row-btn" onClick={onOverview}>
        <span className="row-title">Kursöversikt</span>
        <span className="muted">{data.concepts.length} begrepp · {active.length} kort</span>
      </button>
      {isAdmin && <button className="btn ghost" onClick={onAdmin}>Admin</button>}
    </main>
  )
}
