import { deleteAnnouncement } from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    const ok = await deleteAnnouncement(params.id)
    return jsonResponse(ok, { ok })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
