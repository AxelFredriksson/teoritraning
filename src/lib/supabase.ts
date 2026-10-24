import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export type Supa = typeof supabase

/** The auth operations the login screen needs. */
export interface LoginAuth {
  signInWithOtp(args: { email: string; options: { shouldCreateUser: false } }): Promise<{ error: { message: string } | null }>
  verifyOtp(args: { email: string; token: string; type: 'email' }): Promise<{ error: { message: string } | null }>
  signOut(): Promise<unknown>
  checkAllowed(): Promise<boolean>
}

export const loginAuth: LoginAuth = {
  signInWithOtp: (args) => supabase.auth.signInWithOtp(args),
  verifyOtp: (args) => supabase.auth.verifyOtp(args),
  signOut: () => supabase.auth.signOut(),
  async checkAllowed() {
    const { data } = await supabase.from('allowed_users').select('user_id').limit(1)
    return !!data?.length
  },
}
