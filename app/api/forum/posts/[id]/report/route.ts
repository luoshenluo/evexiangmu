import { NextRequest } from 'next/server'
import { reportForumTarget } from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// POST /api/forum/posts/[id]/report   { reason }  举报帖子
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const body = await req.json()
    const r = await reportForumTarget('post', params.id, user.id, body.reason)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    return jsonResponse(true, null, '举报成功，感谢反馈')
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}