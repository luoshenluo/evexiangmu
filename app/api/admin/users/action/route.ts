import { findUserById, updateUser } from '@/lib/server-store'
import bcrypt from 'bcryptjs'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)

    const { userId, newPassword, makeAdmin } = await req.json()
    const target = await findUserById(userId)
    if (!target) return jsonResponse(false, null, '用户不存在', 404)

    const updates: Record<string, any> = {}

    if (newPassword) {
      if (newPassword.length < 4) return jsonResponse(false, null, '密码至少4位', 400)
      updates.password = bcrypt.hashSync(newPassword, 10)
    }

    if (makeAdmin !== undefined) {
      if (admin.id !== 'admin' && target.id === 'admin') {
        return jsonResponse(false, null, '不能修改超级管理员权限', 403)
      }
      updates.is_admin = makeAdmin
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse(false, null, '没有要修改的内容', 400)
    }

    await updateUser(userId, updates)
    return jsonResponse(true, { ok: true })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
