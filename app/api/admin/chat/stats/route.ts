import { NextRequest } from 'next/server'
import { getChatStats } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

// 聊天统计
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const stats = await getChatStats()
    return jsonResponse(true, stats)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
