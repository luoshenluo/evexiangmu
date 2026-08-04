import { NextRequest } from 'next/server'
import { findUserByUsername, createUser } from '@/lib/server-store'
import { signToken, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { username, password, nickname } = await req.json()
    if (!username || !password) return jsonResponse(false, null, '请输入账号和密码', 400)
    if (username.length < 3) return jsonResponse(false, null, '账号至少3个字符', 400)
    if (password.length < 4) return jsonResponse(false, null, '密码至少4个字符', 400)

    if (await findUserByUsername(username.trim())) {
      return jsonResponse(false, null, '账号已存在', 400)
    }

    const user = await createUser({
      username: username.trim(),
      password,
      nickname: (nickname || username).trim(),
    })
    const token = await signToken(user.id)
    logger.info('auth', '用户注册成功', { userId: user.id, username })
    return jsonResponse(true, { user: sanitizeUser(user), token })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '注册失败', 500)
  }
}
