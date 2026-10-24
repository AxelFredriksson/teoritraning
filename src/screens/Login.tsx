import { useState, type FormEvent } from 'react'
import type { LoginAuth } from '../lib/supabase'

export function Login({ auth, onLoggedIn }: { auth: LoginAuth; onLoggedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } })
    setBusy(false)
    if (error) setMessage('Kunde inte skicka kod. Kontrollera adressen.')
    else setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    if (error) {
      setBusy(false)
      setMessage('Fel eller utgången kod.')
      return
    }
    if (!(await auth.checkAllowed())) {
      await auth.signOut()
      setBusy(false)
      setMessage('Kontot har inte åtkomst')
      return
    }
    onLoggedIn()
  }

  return (
    <main className="screen login">
      <h1>Teoriträning</h1>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="stack">
          <label htmlFor="email">E-post</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn primary" disabled={busy}>Skicka kod</button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <p className="muted">Vi har skickat en kod till {email}.</p>
          <label htmlFor="code">Kod från e-posten</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn primary" disabled={busy}>Logga in</button>
          <button type="button" className="btn ghost" onClick={() => setStep('email')}>Byt e-post</button>
        </form>
      )}
      {message && <p role="alert" className="alert">{message}</p>}
    </main>
  )
}
