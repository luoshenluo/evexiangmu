import { NextRequest } from 'next/server'
import { findUserByUsername, createUser } from '@/lib/server-store'
import { signToken, sanitizeUser, jsonResponse } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 注册限次：同一 IP 每小时最多注册 3 个账号（防脚本批量刷号）
const REGISTER_MAX_PER_IP = 3
const REGISTER_WINDOW_MS = 60 * 60 * 1000

// 用户名：3-24 位，字母/数字/下划线/中划线/中文
const USERNAME_RE = /^[\w\u4e00-\u9fa5-]{3,24}$/

export async function POST(req: NextRequest) {
  try {
    const { username, password, nickname } = await req.json()
    if (!username || !password) return jsonResponse(false, null, '请输入账号和密码', 400)

    const name = String(username).trim()
    const pwd = String(password)
    const nick = String(nickname || name).trim()

    // IP 限速
    const ipLimit = checkRateLimit(`register:${getClientIp(req)}`, REGISTER_MAX_PER_IP, REGISTER_WINDOW_MS)
    if (!ipLimit.allowed) {
      const mins = Math.ceil(ipLimit.retryAfterMs / 60000)
      return jsonResponse(false, null, `注册过于频繁，请 ${mins} 分钟后再试`, 429)
    }

    // 输入校验
    if (!USERNAME_RE.test(name)) {
      return jsonResponse(false, null, '账号需为3-24位字母/数字/下划线/中划线/中文', 400)
    }
    if (pwd.length < 6 || pwd.length > 64) {
      return jsonResponse(false, null, '密码需为6-64位', 400)
    }
    if (nick.length < 1 || nick.length > 24) {
      return jsonResponse(false, null, '昵称需为1-24个字符', 400)
    }

    if (await findUserByUsername(name)) {
      return jsonResponse(false, null, '账号已存在', 400)
    }

    const user = await createUser({
      username: name,
      password: pwd,
      nickname: nick,
    })
    const token = await signToken(user.id)
    logger.info('auth', '用户注册成功', { userId: user.id, username: name })
    return jsonResponse(true, { user: sanitizeUser(user), token })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '注册失败', 500)
  }
}
