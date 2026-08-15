import { NextRequest } from 'next/server'
import { updateUser, createNotification, getFlowerSellPriceEffective } from '@/lib/server-store'
import { FLOWER_TYPES } from '@/lib/game-data'
import type { InventoryItem } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 杂交育种：消耗 2 朵已收获的花 + 金币 → 获得 1 颗杂交种子
// 规则：
//   60% 概率：继承随机父本花型
//   30% 概率：升级到售价 >= 较高父本 的随机花型（含稀有）
//   10% 概率：直接获得最稀有的「梅花」种子（若双亲均为梅花则给荷花）
//   金币成本 = (父本A售价 + 父本B售价) × 2

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    let body: any
    try { body = await req.json() } catch { return jsonResponse(false, null, '请求格式错误', 400) }

    const { itemAId, itemBId } = body
    if (!itemAId || !itemBId) return jsonResponse(false, null, '请选择两朵花', 400)
    if (itemAId === itemBId) return jsonResponse(false, null, '请选择两朵不同的花（数量需≥2）', 400)

    const itemA = user.inventory.find(i => i.id === itemAId && i.type === 'flower' && i.quantity > 0)
    const itemB = user.inventory.find(i => i.id === itemBId && i.type === 'flower' && i.quantity > 0)
    if (!itemA || !itemB) return jsonResponse(false, null, '找不到可用的花', 400)

    // 同一朵花需要数量≥2
    if (itemA.referenceId === itemB.referenceId) {
      const same = user.inventory.find(i => i.id === itemAId && i.quantity >= 2)
      if (!same) return jsonResponse(false, null, '同种花至少需要 2 朵', 400)
    }

    const ftA = FLOWER_TYPES.find(f => f.id === itemA.referenceId)
    const ftB = FLOWER_TYPES.find(f => f.id === itemB.referenceId)
    if (!ftA || !ftB) return jsonResponse(false, null, '花型异常', 400)

    // 金币成本（应用价格覆盖，取两花回收价较低者，保证育种有正期望）
    const sellA = await getFlowerSellPriceEffective(itemA.referenceId, (itemA.rank || 1) as any)
    const sellB = await getFlowerSellPriceEffective(itemB.referenceId, (itemB.rank || 1) as any)
    const cost = Math.min(sellA, sellB)
    if (user.coins < cost) {
      return jsonResponse(false, null, `金币不足，需要 ${cost} 金币`, 400)
    }

    // 决定后代花型
    const roll = Math.random()
    let offspringType: typeof ftA
    let rarity = '普通'
    if (roll < 0.1) {
      // 10% 稀有突变
      if (ftA.id === 'plum' && ftB.id === 'plum') {
        offspringType = FLOWER_TYPES.find(f => f.id === 'lotus')!
        rarity = '稀有'
      } else {
        offspringType = FLOWER_TYPES.find(f => f.id === 'plum')!
        rarity = '稀有突变'
      }
    } else if (roll < 0.4) {
      // 30% 升级：选择售价 >= 较高父本 的花型
      const higherSell = Math.max(ftA.baseSellPrice, ftB.baseSellPrice)
      const candidates = FLOWER_TYPES.filter(f => f.baseSellPrice >= higherSell)
      offspringType = pick(candidates.length > 0 ? candidates : [ftA, ftB])
      rarity = '优质'
    } else {
      // 60% 继承父本
      offspringType = Math.random() < 0.5 ? ftA : ftB
      rarity = '继承'
    }

    // 消耗 2 朵花（处理同种花数量）
    let inventory = user.inventory
    const consumeOne = (inv: InventoryItem[], id: string, referenceId: string): InventoryItem[] => {
      // 优先消耗指定 id 的；若同种且需要二次消耗同一格，扣 2
      return inv.map(i => {
        if (i.id === id && i.referenceId === referenceId && i.type === 'flower' && i.quantity > 0) {
          return { ...i, quantity: i.quantity - 1 }
        }
        return i
      }).filter(i => i.quantity > 0)
    }

    inventory = consumeOne(inventory, itemA.id, itemA.referenceId)
    // 如果 A 和 B 是同一格（同种），第二次仍扣同一格（此时数量已 -1，再 -1 共 -2）
    if (itemA.referenceId === itemB.referenceId) {
      inventory = consumeOne(inventory, itemA.id, itemA.referenceId)
    } else {
      inventory = consumeOne(inventory, itemB.id, itemB.referenceId)
    }

    // 添加杂交种子
    const seedId = `seed_${offspringType.id}`
    const existingSeed = inventory.find(i => i.type === 'seed' && i.referenceId === seedId && i.quantity < i.maxStack)
    if (existingSeed) {
      inventory = inventory.map(i =>
        i.id === existingSeed.id ? { ...i, quantity: i.quantity + 1 } : i
      )
    } else {
      if (inventory.filter(i => i.quantity > 0).length >= user.inventorySize) {
        return jsonResponse(false, null, '背包已满，请先清理', 400)
      }
      inventory.push({
        id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'seed',
        referenceId: seedId,
        name: `${offspringType.name}种子`,
        emoji: '🌱',
        quantity: 1,
        maxStack: 99,
        sellable: false,
        tradeable: true,
      } as InventoryItem)
    }

    const updated = await updateUser(user.id, {
      inventory,
      coins: user.coins - cost,
    })

    if (!updated) return jsonResponse(false, null, '杂交失败', 500)

    logger.info('garden', '杂交育种成功', {
      userId: user.id,
      parentA: ftA.id, parentB: ftB.id,
      offspring: offspringType.id, rarity, cost,
    })

    await createNotification({
      userId: user.id,
      type: 'plant',
      title: '🧬 杂交成功',
      content: `用 ${ftA.name} × ${ftB.name} 培育出 ${offspringType.name}种子（${rarity}），花费 ${cost} 金币`,
    })

    return jsonResponse(true, {
      user: sanitizeUser(updated),
      offspring: {
        flowerTypeId: offspringType.id,
        name: offspringType.name,
        emoji: offspringType.emoji,
        rarity,
      },
      cost,
      message: `🧬 杂交成功！获得 ${offspringType.name}种子（${rarity}）`,
    })
  } catch (e: any) {
    logger.error('garden', '杂交异常', { error: e?.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
