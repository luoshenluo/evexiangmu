import { NextRequest } from 'next/server'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'
import { listAdminLogs } from '@/lib/server-store'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin) return jsonResponse(false, null, '请先登录', 401)
    if (!admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    // 需要日志统计权限
    if (!userHasPermission(admin, 6)) return jsonResponse(false, null, '无「日志统计」权限', 403)

    const body = await req.json()
    const { adminId, targetType, action, limit = 200, offset = 0 } = body || {}
    const res = await listAdminLogs({
      adminId: adminId || undefined,
      targetType: targetType || undefined,
      action: action || undefined,
      limit: Math.min(500, Number(limit || 200)),
      offset: Number(offset || 0),
    })
    return jsonResponse(true, res)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
