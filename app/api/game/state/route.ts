import { ensureSeasonTick, getGameState, getAnnouncements } from '@/lib/server-store'
import { jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function GET() {
  try {
    await ensureSeasonTick()
    return jsonResponse(true, await getGameState())
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
