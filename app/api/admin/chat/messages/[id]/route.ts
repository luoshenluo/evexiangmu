import { NextRequest } from 'next/server'
import { deleteMessage, logAdminAction } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 删除单条消息
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(admin, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const ok = await deleteMessage(params.id)
    if (!ok) return jsonResponse(false, null, '删除失败', 500)

    logger.warn('admin', '管理员删除消息', { adminId: admin.id, messageId: params.id })
    await logAdminAction(admin, 'delete_message', { targetType: 'other', targetId: params.id, detail: { desc: `删除聊天消息 ${params.id}` } })
    return jsonResponse(true, { ok: true })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
