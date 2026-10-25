import { useEffect, useState } from 'react'

interface Course {
  id: string
  name: string
  archived: boolean
}

export function CourseSelect({ listCourses, onPick }: { listCourses: () => Promise<Course[]>; onPick: (id: string) => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCourses().then(setCourses, () => setError('Kunde inte hämta kurser.'))
  }, [listCourses])

  const visible = (courses ?? []).filter((c) => showArchived || !c.archived)

  return (
    <main className="screen">
      <h1>Välj kurs</h1>
      {error && <p role="alert" className="alert">{error}</p>}
      {!courses && !error && <p className="muted">Laddar…</p>}
      <div className="stack">
        {visible.map((c) => (
          <button key={c.id} className="row-btn" onClick={() => onPick(c.id)}>
            <span className="row-title">{c.id}</span>
            <span className="muted">{c.name}{c.archived ? ' · arkiverad' : ''}</span>
          </button>
        ))}
      </div>
      {courses?.some((c) => c.archived) && (
        <button className="btn ghost" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Dölj arkiverade' : 'Visa arkiverade'}
        </button>
      )}
    </main>
  )
}
