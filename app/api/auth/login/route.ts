import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByUsername, createUser, updateUserLogin, updateUser } from '@/lib/server-store'
import { signToken, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) return jsonResponse(false, null, '请输入账号和密码', 400)

    const user = await findUserByUsername(username.trim())
    if (!user) return jsonResponse(false, null, '账号不存在', 400)

    if (user.bannedUntil && user.bannedUntil > Date.now()) {
      const remainingMs = user.bannedUntil - Date.now()
      const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
      const hours = Math.ceil(remainingMs / (60 * 60 * 1000))
      const timeStr = days >= 1 ? `${days}天` : `${hours}小时`
      logger.warn('auth', '用户尝试登录被封禁', { userId: user.id })
      return jsonResponse(false, null, `账号已被封禁，剩余约${timeStr}`, 403)
    }

    if (user.deleted) {
      return jsonResponse(false, null, '账号已被永久封禁，请联系管理员', 403)
    }

    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) {
      logger.warn('auth', '登录失败: 密码错误', { username })
      return jsonResponse(false, null, '密码错误', 400)
    }

    if (user.bannedUntil && user.bannedUntil <= Date.now()) {
      await updateUser(user.id, { deleted: false, bannedUntil: null })
    }

    await updateUserLogin(user.id)
    const updatedUser = await findUserByUsername(username.trim())

    const token = await signToken(user.id)
    logger.info('auth', '用户登录成功', { userId: user.id, username })
    return jsonResponse(true, { user: sanitizeUser(updatedUser), token })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '登录失败', 500)
  }
}
