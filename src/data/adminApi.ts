import type { Supa } from '../lib/supabase'
import type { AdminApi, FlaggedCard, LogRow } from '../screens/Admin'
import type { CardRow } from '../types'

export function createAdminApi(client: Supa): AdminApi {
  const check = (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message)
  }
  return {
    async listFlagged() {
      const cards = await client.from('cards').select('*').eq('status', 'flagged')
      check(cards)
      const reports = await client.from('card_reports').select('card_id, note')
      check(reports)
      return (cards.data as CardRow[]).map(
        (c): FlaggedCard => ({ ...c, reports: (reports.data ?? []).filter((r) => r.card_id === c.id).map((r) => r.note ?? '') }),
      )
    },
    async setCardStatus(id, status) {
      check(await client.from('cards').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id))
    },
    async updateCard(id, patch) {
      // 'admin-edited' tells the kursbank uploader never to overwrite this text with the local card.
      check(await client.from('cards').update({ ...patch, content_hash: 'admin-edited', reviewed_at: new Date().toISOString() }).eq('id', id))
    },
    async getSettings() {
      const r = await client.from('settings').select('key, value')
      check(r)
      return Object.fromEntries((r.data ?? []).map((x) => [x.key, x.value]))
    },
    async setSetting(key, value) {
      check(await client.from('settings').update({ value }).eq('key', key))
    },
    async gradingLog() {
      const start = new Date()
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - 1) // margin for timezone; filtered precisely client-side
      const r = await client.from('grading_log').select('est_cost_sek, created_at, kind').gte('created_at', start.toISOString())
      check(r)
      return r.data as LogRow[]
    },
  }
}
