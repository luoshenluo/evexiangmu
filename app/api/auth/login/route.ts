import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByUsername, createUser, updateUserLogin } from '@/lib/server-store'
import { signToken, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) return jsonResponse(false, null, '请输入账号和密码', 400)

    const user = await findUserByUsername(username.trim())
    if (!user) return jsonResponse(false, null, '账号不存在', 400)

    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) {
      logger.warn('auth', '登录失败: 密码错误', { username })
      return jsonResponse(false, null, '密码错误', 400)
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
