import type { Supa } from '../lib/supabase'
import type { CardRow, CardState, ConceptRow, GradeResult, Verdict } from '../types'

export interface Stats {
  points: number
  streak: number
  lastActive: string | null
}

export interface ReviewWrite {
  /** Client-generated id so a retried write never duplicates its review_log row. */
  clientId?: string
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

export const GRADE_TIMEOUT_MS = 30_000

let flushing: Promise<number> | null = null

export function createApi(client: Supa) {
  async function userId(): Promise<string> {
    const { data } = await client.auth.getUser()
    if (!data.user) throw new Error('not signed in')
    return data.user.id
  }

  async function write(r: ReviewWrite): Promise<void> {
    const uid = await userId()
    const results = await Promise.all([
      client.from('card_state').upsert({ user_id: uid, card_id: r.cardId, fsrs: r.state.fsrs, due: r.state.due, last_verdict: r.verdict }),
      client
        .from('review_log')
        .upsert({ client_id: r.clientId, user_id: uid, card_id: r.cardId, verdict: r.verdict, source: r.source }, { onConflict: 'client_id', ignoreDuplicates: true }),
      client.from('user_stats').upsert({ user_id: uid, points: r.stats.points, streak: r.stats.streak, last_active: r.stats.lastActive }),
    ])
    const failed = results.find((x) => x.error)
    if (failed) throw new Error(failed.error!.message)
  }

  return {
    /** Queues the review behind any earlier unsent ones, then flushes in order so newer data always lands last. */
    async saveReview(r: ReviewWrite): Promise<void> {
      writePending([...readPending(), { ...r, clientId: r.clientId ?? crypto.randomUUID() }])
      await this.flushPending()
    },

    /** Writes queued reviews oldest first and stops at the first failure, keeping it and everything after. */
    flushPending(): Promise<number> {
      if (flushing) return flushing.then(() => this.flushPending())
      flushing = (async () => {
        const queue = readPending()
        let done = 0
        for (const item of queue) {
          const withId = { ...item, clientId: item.clientId ?? crypto.randomUUID() }
          try {
            await write(withId)
            done++
          } catch {
            // re-read: reviews queued while this flush ran must survive
            writePending([withId, ...readPending().slice(done + 1)])
            return done
          }
        }
        writePending(readPending().slice(queue.length))
        return done
      })().finally(() => {
        flushing = null
      })
      return flushing
    },

    async loadCourse(courseId: string): Promise<CourseData> {
      const uid = await userId()
      const [concepts, cards, states, stats] = await Promise.all([
        client.from('concepts').select('*').eq('course_id', courseId),
        client.from('cards').select('*').eq('course_id', courseId),
        client.from('card_state').select('card_id, fsrs, due, last_verdict').eq('user_id', uid),
        client.from('user_stats').select('*').eq('user_id', uid).maybeSingle(),
      ])
      const err = [concepts, cards, states, stats].find((x) => x.error)
      if (err) throw new Error(err.error!.message)
      return {
        concepts: concepts.data as ConceptRow[],
        cards: cards.data as CardRow[],
        states: new Map((states.data ?? []).map((s) => [s.card_id as string, { fsrs: s.fsrs, due: s.due, lastVerdict: s.last_verdict ?? null } as CardState])),
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

    /** Wipes this user's repetition state and answer history for one course (points and streak are kept). */
    async resetCourse(courseId: string, cardIds: string[]): Promise<void> {
      const inCourse = new Set(cardIds)
      writePending(readPending().filter((r) => !inCourse.has(r.cardId)))
      const { error } = await client.rpc('reset_course_progress', { p_course: courseId })
      if (error) throw new Error(error.message)
    },

    /** Same as resetCourse, limited to the cards of one lecture. */
    async resetLecture(courseId: string, lecture: number, cardIds: string[]): Promise<void> {
      const inLecture = new Set(cardIds)
      writePending(readPending().filter((r) => !inLecture.has(r.cardId)))
      const { error } = await client.rpc('reset_lecture_progress', { p_course: courseId, p_lecture: lecture })
      if (error) throw new Error(error.message)
    },

    /** Same as resetCourse, limited to the cards of one concept. */
    async resetConcept(conceptId: string, cardIds: string[]): Promise<void> {
      const inConcept = new Set(cardIds)
      writePending(readPending().filter((r) => !inConcept.has(r.cardId)))
      const { error } = await client.rpc('reset_concept_progress', { p_concept: conceptId })
      if (error) throw new Error(error.message)
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

    async gradeOpen(cardId: string, input: { text?: string; imageBase64?: string; mode?: 'find_calc_error' }): Promise<GradeResult> {
      const { data, error } = await client.functions.invoke('grade', {
        body: { card_id: cardId, text: input.text, image_base64: input.imageBase64, mode: input.mode },
        timeout: GRADE_TIMEOUT_MS,
      })
      if (error) throw error
      return data as GradeResult
    },
  }
}

export type Api = ReturnType<typeof createApi>
