import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAdminApi } from './data/adminApi'
import { createApi, type CourseData } from './data/api'
import { loginAuth, supabase } from './lib/supabase'
import { Admin } from './screens/Admin'
import { CourseSelect } from './screens/CourseSelect'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Overview } from './screens/Overview'
import { Session } from './screens/Session'
import type { PickFilter } from './session/picker'

type Screen = { name: 'courses' } | { name: 'home' } | { name: 'session'; filter: PickFilter } | { name: 'overview' } | { name: 'admin' }

const COURSE_KEY = 'lastCourse'

function readLastCourse(): string | null {
  try {
    return localStorage.getItem(COURSE_KEY)
  } catch {
    return null
  }
}

export default function App() {
  const api = useMemo(() => createApi(supabase), [])
  const adminApi = useMemo(() => createAdminApi(supabase), [])
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [courseId, setCourseId] = useState<string | null>(readLastCourse)
  const [data, setData] = useState<CourseData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>(courseId ? { name: 'home' } : { name: 'courses' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session))
    return () => sub.subscription.unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    if (!courseId) return
    setError(null)
    try {
      setData(await api.loadCourse(courseId))
    } catch {
      setError('Kunde inte ladda kursen. Kontrollera nätverket.')
    }
  }, [api, courseId])

  useEffect(() => {
    if (!signedIn) return
    api.flushPending().finally(reload)
    api.isAdmin().then(setIsAdmin)
  }, [signedIn, api, reload])

  const listCourses = useCallback(() => api.listCourses(), [api])

  if (signedIn === null) return <main className="screen"><p className="muted">Laddar…</p></main>
  if (!signedIn) return <Login auth={loginAuth} onLoggedIn={() => setSignedIn(true)} />

  if (screen.name === 'courses' || !courseId) {
    return (
      <CourseSelect
        listCourses={listCourses}
        onPick={(id) => {
          try { localStorage.setItem(COURSE_KEY, id) } catch { /* ignore */ }
          setData(null)
          setCourseId(id)
          setScreen({ name: 'home' })
        }}
      />
    )
  }

  if (error) {
    return (
      <main className="screen">
        <p role="alert" className="alert">{error}</p>
        <button className="btn" onClick={reload}>Försök igen</button>
      </main>
    )
  }
  if (!data) return <main className="screen"><p className="muted">Laddar kursen…</p></main>

  if (screen.name === 'session') {
    return (
      <Session
        data={data}
        filter={screen.filter}
        api={api}
        onExit={() => {
          setScreen({ name: 'home' })
          reload()
        }}
      />
    )
  }

  if (screen.name === 'admin' && isAdmin) {
    return <Admin api={adminApi} onBack={() => { setScreen({ name: 'home' }); reload() }} />
  }

  if (screen.name === 'overview') {
    return <Overview data={data} onBack={() => setScreen({ name: 'home' })} onPractice={(filter) => setScreen({ name: 'session', filter })} />
  }

  return (
    <Home
      courseId={courseId}
      data={data}
      isAdmin={isAdmin}
      onStart={(filter) => setScreen({ name: 'session', filter })}
      onOverview={() => setScreen({ name: 'overview' })}
      onAdmin={() => setScreen({ name: 'admin' })}
      onSwitchCourse={() => setScreen({ name: 'courses' })}
    />
  )
}
