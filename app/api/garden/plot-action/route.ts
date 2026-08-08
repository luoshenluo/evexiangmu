import { NextRequest } from 'next/server'
import { updateUser, ensureSeasonTick, createNotification, incrementTaskProgress } from '@/lib/server-store'
import { FLOWER_TYPES, TOOLS, getFlowerSellPrice, PEST_CONFIG } from '@/lib/game-data'
import type { InventoryItem, PlantedFlower } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

type Action = 'water' | 'fertilize' | 'pesticide' | 'speedup' | 'harvest'

const ACTION_TOOL_MAP: Record<Exclude<Action, 'harvest'>, string> = {
  water: 'watering_can',
  fertilize: 'fertilizer',
  pesticide: 'pesticide',
  speedup: 'speedup_card',
}

function rankLabel(r: number): string {
  return ['', '普通', '优秀', '良好', '稀有', '史诗', '传奇', '钻石'][r] || '普通'
}

function addInventoryItem(
  inventory: InventoryItem[],
  item: Partial<InventoryItem> & Pick<InventoryItem, 'name' | 'type' | 'referenceId' | 'emoji'>,
  inventorySize: number
): InventoryItem[] {
  const existing = inventory.find(
    i => i.type === item.type && i.referenceId === item.referenceId && (!item.rank || i.rank === item.rank)
  )
  if (existing && existing.quantity < existing.maxStack) {
    return inventory.map(i =>
      i.id === existing.id
        ? { ...i, quantity: Math.min(existing.maxStack, i.quantity + (item.quantity || 1)) }
        : i
    )
  }
  if (inventory.filter(i => i.quantity > 0).length >= inventorySize) {
    throw new Error('背包已满，请先清理或扩容')
  }
  return [
    ...inventory,
    {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: item.type,
      referenceId: item.referenceId,
      name: item.name,
      emoji: item.emoji,
      rank: item.rank,
      quantity: item.quantity || 1,
      maxStack: item.maxStack || 99,
      sellable: item.sellable ?? true,
      tradeable: item.tradeable ?? true,
    } as InventoryItem,
  ]
}

function consumeTool(inventory: InventoryItem[], toolId: string): InventoryItem[] | null {
  const item = inventory.find(i => i.type === 'tool' && i.referenceId === toolId && i.quantity > 0)
  if (!item) return null
  return inventory.map(i =>
    i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i
  ).filter(i => i.quantity > 0)
}

export async function POST(req: NextRequest) {
  try {
    const gs = await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { plotId, action } = await req.json()
    if (!plotId || !action) return jsonResponse(false, null, '参数错误', 400)

    const plot = user.plots.find(p => p.id === plotId)
    if (!plot || !plot.unlocked) return jsonResponse(false, null, '地块无效', 400)

    // 收获逻辑 → 存入背包，不再直接售卖
    if (action === 'harvest') {
      if (!plot.flower || !plot.flower.isReady) {
        logger.warn('garden', '收获失败：花未成熟', { userId: user.id, plotId, progress: plot.flower?.growthProgress })
        return jsonResponse(false, null, '花还未成熟，不能收获', 400)
      }
      const flowerType = FLOWER_TYPES.find(f => f.id === plot.flower!.flowerTypeId)
      if (!flowerType) return jsonResponse(false, null, '花朵类型异常', 400)

      // 将花朵加入背包
      let newInventory = [...user.inventory]
      try {
        newInventory = addInventoryItem(newInventory, {
          type: 'flower',
          referenceId: flowerType.id,
          name: flowerType.name,
          emoji: flowerType.emoji,
          rank: plot.flower.rank,
          quantity: 1,
          maxStack: 99,
          sellable: true,
          tradeable: true,
        }, user.inventorySize)
      } catch (e: any) {
        return jsonResponse(false, null, e.message, 400)
      }

      const newPlots = user.plots.map(p => p.id === plotId ? { ...p, flower: null } : p)
      const updated = await updateUser(user.id, { plots: newPlots, inventory: newInventory })

      const sellPrice = getFlowerSellPrice(flowerType, plot.flower.rank)

      await createNotification({
        userId: user.id,
        type: 'harvest',
        title: '🌸 收获成功',
        content: `收获了 ${flowerType.name}（${rankLabel(plot.flower.rank)}级），已存入背包，出售可得 ${sellPrice} 💰`,
      })

      // 任务进度：收获季节（日） + 大收藏家（月）
      try { await incrementTaskProgress(user.id, 'harvest', 1) } catch {}

      logger.info('garden', '收获成功', {
        userId: user.id, plotId,
        flowerType: flowerType.id, flowerName: flowerType.name,
        rank: plot.flower.rank, sellPrice,
        waterCount: plot.flower.waterCount, fertilizeCount: plot.flower.fertilizeCount,
        plantedAt: plot.flower.plantedAt, harvestedAt: Date.now(),
        growthDuration: Date.now() - plot.flower.plantedAt,
      })

      return jsonResponse(true, {
        user: sanitizeUser(updated),
        flowerStored: {
          type: flowerType.id,
          name: flowerType.name,
          emoji: flowerType.emoji,
          rank: plot.flower.rank,
          sellPrice,
        },
        message: `🌸 收获了 ${flowerType.name}，已存入背包`,
      })
    }

    // 其他行动都需要有花
    if (!plot.flower) return jsonResponse(false, null, '该地块没有种植', 400)

    if (action === 'pesticide') {
      // 无论是否有虫都可以使用，预防
    }

    const toolId = ACTION_TOOL_MAP[action as Exclude<Action, 'harvest'>]
    const newInv = consumeTool(user.inventory, toolId)
    let coins = user.coins

    if (!newInv) {
      // 允许直接扣除金币购买使用
      const tool = TOOLS.find(t => t.id === toolId)
      if (!tool) return jsonResponse(false, null, '道具不足，请先购买', 400)
      if (user.coins < tool.price) {
        return jsonResponse(false, null, `道具不足（${tool.name}），且金币不够购买`, 400)
      }
      logger.info('garden', '道具不足，使用金币购买', { userId: user.id, toolId, toolPrice: tool.price })
      coins = user.coins - tool.price
      return await executeAction(user, plotId, action, user.inventory, coins, gs.currentSeason)
    }

    return await executeAction(user, plotId, action, newInv, coins, gs.currentSeason)
  } catch (e: any) {
    logger.error('garden', '操作异常', { error: e.message })
    return jsonResponse(false, null, e.message, 500)
  }
}

