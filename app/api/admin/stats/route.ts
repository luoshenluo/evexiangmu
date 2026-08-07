import { NextRequest } from 'next/server'
import { getUsers, getMessages, getAllListings, jsonResponse } from '@/lib/server-store'
import { authRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    if (!user.isAdmin) return jsonResponse(false, null, '无权限', 403)

    const users = await getUsers()
    const activeUsers = users.filter(u => u.id && !u.deleted && (Date.now() - (u.lastLogin||0) < 7*86400000)).length
    const messages = await getMessages('world', 1000)
    const listings = await getAllListings()

    return jsonResponse(true, {
      totalUsers: users.length,
      activeUsers,
      adminCount: users.filter(u => u.isAdmin && !u.deleted).length,
      mutedCount: users.filter(u => u.mutedUntil && u.mutedUntil > Date.now()).length,
      totalMessages: messages.length,
      totalListings: listings.length,
      totalCoinsInCirculation: users.reduce((s,u)=>s+(u.coins||0),0),
      recentMessages: messages.slice(-10).reverse(),
      refreshedAt: Date.now(),
    })
  } catch(e:any) {
    logger.error('system','获取后台统计失败',{error:e?.message})
    return jsonResponse(false,null,e?.message||'获取失败',500)
  }
}
