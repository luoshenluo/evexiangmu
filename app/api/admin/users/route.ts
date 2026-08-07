import { getAllUsers } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(req: Request) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 0)) return jsonResponse(false, null, '无「用户管理」权限', 403)

    const users = (await getAllUsers())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(u => ({
        ...sanitizeUser(u),
        deleted: u.deleted || false,
      }))
    return jsonResponse(true, users)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
