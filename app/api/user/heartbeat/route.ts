import { NextRequest } from 'next/server'
import { authRequest, jsonResponse } from '@/lib/auth'
import { touchUserActive } from '@/lib/server-store'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const now = Date.now()
    await touchUserActive(user.id, now)
    return jsonResponse(true, { ts: now })
  } catch (e: any) {
    return jsonResponse(false, { ts: Date.now() }, e?.message || 'heartbeat error')
  }
}