async function executeAction(
  user: any,
  plotId: number,
  action: Action,
  inventory: InventoryItem[],
  coins: number,
  currentSeason: string
) {
  const plot = user.plots.find((p: any) => p.id === plotId)
  if (!plot?.flower) return jsonResponse(false, null, '地块无效', 400)

  const f: PlantedFlower = { ...plot.flower }
  const flowerType = FLOWER_TYPES.find(ft => ft.id === f.flowerTypeId)
  if (!flowerType) return jsonResponse(false, null, '花朵类型异常', 400)

  const now = Date.now()
  let addProgress = 0
  const prevProgress = f.growthProgress
  const prevRank = f.rank

  switch (action) {
    case 'water':
      f.waterCount++
      f.lastWaterAt = now
      addProgress = 3 + f.waterCount * 0.5
      logger.info('garden', '浇水', {
        userId: user.id, plotId, flowerType: f.flowerTypeId,
        waterCount: f.waterCount, addProgress, prevProgress,
        timeSinceLastWater: f.lastWaterAt ? now - (plot.flower.lastWaterAt || now) : null,
      })
      break
    case 'fertilize':
      f.fertilizeCount++
      f.lastFertilizeAt = now
      addProgress = 15
      logger.info('garden', '施肥', {
        userId: user.id, plotId, flowerType: f.flowerTypeId,
        fertilizeCount: f.fertilizeCount, addProgress, prevProgress,
        timeSinceLastFertilize: f.lastFertilizeAt ? now - (plot.flower.lastFertilizeAt || now) : null,
      })
      break
    case 'pesticide':
      f.hasPest = false
      f.pestAt = null
      addProgress = 2
      logger.info('garden', '除虫', {
        userId: user.id, plotId, flowerType: f.flowerTypeId,
        hadPest: plot.flower.hasPest, pestCount: f.pestCount,
      })
      break
    case 'speedup':
      addProgress = 30
      logger.info('garden', '加速', {
        userId: user.id, plotId, flowerType: f.flowerTypeId,
        addProgress, prevProgress,
      })
      break
  }

  // 随机虫害（每次操作后小概率触发，除虫操作除外）
  if (Math.random() < PEST_CONFIG.singlePestChance && !f.hasPest && action !== 'pesticide') {
    f.hasPest = true
    f.pestAt = now
    f.pestCount++
    logger.warn('pest', '单株虫害触发', {
      userId: user.id, plotId, flowerType: f.flowerTypeId,
      action, pestCount: f.pestCount,
    })
  }

  // 有虫灾时生长速度降低
  if (f.hasPest) addProgress *= 0.3

  f.growthProgress = Math.min(100, f.growthProgress + addProgress)

  // 根据打理程度计算等级
  const totalCare = f.waterCount + f.fertilizeCount * 3
  let targetRank = 1
  if (totalCare >= 2 && f.growthProgress > 40) targetRank = 2
  if (totalCare >= 5 && f.growthProgress > 55) targetRank = 3
  if (totalCare >= 9 && f.growthProgress > 70) targetRank = 4
  if (totalCare >= 15 && f.growthProgress > 82) targetRank = 5
  if (totalCare >= 22 && f.growthProgress > 92) targetRank = 6
  if (totalCare >= 30 && f.growthProgress >= 100) targetRank = 7
  targetRank = Math.min(targetRank, flowerType.maxRank)
  f.rank = Math.max(f.rank, targetRank) as PlantedFlower['rank']

  // 等级提升日志
  if (f.rank > prevRank) {
    logger.info('garden', '花朵等级提升', {
      userId: user.id, plotId, flowerType: f.flowerTypeId,
      prevRank, newRank: f.rank, totalCare, growthProgress: f.growthProgress,
    })
  }

  // 到达100时标记成熟
  if (f.growthProgress >= 100) {
    f.isReady = true
    f.growthProgress = 100
    if (!plot.flower.isReady) {
      logger.info('garden', '花朵成熟', {
        userId: user.id, plotId, flowerType: f.flowerTypeId,
        rank: f.rank, totalCare, growthDuration: now - f.plantedAt,
      })
    }
  }

  const newPlots = user.plots.map((p: any) => p.id === plotId ? { ...p, flower: f } : p)
  const updated = await updateUser(user.id, { plots: newPlots, inventory, coins })

  // 任务进度：根据操作类型推进每日任务 + 周常花园扩张
  if (action === 'water' || action === 'fertilize' || action === 'pesticide' || action === 'speedup') {
    try { await incrementTaskProgress(user.id, action, 1) } catch {}
  }

  return jsonResponse(true, {
    user: sanitizeUser(updated),
    plot: updated?.plots.find((p: any) => p.id === plotId),
  })
}
