import { NextRequest } from 'next/server'
import { updateUser, createNotification, incrementTaskProgress } from '@/lib/server-store'
import { FLOWER_TYPES, SEED_TYPES } from '@/lib/game-data'
import { hybridResultTier, pickFlowerFromSeasons, SEED_TIER_CN } from '@/lib/seed-tiers'
import type { InventoryItem, SeedTier } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 杂交育种：消耗 2 颗种子 + 金币 → 获得 1 颗新种子
// 规则（结果随机，UI 已声明）：
//   产出花型：从两亲本季节并集的花池中随机选一种
//   产出阶级：取两亲本较低阶级 或 +1 级（各 50%），传说封顶
//   成本：取两亲本价格较低者（无官方价的种子按 10 金币算）

const NO_PRICE_COST = 10

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    let body: any
    try { body = await req.json() } catch { return jsonResponse(false, null, '请求格式错误', 400) }

    const { itemAId, itemBId } = body
    if (!itemAId || !itemBId) return jsonResponse(false, null, '请选择两颗种子', 400)
    if (itemAId === itemBId) return jsonResponse(false, null, '请选择两颗不同的种子（数量需≥2）', 400)

    const itemA = user.inventory.find(i => i.id === itemAId && i.type === 'seed' && i.quantity > 0)
    const itemB = user.inventory.find(i => i.id === itemBId && i.type === 'seed' && i.quantity > 0)
    if (!itemA || !itemB) return jsonResponse(false, null, '找不到可用的种子', 400)

    // 同一格种子需要数量≥2
    if (itemA.referenceId === itemB.referenceId) {
      const same = user.inventory.find(i => i.id === itemAId && i.quantity >= 2)
      if (!same) return jsonResponse(false, null, '同种种子至少需要 2 颗', 400)
    }

    const seedA = SEED_TYPES.find(s => s.id === itemA.referenceId)
    const seedB = SEED_TYPES.find(s => s.id === itemB.referenceId)
    if (!seedA || !seedB) return jsonResponse(false, null, '种子异常', 400)

    // 成本：取两亲本价格较低者（无官方价种子按固定值）
    const priceA = seedA.price > 0 ? seedA.price : NO_PRICE_COST
    const priceB = seedB.price > 0 ? seedB.price : NO_PRICE_COST
    const cost = Math.min(priceA, priceB)
    if (user.coins < cost) {
      return jsonResponse(false, null, `金币不足，需要 ${cost} 金币`, 400)
    }

    // 决定后代阶级（阶梯式）与花型（随机）
    const offspringTier: SeedTier = hybridResultTier(seedA.tier, seedB.tier)
    const seasons = [...new Set([...seedA.season, ...seedB.season])]
    const flowerPool = FLOWER_TYPES.map(f => {
      const s = SEED_TYPES.find(x => x.flowerTypeId === f.id)!
      return { id: f.id, season: f.season, tier: s.tier, maxRank: f.maxRank }
    })
    const offspringFlower = pickFlowerFromSeasons(flowerPool, seasons, offspringTier)
    const offspringSeed = SEED_TYPES.find(s => s.flowerTypeId === offspringFlower.id)!

    // 消耗 2 颗种子（处理同种数量）
    let inventory = user.inventory
    const consumeOne = (inv: InventoryItem[], id: string): InventoryItem[] => {
      return inv.map(i => {
        if (i.id === id && i.type === 'seed' && i.quantity > 0) {
          return { ...i, quantity: i.quantity - 1 }
        }
        return i
      }).filter(i => i.quantity > 0)
    }

    inventory = consumeOne(inventory, itemA.id)
    if (itemA.referenceId === itemB.referenceId) {
      inventory = consumeOne(inventory, itemA.id)
    } else {
      inventory = consumeOne(inventory, itemB.id)
    }

    // 添加杂交种子
    const existingSeed = inventory.find(i => i.type === 'seed' && i.referenceId === offspringSeed.id && i.quantity < i.maxStack)
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
        referenceId: offspringSeed.id,
        name: offspringSeed.name,
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

    // 推进杂交任务
    try { await incrementTaskProgress(user.id, 'breed', 1) } catch {}

    logger.info('garden', '杂交育种成功', {
      userId: user.id,
      parentA: seedA.id, parentB: seedB.id,
      offspring: offspringSeed.id, tier: offspringTier, cost,
    })

    await createNotification({
      userId: user.id,
      type: 'plant',
      title: '🧬 杂交成功',
      content: `用 ${seedA.name} × ${seedB.name} 培育出 ${offspringSeed.name}（${SEED_TIER_CN[offspringTier]}），花费 ${cost} 金币`,
    })

    return jsonResponse(true, {
      user: sanitizeUser(updated),
      offspring: {
        seedId: offspringSeed.id,
        name: offspringSeed.name,
        emoji: offspringSeed.emoji,
        tier: offspringTier,
        tierName: SEED_TIER_CN[offspringTier],
      },
      cost,
      message: `🧬 杂交成功！获得 ${offspringSeed.name}（${SEED_TIER_CN[offspringTier]}）`,
    })
  } catch (e: any) {
    logger.error('garden', '杂交异常', { error: e?.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
