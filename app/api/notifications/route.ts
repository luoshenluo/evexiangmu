import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { getNotifications } from '@/lib/server-store'

export const runtime = 'edge'

export async function GET(req: Request) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const notifications = await getNotifications(user.id)
    return jsonResponse(true, notifications)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
