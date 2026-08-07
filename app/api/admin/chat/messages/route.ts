import { NextRequest } from 'next/server'
import { getRecentMessagesAllChannels, getChatStats } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

// 获取最近消息（所有频道 / 指定频道）
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const url = new URL(req.url)
    const channel = url.searchParams.get('channel') || undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)

    const messages = await getRecentMessagesAllChannels(limit, channel || undefined)
    return jsonResponse(true, messages)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
