import { NextRequest } from 'next/server'
import {
  getMessages, addMessage, ensureSeasonTick,
  getSensitiveWordList, checkMessageRateLimit, recordServerMessageTime, getChatSettings,
  incrementTaskProgress,
} from '@/lib/server-store'
import { filterSensitiveWords, containsSensitiveWords } from '@/lib/game-data'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function GET(
  req: NextRequest,
  { params }: { params: { channel: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    await ensureSeasonTick()
    const channel = params.channel as any
    let msgs = await getMessages(channel, 200)
    // 黑名单过滤：隐藏自己拉黑的用户发出的消息
    const blacklist = new Set(user.blacklist || [])
    if (blacklist.size > 0) {
      msgs = msgs.filter((m: any) => !m.isSystem && !blacklist.has(m.userId))
    }
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
      const mins = Math.ceil((user.mutedUntil - Date.now()) / 60000)
      return jsonResponse(false, null, `你已被禁言，还有 ${mins} 分钟解除`, 403)
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse(false, null, '请求格式错误', 400)
    }

    const { content } = body
    if (!content || !content.trim()) return jsonResponse(false, null, '消息不能为空', 400)

    const settings = await getChatSettings()
    const maxLen = settings?.maxMessageLength || 200
    if (content.length > maxLen) {
      return jsonResponse(false, null, `消息过长（最多 ${maxLen} 字）`, 400)
    }

    const channel = params.channel as any

    // 家族频道检查
    if (channel === 'family' && !user.familyId) {
      return jsonResponse(false, null, '尚未加入家族', 400)
    }

    // 服务端频率限制
    const rate = await checkMessageRateLimit(user.id)
    if (!rate.allowed) {
      return jsonResponse(false, null, rate.reason || '发言过于频繁', 429)
    }

    // 动态敏感词过滤
    const sensitiveWords = await getSensitiveWordList()
    const finalContent = filterSensitiveWords(content.trim().slice(0, maxLen), sensitiveWords)

    const msg = await addMessage({
      channel,
      userId: user.id,
      userName: user.nickname,
      content: finalContent,
      isSystem: false,
    })

    // 记录服务端发言时间
    recordServerMessageTime(user.id)

    // 任务进度：聊天爱好者（世界频道发言 3 次，家族/私聊也计入总发言）
    try { await incrementTaskProgress(user.id, 'chat', 1) } catch {}

    logger.info('chat', '用户发言', {
      userId: user.id, channel,
      original: content.length, filtered: finalContent.length,
      hasSensitive: containsSensitiveWords(content, sensitiveWords),
    })

    return jsonResponse(true, msg)
  } catch (e: any) {
    logger.error('chat', '发送消息失败', { error: e?.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
