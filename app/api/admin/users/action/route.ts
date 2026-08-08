import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserById, updateUser, updateUserPassword } from '@/lib/server-store'
import { jsonResponse, authRequest, hasPermission, isSuperAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权限', 403)
    if (!hasPermission(admin.id, admin.isAdmin, admin.adminPermissions, 0)) {
      return jsonResponse(false, null, '无用户管理权限', 403)
    }

    const body = await req.json()
    const { userId, action, data } = body
    if (!userId || !action) return jsonResponse(false, null, '缺少参数', 400)

    const targetUser = await findUserById(userId)
    if (!targetUser) return jsonResponse(false, null, '用户不存在', 400)

    const updates: any = {}

    switch (action) {
      case 'edit_profile':
        if (data?.nickname !== undefined) updates.nickname = String(data.nickname).slice(0, 32)
        if (data?.avatar !== undefined) updates.avatar = String(data.avatar).slice(0, 16)
        if (data?.coins !== undefined) {
          const coins = parseInt(data.coins)
          if (!isNaN(coins) && coins >= 0) updates.coins = coins
        }
        break

      case 'reset_password':
        const newPassword = String(data?.newPassword || '123456').slice(0, 64)
        updates.password = bcrypt.hashSync(newPassword, 10)
        break

      case 'mute':
        const duration = parseInt(data?.durationHours) || 24
        updates.mutedUntil = Date.now() + duration * 60 * 60 * 1000
        logger.info('admin', '用户禁言', { adminId: admin.id, userId, duration })
        break

      case 'unmute':
        updates.mutedUntil = 0
        logger.info('admin', '解除禁言', { adminId: admin.id, userId })
        break

      case 'ban':
        const banDays = parseInt(data?.banDays) || 7
        updates.bannedUntil = Date.now() + banDays * 24 * 60 * 60 * 1000
        updates.deleted = false
        logger.info('admin', '封禁用户', { adminId: admin.id, userId, banDays })
        break

      case 'unban':
        updates.bannedUntil = null
        updates.deleted = false
        logger.info('admin', '解除封禁', { adminId: admin.id, userId })
        break

      case 'set_admin':
        if (!isSuperAdmin(admin.id)) return jsonResponse(false, null, '只有超管可操作', 403)
        updates.isAdmin = !!data?.isAdmin
        if (data?.adminPermissions !== undefined) {
          updates.adminPermissions = parseInt(data.adminPermissions) || 0
        }
        logger.info('admin', '设为管理员', { adminId: admin.id, userId, isAdmin: updates.isAdmin })
        break

      default:
        return jsonResponse(false, null, '未知操作', 400)
    }

    const password = updates.password
    delete updates.password
    if (Object.keys(updates).length > 0) {
      await updateUser(userId, updates)
    }
    if (password) {
      await updateUserPassword(userId, password)
    }

    return jsonResponse(true, { message: '操作成功' })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '操作失败', 500)
  }
}
