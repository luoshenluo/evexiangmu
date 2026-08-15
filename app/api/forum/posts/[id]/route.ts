import { NextRequest } from 'next/server'
import {
  getForumPost,
  deleteForumPost,
} from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// GET /api/forum/posts/[id]  （游客可读，返回帖子+评论）
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    const r = await getForumPost(params.id, user?.id)
    if (!r.success) return jsonResponse(false, null, r.error, 404)
    return jsonResponse(true, { post: r.post, comments: r.comments })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

// DELETE /api/forum/posts/[id]  删除帖子（作者或管理员）
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const r = await deleteForumPost(params.id, user.id, user.isAdmin)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    return jsonResponse(true, null, '已删除')
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}