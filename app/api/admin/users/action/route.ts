import { NextRequest } from 'next/server'
import { findUserById, updateUser } from '@/lib/server-store'
import bcrypt from 'bcryptjs'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)

    const { userId, newPassword, makeAdmin, banUser, unbanUser, nickname, avatar } = await req.json()
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
      if (target.id === admin.id) {
        return jsonResponse(false, null, '不能修改自己的权限', 403)
      }
      updates.is_admin = makeAdmin
    }

    if (banUser) {
      if (target.isAdmin) return jsonResponse(false, null, '不能封号管理员', 403)
      updates.deleted = true
    }

    if (unbanUser) {
      updates.deleted = false
    }

    if (nickname !== undefined) {
      if (!nickname.trim()) return jsonResponse(false, null, '昵称不能为空', 400)
      if (nickname.length > 20) return jsonResponse(false, null, '昵称最长20字', 400)
      updates.nickname = nickname.trim()
    }

    if (avatar !== undefined) {
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
