import { getAllUsers, getGameState } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { SEASON_NAMES } from '@/lib/game-data'

export const runtime = 'edge'

export async function GET(req: Request) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)

    const users = await getAllUsers()
    const gs = await getGameState()
    return jsonResponse(true, {
      online: Math.min(users.length, 5 + Math.floor(Math.random() * 10)),
      newUsers: users.filter(u => (Date.now() - u.createdAt) < 86400000).length,
      trade: 1280 + Math.floor(Math.random() * 5000),
      season: SEASON_NAMES[gs.currentSeason],
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
