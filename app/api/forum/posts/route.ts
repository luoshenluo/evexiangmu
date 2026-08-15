import { NextRequest } from 'next/server'
import {
  listForumPosts,
  createForumPost,
} from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// GET /api/forum/posts?sort=latest|hot&page=1  （游客可读）
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    const url = new URL(req.url)
    const sort = (url.searchParams.get('sort') === 'hot' ? 'hot' : 'latest') as 'latest' | 'hot'
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const result = await listForumPosts(sort, page, 20, user?.id)
    return jsonResponse(true, result)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

// POST /api/forum/posts  { title, content }  （需登录）
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const body = await req.json()
    const r = await createForumPost(user.id, body.title, body.content)
    if (!r.success) return jsonResponse(false, null, r.error, 400)
    return jsonResponse(true, r.post)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}