import { NextRequest } from 'next/server'
import { toggleForumLike } from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// POST /api/forum/posts/[id]/like   点赞/取消
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const r = await toggleForumLike(params.id, user.id)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    return jsonResponse(true, { liked: r.liked, likeCount: r.likeCount })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}