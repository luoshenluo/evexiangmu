import { NextRequest } from 'next/server'
import { getChatSettings, updateChatSettings, logAdminAction } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 获取聊天设置
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const settings = await getChatSettings()
    return jsonResponse(true, settings)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

// 更新聊天设置
export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(admin, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const body = await req.json()
    const updates: any = {}

    if (body.maxMessagesPerMinute !== undefined) {
      const v = Math.max(1, Math.min(60, parseInt(body.maxMessagesPerMinute) || 5))
      updates.maxMessagesPerMinute = v
    }
    if (body.maxMessageLength !== undefined) {
      const v = Math.max(10, Math.min(1000, parseInt(body.maxMessageLength) || 200))
      updates.maxMessageLength = v
    }
    if (body.minMessageIntervalMs !== undefined) {
      const v = Math.max(0, Math.min(60000, parseInt(body.minMessageIntervalMs) || 2000))
      updates.minMessageIntervalMs = v
    }
    if (body.enabled !== undefined) {
      updates.enabled = !!body.enabled
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse(false, null, '没有要修改的内容', 400)
    }

    const updated = await updateChatSettings(updates)
    if (!updated) return jsonResponse(false, null, '更新失败', 500)

    logger.info('admin', '管理员更新聊天设置', { adminId: admin.id, updates })
    await logAdminAction(admin, 'chat_settings', { targetType: 'other', detail: { desc: '更新聊天设置', updates } })
    return jsonResponse(true, updated)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
