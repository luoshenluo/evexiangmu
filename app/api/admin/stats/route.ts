import { getAllUsers, getGameState, getListings, getBuyOrders, getMessages } from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'
import { SEASON_NAMES } from '@/lib/game-data'

export const runtime = 'edge'

export async function GET(req: Request) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)

    const [users, gs, listings, buyOrders, messages] = await Promise.all([
      getAllUsers(),
      getGameState(),
      getListings(),
      getBuyOrders(),
      getMessages('world', 1000),
    ])

    const now = Date.now()
    const todayStart = now - 24 * 60 * 60 * 1000

    const todayNewUsers = users.filter(u => u.createdAt > todayStart).length
    const todayMessages = messages.filter(m => m.timestamp > todayStart).length

    return jsonResponse(true, {
      totalUsers: users.length,
      todayNewUsers,
      onlineUsers: users.filter(u => now - u.lastLogin < 10 * 60 * 1000).length,
      todayMessages,
      totalListings: listings.length,
      totalBuyOrders: buyOrders.length,
      season: SEASON_NAMES[gs.currentSeason],
      seasonStartAt: gs.seasonStartAt,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
