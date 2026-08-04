import { NextRequest } from 'next/server'
import { muteUser, getAllUsers, findUserById, updateUser } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)

    const { userId, days } = await req.json()
    const target = await findUserById(userId)
    if (!target) return jsonResponse(false, null, '用户不存在', 404)
    if (target.isAdmin && admin.id !== 'admin') return jsonResponse(false, null, '不能禁言其他管理员', 403)

    await muteUser(userId, (days || 0) * 24 * 60 * 60 * 1000)
    return jsonResponse(true, { ok: true })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
