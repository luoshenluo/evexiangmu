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

// 超级管理员 ID 常量 - 可通过环境变量覆盖
export const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID || 'admin'

export function isSuperAdmin(userId: string): boolean {
  return userId === SUPER_ADMIN_ID
}

/**
 * 判断是否为超级管理员用户（兼容 id 或 username 等于 SUPER_ADMIN_ID）
 * 线上库超管的行 id 可能是自动生成的（如 adm_xxx），但 username 固定为 admin，
 * 仅按 id 判断会导致超管保护失效。
 */
export function isSuperAdminUser(user: { id?: string; username?: string } | null | undefined): boolean {
  if (!user) return false
  return user.id === SUPER_ADMIN_ID || user.username === SUPER_ADMIN_ID
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ====== 管理员权限位（bitwise） ======
// 位  0 (1<<0  =1):   用户管理 (查看/编辑用户/禁言/解封/封号)
// 位  1 (1<<1  =2):   公告管理 (发布/删除公告)
// 位  2 (1<<2  =4):   聊天管理 (删除消息/敏感词)
// 位  3 (1<<3  =8):   CDK管理 (生成/查看)
// 位  4 (1<<4  =16):  市场调控 (价格/官方上下架)
// 位  5 (1<<5  =32):  子管理员权限 (给其他子管理员调权限/设为管理员)
// 位  6 (1<<6  =64):  日志与统计 (查看操作日志/导出)
// 位  7 (1<<7  =128): 高级经济调控 (直接发金币/回收)
export const ADMIN_PERMISSIONS = [
  { bit: 0, key: 'users',       name: '用户管理',      desc: '查看/编辑用户、禁言、解封、封号' },
  { bit: 1, key: 'announcements', name: '公告管理',   desc: '发布、编辑、删除系统公告' },
  { bit: 2, key: 'chat',        name: '聊天管理',      desc: '删除消息、管理敏感词库' },
  { bit: 3, key: 'cdk',         name: 'CDK 管理',     desc: '生成、查看 CDK 兑换码' },
  { bit: 4, key: 'market',      name: '市场调控',      desc: '价格调控、官方商品上下架' },
  { bit: 5, key: 'subadmin',    name: '权限管理',      desc: '任命/撤管子管理员、分配权限' },
  { bit: 6, key: 'audit',       name: '日志统计',      desc: '查看操作审计日志、数据导出' },
  { bit: 7, key: 'economy',     name: '经济调控',      desc: '给用户发金币、回收、直接改余额' },
] as const

export const ADMIN_PERM_ALL = ADMIN_PERMISSIONS.reduce((a, p) => a | (1 << p.bit), 0)

/**
 * 检查某用户是否有指定权限
 * - 超级管理员 (SUPER_ADMIN_ID) 永远全权限
 * - isAdmin=true 的用户，根据 adminPermissions 位判断；无 adminPermissions 字段时默认给 1/2/3 基础权限
 * - isAdmin=false 的用户永远无权限
 */
export function hasPermission(userId: string, userAdmin: boolean | undefined, perms: number | undefined, requiredBit: number): boolean {
  if (!userAdmin) return false
  if (isSuperAdmin(userId)) return true
  // 无 perms 字段时，子管理员默认有基础 1|2|3 权限（用户+公告+聊天）避免旧数据无法登录
  const p = perms ?? (1 | 2 | 4)
  return (p & (1 << requiredBit)) !== 0
}

/** 便捷：直接传 user 对象（有 id, isAdmin, adminPermissions 字段） */
export function userHasPermission(user: { id: string; isAdmin?: boolean; adminPermissions?: number } | null | undefined, requiredBit: number): boolean {
  if (!user) return false
  return hasPermission(user.id, !!user.isAdmin, user.adminPermissions, requiredBit)
}
