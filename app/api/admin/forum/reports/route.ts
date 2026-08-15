import { NextRequest } from 'next/server'
import { listForumReports } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

// GET /api/admin/forum/reports?status=pending|handled|dismissed|all
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const url = new URL(req.url)
    const status = (url.searchParams.get('status') || 'pending') as any
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 200)
    const items = await listForumReports(status, limit)
    return jsonResponse(true, items)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}