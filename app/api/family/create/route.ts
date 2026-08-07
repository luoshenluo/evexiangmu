import { NextRequest } from 'next/server'
import { createFamilyReal, getAllUsers } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { name, announcement, avatar } = await req.json()
    if (!name?.trim()) return jsonResponse(false, null, '请输入家族名称', 400)

    const r = await createFamilyReal(user.id, name, announcement || '', avatar || '🏰')
    if (!r.success) return jsonResponse(false, null, r.error, 400)

    const updated = await getAllUsers().then((us) => us.find((x) => x.id === user.id))
    return jsonResponse(true, {
      user: updated ? sanitizeUser(updated) : null,
      family: r.family,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
