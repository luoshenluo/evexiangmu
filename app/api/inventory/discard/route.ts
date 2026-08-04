import { NextRequest } from 'next/server'
import { updateUser, ensureSeasonTick } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { itemId, quantity } = await req.json()
    if (!itemId || !quantity) return jsonResponse(false, null, '参数错误', 400)

    const item = user.inventory.find(i => i.id === itemId)
    if (!item || item.quantity < quantity) return jsonResponse(false, null, '物品不足', 400)

    const newInv = user.inventory.map(i =>
      i.id === itemId ? { ...i, quantity: i.quantity - quantity } : i
    ).filter(i => i.quantity > 0)

    const updated = await updateUser(user.id, { inventory: newInv })
    return jsonResponse(true, { user: sanitizeUser(updated) })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
