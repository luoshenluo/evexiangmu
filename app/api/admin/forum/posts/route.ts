import { NextRequest } from 'next/server'
import { listForumPostsAdmin, deleteForumPost, logAdminAction } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

// GET /api/admin/forum/posts?page=1
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const r = await listForumPostsAdmin(page, 20)
    return jsonResponse(true, r)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

// DELETE /api/admin/forum/posts?id=xxx （软删除，权限已确认）
export async function DELETE(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return jsonResponse(false, null, '缺少帖子 id', 400)
    const r = await deleteForumPost(id, user.id, true)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    await logAdminAction(user, 'delete_post', { targetType: 'other', targetId: id, detail: { desc: `删除论坛帖子 ${id}` } })
    return jsonResponse(true, null, '已删除')
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}