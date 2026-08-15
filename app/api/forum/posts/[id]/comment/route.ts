import { NextRequest } from 'next/server'
import { createForumComment } from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// POST /api/forum/posts/[id]/comment   { content }  发表评论
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const body = await req.json()
    const r = await createForumComment(params.id, user.id, body.content)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    return jsonResponse(true, r.comment)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}