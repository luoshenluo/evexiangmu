import { getAllUsers, ensureSeasonTick } from '@/lib/server-store'
import { FLOWER_TYPES, getFlowerSellPrice } from '@/lib/game-data'
import { sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'coins'

    const users = await getAllUsers()
    const ranked = users
      .map(u => {
        let value = u.coins
        if (type === 'flowers') {
          // 花朵收藏数（背包里的花）
          value = u.inventory.filter(i => i.type === 'flower').reduce((s, i) => s + i.quantity, 0)
          // 加已种植的
          value += u.plots.filter(p => p.flower).length
        } else if (type === 'family') {
          value = Math.floor(Math.random() * 100) // MVP 模拟
        } else {
          // 总资产 = 金币 + 花价值
          u.inventory.forEach(i => {
            if (i.type === 'flower') {
              const ft = FLOWER_TYPES.find(f => f.id === i.referenceId)
              if (ft) value += getFlowerSellPrice(ft, i.rank || 1) * i.quantity
            }
          })
        }
        return { ...sanitizeUser(u), value }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 50)

    return jsonResponse(true, ranked)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
