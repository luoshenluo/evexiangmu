import { NextRequest } from 'next/server'
import {
  toggleBlacklist,
  findUserById,
} from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// GET: 我的黑名单列表（含昵称/头像）
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const blacklist = user.blacklist || []
    const all = blacklist.map(async (id) => {
      const u = await findUserById(id)
      if (!u || u.deleted) return null
      return {
        id: u.id,
        nickname: u.nickname,
        avatar: u.avatar,
        username: u.username,
        blockedAt: null,
      }
    })
    const items = (await Promise.all(all)).filter(Boolean)
    return jsonResponse(true, { items })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

// POST: 拉黑 / 取消拉黑  { targetId, block: boolean }
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const body = await req.json()
    const { targetId, block } = body
    if (!targetId) return jsonResponse(false, null, '缺少目标用户', 400)

    const r = await toggleBlacklist(user.id, targetId, !!block)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    return jsonResponse(true, { blacklist: r.blacklist })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}