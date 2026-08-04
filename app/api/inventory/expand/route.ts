import { NextRequest } from 'next/server'
import { updateUser, ensureSeasonTick } from '@/lib/server-store'
import { getInventoryExpandPrice } from '@/lib/game-data'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const price = getInventoryExpandPrice(user.inventorySize)
    if (user.coins < price) return jsonResponse(false, null, '金币不足', 400)

    const updated = await updateUser(user.id, {
      coins: user.coins - price,
      inventorySize: user.inventorySize + 5,
    })
    return jsonResponse(true, { user: sanitizeUser(updated) })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
