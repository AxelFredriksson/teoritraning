import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Login } from '../../src/screens/Login'

function auth(allowed: boolean) {
  return {
    signInWithOtp: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    checkAllowed: vi.fn(async () => allowed),
  }
}

async function loginFlow(a: ReturnType<typeof auth>, onDone = vi.fn()) {
  render(<Login auth={a} onLoggedIn={onDone} />)
  await userEvent.type(screen.getByLabelText('E-post'), 'axel@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Skicka kod' }))
  await userEvent.type(await screen.findByLabelText('Kod från e-posten'), '123456')
  await userEvent.click(screen.getByRole('button', { name: 'Logga in' }))
  return onDone
}

test('login submits code via verifyOtp type email', async () => {
  const a = auth(true)
  const done = await loginFlow(a)
  expect(a.signInWithOtp).toHaveBeenCalledWith({ email: 'axel@example.com', options: { shouldCreateUser: false } })
  expect(a.verifyOtp).toHaveBeenCalledWith({ email: 'axel@example.com', token: '123456', type: 'email' })
  expect(done).toHaveBeenCalled()
})

test('login shows no-access message when allowed_users empty', async () => {
  const a = auth(false)
  const done = await loginFlow(a)
  expect(await screen.findByText('Kontot har inte åtkomst')).toBeInTheDocument()
  expect(a.signOut).toHaveBeenCalled()
  expect(done).not.toHaveBeenCalled()
})
