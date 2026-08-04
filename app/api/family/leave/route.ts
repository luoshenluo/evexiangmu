import { updateUser } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const updated = await updateUser(user.id, { familyId: null })
    return jsonResponse(true, { user: sanitizeUser(updated) })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
