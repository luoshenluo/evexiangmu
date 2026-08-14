import { NextRequest } from 'next/server'
import { authRequest, jsonResponse } from '@/lib/auth'
import { getPrivateMessages, markPrivateConversationRead } from '@/lib/server-store'

export const runtime = 'edge'

// 与单个好友的私聊消息
// GET  → 消息列表（时间正序，limit 默认 100）+ 自动标已读
// POST → 标已读（可选，进入会话时 GET 已自动处理）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ peerId: string }> },
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const peerId = decodeURIComponent((await params).peerId)
    if (!peerId) return jsonResponse(false, null, '缺少 peerId', 400)

    const url = new URL(req.url)
    const limit = Math.min(500, Number(url.searchParams.get('limit') || 100))

    const [items] = await Promise.all([
      getPrivateMessages(user.id, peerId, limit),
      markPrivateConversationRead(user.id, peerId),
    ])
    return jsonResponse(true, { items })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ peerId: string }> },
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const peerId = decodeURIComponent((await params).peerId)
    await markPrivateConversationRead(user.id, peerId)
    return jsonResponse(true, { ok: true })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}
