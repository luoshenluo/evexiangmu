import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByUsername, createUser, updateUserLogin, updateUser, incrementTaskProgress } from '@/lib/server-store'
import { signToken, sanitizeUser, jsonResponse } from '@/lib/auth'
import { checkRateLimit, resetRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 登录失败限次：同一账号或同一 IP 15 分钟内最多失败 5 次
const LOGIN_FAIL_MAX = 5
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000

function failKey(prefix: string, value: string): string {
  return `login_fail:${prefix}:${value}`
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) return jsonResponse(false, null, '请输入账号和密码', 400)

    const name = String(username).trim()
    const ip = getClientIp(req)

    // 限速前置检查：IP 维度
    const ipLimit = checkRateLimit(failKey('ip', ip), LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MS)
    if (!ipLimit.allowed) {
      const mins = Math.ceil(ipLimit.retryAfterMs / 60000)
      return jsonResponse(false, null, `尝试次数过多，请 ${mins} 分钟后再试`, 429)
    }

    const user = await findUserByUsername(name)
    if (!user) {
      // 统一文案，避免账号枚举
      const nameLimit = checkRateLimit(failKey('name', name), LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MS)
      if (!nameLimit.allowed) {
        const mins = Math.ceil(nameLimit.retryAfterMs / 60000)
        return jsonResponse(false, null, `尝试次数过多，请 ${mins} 分钟后再试`, 429)
      }
      return jsonResponse(false, null, '账号或密码错误', 400)
    }

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
      logger.warn('auth', '登录失败: 密码错误', { username: name })
      checkRateLimit(failKey('name', name), LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MS)
      return jsonResponse(false, null, '账号或密码错误', 400)
    }

    // 登录成功：清除失败计数
    resetRateLimit(failKey('ip', ip))
    resetRateLimit(failKey('name', name))

    if (user.bannedUntil && user.bannedUntil <= Date.now()) {
      await updateUser(user.id, { deleted: false, bannedUntil: null })
    }

    await updateUserLogin(user.id)
    const updatedUser = await findUserByUsername(name)

    const token = await signToken(user.id)
    // 每日登录任务：只在真实登录成功时推进（防止刷新任务页刷进度）
    try { await incrementTaskProgress(user.id, 'login', 1) } catch {}
    logger.info('auth', '用户登录成功', { userId: user.id, username: name })
    return jsonResponse(true, { user: sanitizeUser(updatedUser), token })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '登录失败', 500)
  }
}
