import { NextRequest } from 'next/server'
import { getMessages, addMessage, ensureSeasonTick } from '@/lib/server-store'
import { filterSensitiveWords, containsSensitiveWords } from '@/lib/game-data'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(
  req: NextRequest,
  { params }: { params: { channel: string } }
) {
  try {
    await ensureSeasonTick()
    const channel = params.channel as any
    const msgs = await getMessages(channel, 200)
    return jsonResponse(true, msgs)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { channel: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    // 禁言
    if (user.mutedUntil && user.mutedUntil > Date.now()) {
      return jsonResponse(false, null, '你已被禁言', 403)
    }

    const { content } = await req.json()
    if (!content || !content.trim()) return jsonResponse(false, null, '消息不能为空', 400)
    if (content.length > 500) return jsonResponse(false, null, '消息过长', 400)

    const channel = params.channel as any
    const finalContent = filterSensitiveWords(content.trim().slice(0, 200))

    // 家族频道检查
    if (channel === 'family' && !user.familyId) {
      return jsonResponse(false, null, '尚未加入家族', 400)
    }

    const msg = await addMessage({
      channel,
      userId: user.id,
      userName: user.nickname,
      content: finalContent,
      isSystem: false,
    })
    return jsonResponse(true, msg)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
