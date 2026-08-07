import { NextRequest } from 'next/server'
import {
  getAllUsers, getGameState, getListings, getBuyOrders, getMessages,
} from '@/lib/server-store'
import { getSupabase } from '@/lib/supabase'
import { authRequest, jsonResponse } from '@/lib/auth'
import { SEASON_NAMES, FLOWER_TYPES, getFlowerSellPrice } from '@/lib/game-data'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)

    const [users, gs, listings, buyOrders, messages] = await Promise.all([
      getAllUsers(),
      getGameState(),
      getListings(),
      getBuyOrders(),
      getMessages('world', 1000),
    ])

    const now = Date.now()
    const todayStart = now - 24 * 60 * 60 * 1000

    const todayNewUsers = users.filter(u => u.createdAt > todayStart).length
    const todayMessages = messages.filter(m => m.timestamp > todayStart).length
    const onlineUsers = users.filter(u => now - u.lastLogin < 10 * 60 * 1000).length

    // ========== 经济指标 ==========
    // 全服金币总量
    const totalCoins = users.reduce((sum, u) => sum + (u.coins || 0), 0)
    // 全服种植中的花
    let plantedCount = 0
    let maturedCount = 0
    let pestCount = 0
    let totalGrowthSum = 0
    let plantsWithGrowth = 0
    const flowerTypeCount: Record<string, number> = {}
    for (const u of users) {
      for (const p of u.plots || []) {
        if (p.unlocked && p.flower) {
          plantedCount++
          totalGrowthSum += p.flower.growthProgress || 0
          plantsWithGrowth++
          if (p.flower.isReady) maturedCount++
          if (p.flower.hasPest) pestCount++
          flowerTypeCount[p.flower.flowerTypeId] = (flowerTypeCount[p.flower.flowerTypeId] || 0) + 1
        }
      }
    }
    const avgGrowth = plantsWithGrowth > 0 ? Math.round(totalGrowthSum / plantsWithGrowth) : 0

    // 全服背包花朵估值（潜在金币）
    let inventoryFlowerValue = 0
    const inventoryFlowerCount: Record<string, number> = {}
    for (const u of users) {
      for (const item of u.inventory || []) {
        if (item.type === 'flower' && item.quantity > 0) {
          const ft = FLOWER_TYPES.find(f => f.id === item.referenceId)
          if (ft) {
            inventoryFlowerValue += getFlowerSellPrice(ft, (item.rank || 1) as any) * item.quantity
            inventoryFlowerCount[item.referenceId] = (inventoryFlowerCount[item.referenceId] || 0) + item.quantity
          }
        }
      }
    }

    // 金币分布（贫富差距）
    const sortedCoins = users.map(u => u.coins || 0).sort((a, b) => b - a)
    const top10Coins = sortedCoins.slice(0, Math.max(1, Math.floor(sortedCoins.length * 0.1))).reduce((a, b) => a + b, 0)
    const giniRatio = totalCoins > 0 ? Math.round((top10Coins / totalCoins) * 100) : 0

    // 市场指标
    const officialListings = listings.filter(l => l.isOfficial).length
    const playerListings = listings.filter(l => !l.isOfficial).length
    const officialOrders = buyOrders.filter(o => o.isOfficial).length
    const playerOrders = buyOrders.filter(o => !o.isOfficial).length

    // 花园点赞总数（从 garden_likes 表）
    let totalLikes = 0
    try {
      const sb = getSupabase()
      const { count } = await sb.from('garden_likes').select('*', { count: 'exact', head: true })
      totalLikes = count || 0
    } catch {}

    // 最受欢迎的花型 Top 5
    const topFlowers = Object.entries(flowerTypeCount)
      .map(([id, count]) => ({
        id,
        name: FLOWER_TYPES.find(f => f.id === id)?.name || id,
        emoji: FLOWER_TYPES.find(f => f.id === id)?.emoji || '🌸',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // 金币排行 Top 5
    const topRich = users
      .map(u => ({ id: u.id, nickname: u.nickname, avatar: u.avatar, coins: u.coins || 0 }))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 5)

    return jsonResponse(true, {
      // 基础
      totalUsers: users.length,
      todayNewUsers,
      onlineUsers,
      todayMessages,
      totalListings: listings.length,
      totalBuyOrders: buyOrders.length,
      season: SEASON_NAMES[gs.currentSeason],
      seasonStartAt: gs.seasonStartAt,
      // 经济
      totalCoins,
      giniRatio,
      inventoryFlowerValue,
      totalLikes,
      // 种植
      plantedCount,
      maturedCount,
      pestCount,
      avgGrowth,
      topFlowers,
      // 市场
      officialListings,
      playerListings,
      officialOrders,
      playerOrders,
      // 排行
      topRich,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
