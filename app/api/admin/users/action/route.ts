import { NextRequest } from 'next/server'
import { findUserById, updateUser } from '@/lib/server-store'
import bcrypt from 'bcryptjs'
import { authRequest, jsonResponse, isSuperAdminUser, userHasPermission } from '@/lib/auth'

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
      // 非超管不能重置超管密码（防子管理员接管）
      if (!isSuperAdminUser(admin) && isSuperAdminUser(target)) {
        return jsonResponse(false, null, '不能修改超级管理员密码', 403)
      }
      updates.password = bcrypt.hashSync(newPassword, 10)
    }

    if (makeAdmin !== undefined) {
      if (!userHasPermission(admin, 5)) return jsonResponse(false, null, '无「权限管理」权限', 403)
      if (!isSuperAdminUser(admin) && isSuperAdminUser(target)) {
        return jsonResponse(false, null, '不能修改超级管理员权限', 403)
      }
      if (target.id === admin.id) {
        return jsonResponse(false, null, '不能修改自己的权限', 403)
      }
      updates.isAdmin = makeAdmin
      if (makeAdmin) {
        // 首次任命管理员时：如果前端没有传 adminPermissions，给默认基础权限 0b0000_0111 = Bit0+Bit1+Bit2
        if (adminPermissions === undefined) {
          // 非超管只能授予自己拥有的权限位
          if (!isSuperAdminUser(admin)) {
            const mine = (admin.adminPermissions ?? 0) & 0xff
            const base = (1 | 2 | 4) & mine
            if (base === 0) return jsonResponse(false, null, '不能授予自己未拥有的权限', 403)
            updates.adminPermissions = base
          } else {
            updates.adminPermissions = (1 | 2 | 4)
          }
        }
      } else {
        // 撤管时清除权限位
        updates.adminPermissions = 0
      }
    }

    // 设置子管理员权限位
    if (adminPermissions !== undefined) {
      if (!userHasPermission(admin, 5)) return jsonResponse(false, null, '无「权限管理」权限', 403)
      if (!isSuperAdminUser(admin) && isSuperAdminUser(target)) {
        return jsonResponse(false, null, '不能修改超级管理员权限', 403)
      }
      // 非超管不能修改自己的权限位（防子管理员给自己提升权限/自封经济调控）
      if (!isSuperAdminUser(admin) && target.id === admin.id) {
        return jsonResponse(false, null, '不能修改自己的权限', 403)
      }
      // 非超管只能授予自己已拥有的权限位（防子管理员越权授权经济调控/权限管理等）
      if (!isSuperAdminUser(admin)) {
        const mine = (admin.adminPermissions ?? 0) & 0xff
        const granted = Number(adminPermissions) & 0xff
        if ((granted & ~mine) !== 0) {
          return jsonResponse(false, null, '不能授予自己未拥有的权限', 403)
        }
      }
      // 权限位只允许低 8 位
      const masked = Number(adminPermissions) & 0xff
      if (!Number.isInteger(masked) || masked < 0 || masked > 0xff) {
        return jsonResponse(false, null, '权限位不合法', 400)
      }
      updates.adminPermissions = masked
      // 有任意权限位 => 自动设为管理员；无权限位 => 撤管
      if (masked > 0 && updates.isAdmin === undefined) updates.isAdmin = true
    }

    if (banUser) {
      if (!userHasPermission(admin, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)
      if (target.isAdmin && !isSuperAdminUser(admin)) return jsonResponse(false, null, '不能封号管理员', 403)
      if (banDays !== undefined && banDays > 0) {
        updates.deleted = true
        updates.bannedUntil = Date.now() + banDays * 24 * 60 * 60 * 1000
      } else {
        updates.deleted = true
        updates.bannedUntil = null
      }
    }

    if (unbanUser) {
      if (!userHasPermission(admin, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)
      updates.deleted = false
      updates.bannedUntil = null
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
