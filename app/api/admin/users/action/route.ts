import { NextRequest } from 'next/server'
import { findUserById, updateUser } from '@/lib/server-store'
import bcrypt from 'bcryptjs'
import { authRequest, jsonResponse, isSuperAdmin, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)

    const { userId, newPassword, makeAdmin, banUser, unbanUser, banDays, nickname, avatar, adminPermissions } = await req.json()
    const target = await findUserById(userId)
    if (!target) return jsonResponse(false, null, '用户不存在', 404)

    const updates: Record<string, any> = {}

    if (newPassword) {
      if (!userHasPermission(admin, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)
      if (newPassword.length < 4) return jsonResponse(false, null, '密码至少4位', 400)
      updates.password = bcrypt.hashSync(newPassword, 10)
    }

    if (makeAdmin !== undefined) {
      if (!userHasPermission(admin, 5)) return jsonResponse(false, null, '无「权限管理」权限', 403)
      if (!isSuperAdmin(admin.id) && isSuperAdmin(target.id)) {
        return jsonResponse(false, null, '不能修改超级管理员权限', 403)
      }
      if (target.id === admin.id) {
        return jsonResponse(false, null, '不能修改自己的权限', 403)
      }
      updates.is_admin = makeAdmin
      // 撤管时清除权限位
      if (!makeAdmin) updates.admin_permissions = 0
    }

    // 设置子管理员权限位
    if (adminPermissions !== undefined) {
      if (!userHasPermission(admin, 5)) return jsonResponse(false, null, '无「权限管理」权限', 403)
      if (!isSuperAdmin(admin.id) && isSuperAdmin(target.id)) {
        return jsonResponse(false, null, '不能修改超级管理员权限', 403)
      }
      // 权限位只允许低 8 位
      const masked = Number(adminPermissions) & 0xff
      if (!Number.isInteger(masked) || masked < 0 || masked > 0xff) {
        return jsonResponse(false, null, '权限位不合法', 400)
      }
      updates.admin_permissions = masked
    }

    if (banUser) {
      if (!userHasPermission(admin, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)
      if (target.isAdmin && !isSuperAdmin(admin.id)) return jsonResponse(false, null, '不能封号管理员', 403)
      if (banDays !== undefined && banDays > 0) {
        updates.deleted = true
        updates.banned_until = Date.now() + banDays * 24 * 60 * 60 * 1000
      } else {
        updates.deleted = true
        updates.banned_until = null
      }
    }

    if (unbanUser) {
      if (!userHasPermission(admin, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)
      updates.deleted = false
      updates.banned_until = null
    }

    if (nickname !== undefined) {
      if (!userHasPermission(admin, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)
      if (!nickname.trim()) return jsonResponse(false, null, '昵称不能为空', 400)
      if (nickname.length > 20) return jsonResponse(false, null, '昵称最长20字', 400)
      updates.nickname = nickname.trim()
    }

    if (avatar !== undefined) {
      if (!userHasPermission(admin, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)
      updates.avatar = avatar
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
