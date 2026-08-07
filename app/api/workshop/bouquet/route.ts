import { NextRequest } from 'next/server'
import { updateUser, createNotification } from '@/lib/server-store'
import { FLOWER_TYPES, getFlowerSellPrice } from '@/lib/game-data'
import type { InventoryItem } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 花艺合成：消耗 3 朵同种花 + 少量金币 → 1 束花束（售价 1.5×3 倍）
const BOUQUET_FEE = 10
const BOUQUET_BONUS = 1.5

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    let body: any
    try { body = await req.json() } catch { return jsonResponse(false, null, '请求格式错误', 400) }

    const { itemId } = body
    if (!itemId) return jsonResponse(false, null, '请选择花', 400)

    const item = user.inventory.find(i => i.id === itemId && i.type === 'flower' && i.quantity >= 3)
    if (!item) return jsonResponse(false, null, '需要 3 朵同种花', 400)

    const ft = FLOWER_TYPES.find(f => f.id === item.referenceId)
    if (!ft) return jsonResponse(false, null, '花型异常', 400)

    if (user.coins < BOUQUET_FEE) {
      return jsonResponse(false, null, `金币不足，需要 ${BOUQUET_FEE} 金币手工费`, 400)
    }

    // 花束售价 = 3 × 单朵售价 × 1.5
    const singleSell = getFlowerSellPrice(ft, (item.rank || 1) as any)
    const bouquetSell = Math.round(singleSell * 3 * BOUQUET_BONUS)

    // 消耗 3 朵花
    let inventory = user.inventory.map(i =>
      i.id === item.id ? { ...i, quantity: i.quantity - 3 } : i
    ).filter(i => i.quantity > 0)

    // 添加花束
    const bouquetRank = (item.rank || 1) as any
    const existingBouquet = inventory.find(
      i => i.type === 'bouquet' && i.referenceId === `bouquet_${ft.id}` && i.rank === bouquetRank && i.quantity < i.maxStack
    )
    if (existingBouquet) {
      inventory = inventory.map(i =>
        i.id === existingBouquet.id ? { ...i, quantity: i.quantity + 1 } : i
      )
    } else {
      if (inventory.filter(i => i.quantity > 0).length >= user.inventorySize) {
        return jsonResponse(false, null, '背包已满，请先清理', 400)
      }
      inventory.push({
        id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'bouquet',
        referenceId: `bouquet_${ft.id}`,
        name: `${ft.name}花束`,
        emoji: '💐',
        rank: bouquetRank,
        quantity: 1,
        maxStack: 99,
        sellable: true,
        tradeable: true,
      } as InventoryItem)
    }

    const updated = await updateUser(user.id, {
      inventory,
      coins: user.coins - BOUQUET_FEE,
    })

    if (!updated) return jsonResponse(false, null, '合成失败', 500)

    logger.info('garden', '花束合成成功', {
      userId: user.id, flowerType: ft.id, bouquetSell, fee: BOUQUET_FEE,
    })

    await createNotification({
      userId: user.id,
      type: 'plant',
      title: '💐 花束合成',
      content: `用 3 朵 ${ft.name} 合成了一束${ft.name}花束，可售 ${bouquetSell} 金币`,
    })

    return jsonResponse(true, {
      user: sanitizeUser(updated),
      bouquet: { name: `${ft.name}花束`, emoji: '💐', sellPrice: bouquetSell },
      message: `💐 合成成功！获得 ${ft.name}花束，可售 ${bouquetSell} 金币`,
    })
  } catch (e: any) {
    logger.error('garden', '花束合成异常', { error: e?.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
