import { NextRequest } from 'next/server'
import { findUserById, ensureSeasonTick, atomicSellInventory } from '@/lib/server-store'
import { FLOWER_TYPES, getFlowerSellPrice } from '@/lib/game-data'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { itemId, quantity } = await req.json()
    if (!itemId || !quantity) return jsonResponse(false, null, '参数错误', 400)
    if (!Number.isInteger(quantity) || quantity < 1) return jsonResponse(false, null, '数量无效', 400)

    const item = user.inventory.find(i => i.id === itemId)
    if (!item || item.quantity < quantity || !item.sellable) {
      return jsonResponse(false, null, '物品不可出售或数量不足', 400)
    }

    // 找匹配的官方收购价，或用基础价
    let price = 0
    if (item.type === 'flower') {
      const ft = FLOWER_TYPES.find(f => f.id === item.referenceId)
      if (ft) price = getFlowerSellPrice(ft, item.rank || 1)
    } else if (item.type === 'bouquet') {
      // 花束：从 referenceId(bouquet_<flowerId>) 解析花型，售价 = 3 × 单朵 × 1.5
      const flowerId = item.referenceId.replace(/^bouquet_/, '')
      const ft = FLOWER_TYPES.find(f => f.id === flowerId)
      if (ft) price = Math.round(getFlowerSellPrice(ft, item.rank || 1) * 3 * 1.5)
    } else if (item.type === 'tool') {
      price = 5 // 工具回收低价
    }
    if (price <= 0) price = 1

    const coinsEarned = price * quantity

    // 原子卖出：扣库存 + 加金币一步完成，防并发复制道具/刷金币
    const ok = await atomicSellInventory(user.id, itemId, quantity, coinsEarned)
    if (!ok) return jsonResponse(false, null, '物品不可出售或数量不足', 400)

    const fresh = await findUserById(user.id)
    return jsonResponse(true, { user: fresh ? sanitizeUser(fresh) : null, coinsEarned })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}