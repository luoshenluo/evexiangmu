import { NextRequest } from 'next/server'
import { authRequest, jsonResponse } from '@/lib/auth'
import {
  sendPrivateMessage,
  getPrivateConversations,
  getPrivateMessageUnreadCount,
} from '@/lib/server-store'

export const runtime = 'edge'

// 私聊：获取会话列表 / 发送消息
// GET?action=conversations  → 会话摘要列表（最后一条消息 + 未读数）
// GET?action=unread         → 总未读消息数（右上角小红点用）
// POST { toUserId, content }→ 发送私聊消息
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'conversations'

    if (action === 'unread') {
      const count = await getPrivateMessageUnreadCount(user.id)
      return jsonResponse(true, { count })
    }

    const convs = await getPrivateConversations(user.id)
    return jsonResponse(true, { items: convs })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const body = await req.json().catch(() => ({} as any))
    const toUserId = String(body?.toUserId || '').trim()
    const content = String(body?.content || '').trim()
    if (!toUserId) return jsonResponse(false, null, '缺少 toUserId', 400)
    if (!content) return jsonResponse(false, null, '消息内容不能为空', 400)

    const result = await sendPrivateMessage(user, toUserId, content)
    if (!result.success) return jsonResponse(false, null, result.error || '发送失败', 400)
    return jsonResponse(true, { message: result.message })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}
