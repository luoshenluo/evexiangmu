import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { findAdminByUserId, updateAdminPassword } from '@/lib/server-store'
import { jsonResponse, isSuperAdmin, authRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin) return jsonResponse(false, null, '未登录', 401)
    if (!admin.isAdmin) return jsonResponse(false, null, '无管理员权限', 403)

    const { oldPassword, newPassword } = await req.json()
    if (!oldPassword || !newPassword) return jsonResponse(false, null, '请填写完整信息', 400)
    if (newPassword.length < 6) return jsonResponse(false, null, '新密码至少6位', 400)

    const realAdmin = await findAdminByUserId(admin.id)
    if (!realAdmin) return jsonResponse(false, null, '管理员账号不存在', 400)

    if (!bcrypt.compareSync(oldPassword, realAdmin.password)) {
      return jsonResponse(false, null, '原密码错误', 400)
    }

    const newHash = bcrypt.hashSync(newPassword, 10)
    await updateAdminPassword(admin.id, newHash)

    logger.info('admin', '修改管理员密码', { adminId: admin.id, isSuper: isSuperAdmin(admin.id) })
    return jsonResponse(true, { message: '密码修改成功' })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '修改失败', 500)
  }
}
