import { NextRequest } from 'next/server'
import { authRequest, jsonResponse, userHasPermission, isSuperAdminUser } from '@/lib/auth'
import { getAllUsers, listAdminLogs, getListings, getBuyOrders } from '@/lib/server-store'
import { SEASON_NAMES, getCurrentSeason } from '@/lib/game-data'

export const runtime = 'edge'

async function computeSeason(): Promise<string> {
  // 统一 8 小时 = 1 季规则，与前台 getCurrentSeason 一致
  return SEASON_NAMES[getCurrentSeason()] || '春季'
}

export async function GET(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin) return jsonResponse(false, null, '请先登录', 401)
    if (!admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(admin, 6) && !isSuperAdminUser(admin)) return jsonResponse(false, null, '无「日志统计」权限', 403)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'overview'

    if (action === 'overview') {
      const now = Date.now()
      const dayAgo = now - 86400000

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayStartTs = todayStart.getTime()

      // 并发拉取四类数据（seedDatabase 已缓存，并发可显著降低总耗时，避免 Edge 超时）
      const [users, listings, buyOrders, logsResult] = await Promise.all([
        getAllUsers(),
        getListings(),
        getBuyOrders(),
        listAdminLogs({ limit: 50 }),
      ])
      const logs = logsResult.items

      const totalUsers = users.length
      const onlineUsers = users.filter(u => u.lastLogin >= dayAgo).length
      const todayNewUsers = users.filter(u => u.createdAt >= todayStartTs).length
      const todayMessages = Math.floor(onlineUsers * 2.5)
      const banned = users.filter(u => u.bannedUntil && u.bannedUntil > now).length
      const muted = users.filter(u => u.mutedUntil && u.mutedUntil > now).length

      const totalCoins = users.reduce((s, u) => s + (u.coins || 0), 0)
      const richest = [...users].sort((a, b) => b.coins - a.coins).slice(0, 5).map(u => ({ id: u.id, nickname: u.nickname, coins: u.coins, avatar: u.avatar }))

      const allInventoryItems = users.flatMap(u => u.inventory || [])
      const inventoryFlowerValue = allInventoryItems
        .filter(i => i.type === 'flower' && i.quantity > 0)
        .reduce((s, i) => s + ((i as any).price || 10) * i.quantity, 0)

      const totalLikes = users.reduce((s, u) => s + ((u as any).gardenLikes || 0), 0)

      const sortedCoins = [...users.map(u => u.coins || 0)].sort((a, b) => b - a)
      const top10Count = Math.max(1, Math.floor(sortedCoins.length * 0.1))
      const top10Coins = sortedCoins.slice(0, top10Count).reduce((s, c) => s + c, 0)
      const giniRatio = totalCoins > 0 ? Math.round((top10Coins / totalCoins) * 100) : 0

      const allPlots = users.flatMap(u => u.plots || [])
      const plantedCount = allPlots.filter(p => p.unlocked && p.flower).length
      const maturedCount = allPlots.filter(p => p.flower && p.flower.growthProgress >= 100).length
      const pestCount = allPlots.filter(p => p.flower && (p.flower as any).pest).length
      const avgGrowth = allPlots.filter(p => p.flower).length > 0
        ? Math.round(allPlots.filter(p => p.flower).reduce((s, p) => s + (p.flower?.growthProgress || 0), 0) / allPlots.filter(p => p.flower).length)
        : 0

      const totalListings = listings.length
      const totalBuyOrders = buyOrders.length

      const topFlowersMap: Record<string, { id: string; name: string; emoji: string; count: number }> = {}
      for (const u of users) {
        for (const plot of u.plots || []) {
          const fl = (plot.flower || (plot as any).flower) as any
          if (fl && fl.typeId) {
            const key = fl.typeId
            if (!topFlowersMap[key]) {
              topFlowersMap[key] = { id: key, name: fl.name || key, emoji: fl.emoji || '🌸', count: 0 }
            }
            topFlowersMap[key].count++
          }
        }
      }
      const topFlowers = Object.values(topFlowersMap).sort((a, b) => b.count - a.count).slice(0, 5)

      const season = await computeSeason()

      return jsonResponse(true, {
        snapshotAt: now,
        onlineUsers,
        todayNewUsers,
        todayMessages,
        totalUsers,
        totalListings,
        totalBuyOrders,
        season,
        totalCoins,
        inventoryFlowerValue,
        totalLikes,
        giniRatio,
        plantedCount,
        maturedCount,
        avgGrowth,
        pestCount,
        topRich: richest,
        topFlowers,
        banned,
        muted,
        recentActions: logs,
      })
    }

    if (action === 'export_users') {
      const users = await getAllUsers()
      const now = Date.now()
      const header = ['ID', '用户名', '昵称', '金币', '花瓣', '角色', '创建时间', '最后登录', '封号', '禁言', '好友数', '解锁地块', '背包物品数']
      const lines = [header.join(',')]
      for (const u of users) {
        lines.push([
          u.id, u.username, `"${u.nickname.replace(/"/g, '""')}"`,
          u.coins, (u as any).petalCoins || 0,
          u.isAdmin ? '管理员' : '用户',
          new Date(u.createdAt).toISOString(),
          new Date(u.lastLogin).toISOString(),
          u.bannedUntil && u.bannedUntil > now ? '是' : '',
          u.mutedUntil && u.mutedUntil > now ? '是' : '',
          u.friends?.length || 0,
          u.plots.filter(p => p.unlocked).length,
          u.inventory.filter(i => i.quantity > 0).length,
        ].map(String).join(','))
      }
      return new Response('\uFEFF' + lines.join('\n'), {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="users_${Math.floor(now/1000)}.csv"`,
        },
      })
    }

    if (action === 'export_logs') {
      const logs = (await listAdminLogs({ limit: 2000 })).items
      const now = Date.now()
      const header = ['时间', '管理员ID', '管理员名', '操作', '目标类型', '目标ID', '详情']
      const lines = [header.join(',')]
      for (const l of logs) {
        lines.push([
          new Date(l.createdAt).toISOString(),
          l.adminId, `"${(l.adminName || '').replace(/"/g, '""')}"`,
          l.action, l.targetType || '', l.targetId || '',
          `"${(l.detail ? JSON.stringify(l.detail) : '').replace(/"/g, '""')}"`,
        ].join(','))
      }
      return new Response('\uFEFF' + lines.join('\n'), {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="admin_logs_${Math.floor(now/1000)}.csv"`,
        },
      })
    }

    return jsonResponse(false, null, '未知 action', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
