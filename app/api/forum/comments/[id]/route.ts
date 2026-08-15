import { NextRequest } from 'next/server'
import { deleteForumComment } from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// DELETE /api/forum/comments/[id]  删除评论（作者或管理员）
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const r = await deleteForumComment(params.id, user.id, user.isAdmin)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    return jsonResponse(true, null, '已删除')
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}