import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { authRequest, jsonResponse } from '@/lib/auth'
import { updateUser, getUserByUsername, getUserById } from '@/lib/server-store'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin) return jsonResponse(false,null,'请先登录',401)
    if (!admin.isAdmin) return jsonResponse(false,null,'无权限',403)
    let body: any
    try { body = await req.json() } catch { return jsonResponse(false,null,'请求格式错误',400) }
    const { userId, action, value } = body || {}
    if (!userId || !action) return jsonResponse(false,null,'缺少参数',400)
    const target = await getUserById(userId)
    if (!target) return jsonResponse(false,null,'用户不存在',404)
    let patch: any = {}
    switch(action) {
      case 'toggle_admin':
        if (target.username === 'admin' && !value) return jsonResponse(false,null,'不能取消主管理员权限',400)
        patch.isAdmin = !!value; break
      case 'mute':
        patch.mutedUntil = value ? (Date.now() + (Number(value)||24)*3600*1000) : null; break
      case 'reset_password':
        patch.password = bcrypt.hashSync('123456', 10); break
      case 'soft_delete':
        patch.deleted = !!value; break
      case 'set_coins':
        patch.coins = Math.max(0, Number(value)||0); break
      case 'set_inventory_size':
        patch.inventorySize = Math.max(10, Math.min(500, Number(value)||30)); break
      default:
        return jsonResponse(false,null,'未知操作',400)
    }
    const ok = await updateUser(userId, patch)
    if (!ok) return jsonResponse(false,null,'更新失败',500)
    logger.info('system','管理员用户操作',{by:admin.username,action,userId})
    return jsonResponse(true, { ok: true })
  } catch(e:any) {
    logger.error('system','用户操作失败',{error:e?.message})
    return jsonResponse(false,null,e?.message||'失败',500)
  }
}
