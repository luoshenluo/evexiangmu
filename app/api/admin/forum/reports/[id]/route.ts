import { NextRequest } from 'next/server'
import { handleForumReport } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

// POST /api/admin/forum/reports/[id]  { status: 'handled'|'dismissed', deleteTarget?: boolean }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const body = await req.json()
    const status = body.status === 'dismissed' ? 'dismissed' : 'handled'
    const deleteTarget = !!body.deleteTarget
    const r = await handleForumReport(params.id, status, deleteTarget)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    return jsonResponse(true, null, '处理完成')
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}