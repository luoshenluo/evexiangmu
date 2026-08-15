import { NextRequest } from 'next/server'
import { updateUser, createNotification } from '@/lib/server-store'
import { FLOWER_TYPES } from '@/lib/game-data'
import { getTodayBouquetPrices, RANK_CN } from '@/lib/bouquet-config'
import type { InventoryItem, RankLevel } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 花束合成：消耗 3 朵花（同种或不同种均可）+ 10 金币 → 1 束花束
// 花束等级 = 3 朵花中的最高等级
// 花束售价 = 当日官方随机收购价（每日 00:01 刷新，传说上限 1000）

const BOUQUET_FEE = 10

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    let body: any
    try { body = await req.json() } catch { return jsonResponse(false, null, '请求格式错误', 400) }

    // items: [{ id, qty }] 合计 3 朵
    const items: { id: string; qty: number }[] = body?.items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(false, null, '请选择花朵', 400)
    }
    const totalQty = items.reduce((s, x) => s + (Number(x.qty) || 0), 0)
    if (totalQty !== 3) return jsonResponse(false, null, '需要 3 朵花才能合成花束', 400)

    if (user.coins < BOUQUET_FEE) {
      return jsonResponse(false, null, `金币不足，需要 ${BOUQUET_FEE} 金币手工费`, 400)
    }

    // 校验物品存在且数量充足
    const selected: { item: InventoryItem; qty: number }[] = []
    for (const sel of items) {
      const item = user.inventory.find(i => i.id === sel.id && i.type === 'flower' && i.quantity >= (sel.qty || 0))
      if (!item) return jsonResponse(false, null, '花朵数量不足', 400)
      selected.push({ item, qty: sel.qty })
    }

    // 花束等级 = 最高等级
    let maxRank: RankLevel = 1
    for (const s of selected) {
      const r = (s.item.rank || 1) as RankLevel
      if (r > maxRank) maxRank = r
    }

    // 当日收购价
    const todayPrices = getTodayBouquetPrices()
    const bouquetSell = todayPrices[maxRank]

    // 消耗花朵
    let inventory = user.inventory
    for (const s of selected) {
      inventory = inventory.map(i =>
        i.id === s.item.id ? { ...i, quantity: i.quantity - s.qty } : i
      ).filter(i => i.quantity > 0)
    }

    // 确定花束名称（按最高等级花）
    const topItem = selected.sort((a, b) => ((b.item.rank || 1) - (a.item.rank || 1)))[0]
    const topFt = FLOWER_TYPES.find(f => f.id === topItem.item.referenceId)
    const bouquetName = `${RANK_CN[maxRank]}${topFt?.name || ''}花束`

    // 添加花束
    const existingBouquet = inventory.find(
      i => i.type === 'bouquet' && i.referenceId === `bouquet_${maxRank}` && i.quantity < i.maxStack
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
        referenceId: `bouquet_${maxRank}`,
        name: bouquetName,
        emoji: '💐',
        rank: maxRank,
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
      userId: user.id, rank: maxRank, bouquetSell, fee: BOUQUET_FEE,
    })

    await createNotification({
      userId: user.id,
      type: 'plant',
      title: '💐 花束合成',
      content: `合成了一束${bouquetName}，今日官方收购价 ${bouquetSell} 金币`,
    })

    return jsonResponse(true, {
      user: sanitizeUser(updated),
      bouquet: { name: bouquetName, emoji: '💐', rank: maxRank, sellPrice: bouquetSell },
      message: `💐 合成成功！获得${bouquetName}，今日官方收购价 ${bouquetSell} 金币`,
    })
  } catch (e: any) {
    logger.error('garden', '花束合成异常', { error: e?.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
