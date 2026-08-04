import { NextRequest } from 'next/server'
import { ensureSeasonTick, updateUser } from '@/lib/server-store'
import { FLOWER_TYPES } from '@/lib/game-data'
import type { PlantedFlower } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 种植
export async function POST(req: NextRequest) {
  try {
    const gs = await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { plotId, seedId } = await req.json()
    if (!plotId || !seedId) return jsonResponse(false, null, '参数错误', 400)

    logger.debug('garden', '种植请求', { userId: user.id, plotId, seedId, season: gs.currentSeason })

    const plot = user.plots.find(p => p.id === plotId)
    if (!plot || !plot.unlocked) {
      logger.warn('garden', '种植失败：地块无效或未解锁', { userId: user.id, plotId })
      return jsonResponse(false, null, '地块无效或未解锁', 400)
    }
    if (plot.flower) {
      logger.warn('garden', '种植失败：地块已有花', { userId: user.id, plotId, existingFlower: plot.flower.flowerTypeId })
      return jsonResponse(false, null, '该地块已有花', 400)
    }

    // 找到种子
    const seedInv = user.inventory.find(i => i.type === 'seed' && i.referenceId === seedId && i.quantity > 0)
    if (!seedInv) {
      logger.warn('garden', '种植失败：背包中没有该种子', { userId: user.id, seedId })
      return jsonResponse(false, null, '背包中没有该种子', 400)
    }

    // 找到对应花品种
    const seedMatch = seedId.match(/seed_(.+)/)
    const flowerType = FLOWER_TYPES.find(f => seedMatch && f.id === seedMatch[1])
    if (!flowerType) {
      logger.error('garden', '种植失败：种子无效', { userId: user.id, seedId })
      return jsonResponse(false, null, '种子无效', 400)
    }

    // 季节检查
    if (!flowerType.season.includes(gs.currentSeason as any)) {
      logger.info('garden', '种植失败：季节不适宜', {
        userId: user.id, flowerType: flowerType.id, flowerName: flowerType.name,
        currentSeason: gs.currentSeason, requiredSeasons: flowerType.season,
      })
      return jsonResponse(false, null, `当前季节不适宜种植${flowerType.name}`, 400)
    }

    // 减少种子
    const newInventory = user.inventory.map(i =>
      i.id === seedInv.id ? { ...i, quantity: i.quantity - 1 } : i
    ).filter(i => i.quantity > 0)

    // 创建花（包含新增的时间戳字段）
    const now = Date.now()
    const flower: PlantedFlower = {
      id: `flower_${now}_${Math.random().toString(36).slice(2, 7)}`,
      flowerTypeId: flowerType.id,
      rank: 1,
      plantedAt: now,
      waterCount: 0,
      fertilizeCount: 0,
      pestCount: 0,
      hasPest: false,
      pestAt: null,
      growthProgress: 0,
      isReady: false,
      lastWaterAt: null,
      lastFertilizeAt: null,
    }

    const newPlots = user.plots.map(p => p.id === plotId ? { ...p, flower } : p)

    const updatedUser = await updateUser(user.id, {
      plots: newPlots,
      inventory: newInventory,
    })

    logger.info('garden', '种植成功', {
      userId: user.id,
      plotId,
      flowerType: flowerType.id,
      flowerName: flowerType.name,
      season: gs.currentSeason,
      remainingSeeds: seedInv.quantity - 1,
    })

    return jsonResponse(true, { user: sanitizeUser(updatedUser) })
  } catch (e: any) {
    logger.error('garden', '种植异常', { error: e.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
