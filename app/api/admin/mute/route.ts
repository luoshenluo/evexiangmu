import { NextRequest } from 'next/server'
import { muteUser, getAllUsers, findUserById, updateUser, logAdminAction } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse, isSuperAdminUser, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(admin, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)

    const { userId, days } = await req.json()
    const target = await findUserById(userId)
    if (!target) return jsonResponse(false, null, '用户不存在', 404)
    if (target.isAdmin && !isSuperAdminUser(admin)) return jsonResponse(false, null, '不能禁言其他管理员', 403)

    await muteUser(userId, (days || 0) * 24 * 60 * 60 * 1000)
    await logAdminAction(admin, 'mute_user', {
      targetType: 'user', targetId: userId,
      detail: { desc: days > 0 ? `禁言用户「${target.nickname || target.username || target.id}」${days}天` : `解除用户「${target.nickname || target.username || target.id}」的禁言` },
    })
    return jsonResponse(true, { ok: true })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
