import { NextRequest } from 'next/server'
import { authRequest, jsonResponse, userHasPermission, isSuperAdmin } from '@/lib/auth'
import { getAllUsers, listAdminLogs } from '@/lib/server-store'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin) return jsonResponse(false, null, '请先登录', 401)
    if (!admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(admin, 6) && !isSuperAdmin(admin.id)) return jsonResponse(false, null, '无「日志统计」权限', 403)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'overview'

    if (action === 'overview') {
      const users = await getAllUsers()
      const totalUsers = users.length
      const now = Date.now()
      const dayAgo = now - 86400000
      const weekAgo = now - 7 * 86400000
      const monthAgo = now - 30 * 86400000

      const active1d = users.filter(u => u.lastLogin >= dayAgo).length
      const active7d = users.filter(u => u.lastLogin >= weekAgo).length
      const new30d = users.filter(u => u.createdAt >= monthAgo).length
      const banned = users.filter(u => u.bannedUntil && u.bannedUntil > now).length
      const muted = users.filter(u => u.mutedUntil && u.mutedUntil > now).length
      const admins = users.filter(u => u.isAdmin).length

      const totalCoins = users.reduce((s, u) => s + (u.coins || 0), 0)
      const avgCoins = totalUsers > 0 ? Math.floor(totalCoins / totalUsers) : 0
      const richest = [...users].sort((a, b) => b.coins - a.coins).slice(0, 5).map(u => ({ id: u.id, nickname: u.nickname, coins: u.coins, avatar: u.avatar }))

      const unlockedPlots = users.reduce((s, u) => s + u.plots.filter(p => p.unlocked).length, 0)
      const invSize = users.reduce((s, u) => s + u.inventory.filter(i => i.quantity > 0).length, 0)
      const totalPetalCoins = users.reduce((s, u) => s + ((u as any).petalCoins || 0), 0)

      const logs = (await listAdminLogs({ limit: 50 })).items

      return jsonResponse(true, {
        snapshotAt: now,
        users: { totalUsers, active1d, active7d, new30d, banned, muted, admins },
        economy: { totalCoins, avgCoins, richest, totalPetalCoins, unlockedPlots, invSize },
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
