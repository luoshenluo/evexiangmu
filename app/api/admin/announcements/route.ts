import { NextRequest } from 'next/server'
import { getAnnouncements, createAnnouncement } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(req: Request) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 1)) return jsonResponse(false, null, '无「公告管理」权限', 403)
    return jsonResponse(true, await getAnnouncements())
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 1)) return jsonResponse(false, null, '无「公告管理」权限', 403)

    const { title, content, priority } = await req.json()
    if (!title?.trim() || !content?.trim()) return jsonResponse(false, null, '请填写完整', 400)

    const a = await createAnnouncement({
      title: title.trim(),
      content: content.trim(),
      priority: priority || 'normal',
    })
    return jsonResponse(true, a)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
