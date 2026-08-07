import { deleteAnnouncement } from '@/lib/server-store'
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
