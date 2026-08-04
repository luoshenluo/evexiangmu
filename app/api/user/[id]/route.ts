import { NextRequest } from 'next/server'
import { findUserById, ensureSeasonTick } from '@/lib/server-store'
import { sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureSeasonTick()
    const user = await findUserById(params.id)
    if (!user) return jsonResponse(false, null, '用户不存在', 404)
    return jsonResponse(true, sanitizeUser(user))
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '查询失败', 500)
  }
}
