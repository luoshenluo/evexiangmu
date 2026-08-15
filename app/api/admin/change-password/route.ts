import { findUserById, updateUser, logAdminAction } from '@/lib/server-store'
import bcrypt from 'bcryptjs'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)

    const { oldPassword, newPassword } = await req.json()
    if (!oldPassword || !newPassword) return jsonResponse(false, null, '请填写完整', 400)
    if (newPassword.length < 4) return jsonResponse(false, null, '新密码至少4位', 400)

    if (!bcrypt.compareSync(oldPassword, admin.password)) {
      return jsonResponse(false, null, '原密码不正确', 400)
    }

    const newHash = bcrypt.hashSync(newPassword, 10)
    await updateUser(admin.id, { password: newHash })
    await logAdminAction(admin, 'change_password', { targetType: 'user', targetId: admin.id, detail: { desc: '修改自己的管理员密码' } })
    return jsonResponse(true, { ok: true })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
