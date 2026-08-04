// 认证工具函数 - 使用 jose 替代 jsonwebtoken（兼容 Cloudflare Edge Runtime）
import { SignJWT, jwtVerify } from 'jose'
import { findUserById } from './server-store'
import { logger } from './logger'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'garden-game-secret-key-2024'
)

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return (payload as any).userId || null
  } catch {
    return null
  }
}

export async function authRequest(req: Request) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const userId = await verifyToken(token)
  if (!userId) return null
  const user = await findUserById(userId)
  if (!user) {
    logger.warn('auth', 'Token 指向的用户不存在', { userId })
    return null
  }
  return user
}

// 清理敏感信息返回给前端
export function sanitizeUser(user: any) {
  if (!user) return null
  const { password, ...clean } = user
  return clean
}

export function jsonResponse(success: boolean, data?: any, error?: string, status = 200) {
  return Response.json(
    { success, data, error },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}
