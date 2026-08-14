import { deleteAnnouncement, updateAnnouncement } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 1)) return jsonResponse(false, null, '无「公告管理」权限', 403)
    const ok = await deleteAnnouncement(params.id)
    return jsonResponse(ok, { ok })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 1)) return jsonResponse(false, null, '无「公告管理」权限', 403)

    const { title, content, priority } = await req.json()
    if (!title?.trim() || !content?.trim()) return jsonResponse(false, null, '请填写完整', 400)

    const ok = await updateAnnouncement(params.id, {
      title: String(title).trim(),
      content: String(content).trim(),
      priority: priority === 'urgent' || priority === 'important' ? priority : 'normal',
    })
    if (!ok) return jsonResponse(false, null, '公告不存在或更新失败', 404)
    return jsonResponse(true, { ok: true })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
