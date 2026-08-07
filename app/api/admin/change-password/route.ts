import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { authRequest, jsonResponse } from '@/lib/auth'
import { updateUser, getUserByUsername } from '@/lib/server-store'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin) return jsonResponse(false,null,'请先登录',401)
    if (!admin.isAdmin) return jsonResponse(false,null,'无权限',403)
    let body: any
    try { body = await req.json() } catch { return jsonResponse(false,null,'请求格式错误',400) }
    const { username, newPassword } = body || {}
    if (!username || !newPassword) return jsonResponse(false,null,'缺少参数',400)
    if (newPassword.length < 4) return jsonResponse(false,null,'密码太短',400)
    const target = await getUserByUsername(username)
    if (!target) return jsonResponse(false,null,'用户不存在',404)
    const hash = bcrypt.hashSync(newPassword, 10)
    const ok = await updateUser(target.id, { password: hash })
    if (!ok) return jsonResponse(false,null,'更新失败',500)
    logger.info('system','管理员修改密码',{by:admin.username,target:username})
    return jsonResponse(true, { message: '密码已更新' })
  } catch(e:any) {
    logger.error('system','改密码失败',{error:e?.message})
    return jsonResponse(false,null,e?.message||'失败',500)
  }
}
