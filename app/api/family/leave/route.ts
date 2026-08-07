import { NextRequest } from 'next/server'
import { leaveFamilyReal, getAllUsers } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const r = await leaveFamilyReal(user.id)
    if (!r.success) return jsonResponse(false, null, r.error, 400)

    const updated = await getAllUsers().then((us) => us.find((x) => x.id === user.id))
    return jsonResponse(true, { user: updated ? sanitizeUser(updated) : null })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
