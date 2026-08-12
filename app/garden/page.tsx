'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { SEASON_NAMES, SEASON_COLORS, getSeasonByMonth } from '@/lib/game-data'
import { Sun, Coins, Package, Bell, ChevronLeft, ChevronRight, Sparkles, Users } from 'lucide-react'
import Plot from '@/components/Plot'
import Link from 'next/link'
import type { Plot as PlotType } from '@/lib/types'

export default function GardenPage() {
  const { user, updateUser, gameState, announcements, showToast, isGuest } = useAppStore()
  const gardenBg = useAppStore(s => s.gardenBg)  // 顶层 Hook（必须在任何 early return 之前）
  // 按月份优先计算季节，确保与真实天文季节一致，避免 DB 旧值导致不一致
  const currentSeason = getSeasonByMonth()
  const [page, setPage] = useState(0)
  const [tick, setTick] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const plotsPerPage = 9
  const totalPages = user ? Math.ceil(user.plots.length / plotsPerPage) : 1
  const startIdx = page * plotsPerPage

  // 定期刷新（游客跳过：不调用 pest-check，也不轮询 /api/user/{id}）
  useEffect(() => {
    if (isGuest) { setLoaded(true); return }

    const refresh = async () => {
      if (!user?.id) return
      try {
        const res = await apiFetch(`/api/user/${user.id}`)
        if (res.success && res.data) {
          updateUser(res.data)
        }
      } catch {}
    }

    // 虫灾检查（每次进入花园页面时调用一次）
    const checkPest = async () => {
      if (!user?.id) return
      try {
        const res = await apiFetch<any>('/api/garden/pest-check', { method: 'POST' })
        if (res.success && res.data) {
          if (res.data.user) updateUser(res.data.user)
          if (res.data.pestEvent) {
            const sev = res.data.pestEvent.severity
            const sevName = sev === 'minor' ? '轻微' : sev === 'major' ? '严重' : '灾难性'
            showToast(`🐛 遭遇${sevName}虫灾！${res.data.pestEvent.affectedPlots?.length || 0}块地受影响`, 'error')
          }
          if (res.data.deadFlowers?.length > 0) {
            showToast(`💀 ${res.data.deadFlowers.length}朵花因虫害死亡`, 'error')
          }
        }
      } catch {}
    }

    // 离线收益结算（每次进入花园页面时调用一次）
    const settleOffline = async () => {
      if (!user?.id) return
      try {
        const res = await apiFetch<any>('/api/garden/offline-settle', { method: 'POST' })
        if (res.success && res.data) {
          if (res.data.user) updateUser(res.data.user)
          if (res.data.settledCount > 0 || res.data.maturedCount > 0) {
            showToast(res.data.message, 'success')
          }
        }
      } catch {}
    }

    settleOffline()
    refresh()
    checkPest()
    const i = setInterval(() => {
      setTick(t => t + 1)
      refresh()
    }, 5000)
    setLoaded(true)
    return () => clearInterval(i)
  }, [user?.id, isGuest])

  // 游客模式：显示示例花园（3 块解锁的空地），不调用任何写接口
  if (isGuest) {
    const guestPlots: PlotType[] = [
      { id: 1, unlocked: true, unlockPrice: 0, flower: null },
      { id: 2, unlocked: true, unlockPrice: 0, flower: null },
      { id: 3, unlocked: true, unlockPrice: 0, flower: null },
    ]
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-[100px]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
        {/* 游客横幅 */}
        <div className="mb-4 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <Sparkles size={14} className="flex-shrink-0" />
          <span>你是游客模式，登录后解锁完整玩法</span>
        </div>

        {/* 季节：统一加白色半透明底层 + 深色文字，保证任意渐变背景下都清晰可读 */}
        <div className={`card p-0 mb-4 overflow-hidden bg-gradient-to-br ${
          SEASON_COLORS[currentSeason] || SEASON_COLORS.spring
        }`}>
          <div className="p-3 flex items-center gap-3 bg-white/55 backdrop-blur-[1px] text-slate-900">
            <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
              <Sun size={20} className="text-amber-600" />
            </div>
            <div>
              <div className="text-[11px] text-slate-600/90">当前季节</div>
              <div className="text-lg font-bold text-slate-900">
                {SEASON_NAMES[currentSeason] || '春季'}
              </div>
            </div>
          </div>
        </div>

        {/* 花园标题 */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            🌳 游客预览
          </h1>
        </div>

        {/* 示例地块 */}
        <div className="grid grid-cols-3 gap-2.5">
          {guestPlots.map((p) => (
            <Plot key={p.id} plot={p} onUpdate={() => setTick(t => t + 1)} />
          ))}
        </div>

        {/* 提示 */}
        <div className="mt-6 text-center text-xs text-slate-400">
          💡 登录后即可种植、浇水、施肥、收获，经营属于你的花园！
        </div>
      </div>
    )
  }

  // 未登录（非游客）阶段：交给 ClientLayout 的欢迎遮罩处理即可，这里渲染空占位
  if (!user) return null

  const unlockedCount = user.plots.filter(p => p.unlocked).length
  const plantedCount = user.plots.filter(p => p.unlocked && p.flower).length

  // 花园背景
  const GARDEN_BG_MAP: Record<string, string> = {
    default: 'from-green-400 via-emerald-400 to-teal-500',
    green:   'from-emerald-300 via-green-400 to-lime-400',
    purple:  'from-purple-300 via-violet-400 to-fuchsia-400',
    blue:    'from-sky-300 via-cyan-400 to-blue-500',
    sunset:  'from-amber-300 via-orange-400 to-rose-400',
    sakura:  'from-pink-200 via-rose-300 to-pink-400',
    autumn:  'from-amber-400 via-orange-500 to-red-500',
    night:   'from-slate-700 via-indigo-800 to-slate-900',
    ocean:   'from-cyan-400 via-blue-500 to-indigo-600',
  }
  const bgClass = GARDEN_BG_MAP[gardenBg] || GARDEN_BG_MAP.default
  const bgIsDark = gardenBg === 'night'

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      {/* 顶部状态栏 */}
      <div className="card p-3 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-garden-400 to-garden-600 flex items-center justify-center text-xl shadow-md shadow-garden-200">
            {user.avatar || '🌱'}
          </div>
          <div>
            <div className="font-bold text-slate-800">{user.nickname}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory" className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors min-h-[44px] flex items-center justify-center">
            <Package size={20} className="text-slate-600" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
              {user.inventory.filter(i => i.quantity > 0).length}
            </span>
          </Link>
          <Link href="/profile" className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors min-h-[44px] flex items-center justify-center">
            <Bell size={20} className="text-slate-600" />
            {announcements.filter(a => a.priority === 'urgent').length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </Link>
          <Link href="/visit" className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors min-h-[44px] flex items-center justify-center" title="访问好友花园">
            <Users size={20} className="text-slate-600" />
          </Link>
        </div>
      </div>

      {/* 重要公告 */}
      {loaded && announcements.filter(a => a.priority === 'urgent' || a.priority === 'important').slice(0, 2).map((a) => (
        <div
          key={a.id}
          className={`mb-3 px-3 py-2 rounded-xl text-xs flex items-start gap-2 ${
            a.priority === 'urgent'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          <Sparkles size={14} className="flex-shrink-0 mt-0.5" />
          <div className="line-clamp-2">
            <span className="font-bold mr-1">{a.title}</span>
            {a.content.split('\n')[0]}
          </div>
        </div>
      ))}

      {/* 金币 + 季节 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md shadow-amber-200">
            <Coins size={20} className="text-white" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500">金币</div>
            <div className="text-lg font-bold text-amber-600">{formatNumber(user.coins)}</div>
          </div>
        </div>
        {/* 季节：统一加白色半透明底层 + 深色文字，保证任意渐变背景下都清晰可读 */}
        <div className={`card p-0 overflow-hidden bg-gradient-to-br ${
          SEASON_COLORS[currentSeason] || SEASON_COLORS.spring
        }`}>
          <div className="p-3 flex items-center gap-3 bg-white/55 backdrop-blur-[1px] text-slate-900">
            <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
              <Sun size={20} className="text-amber-600" />
            </div>
            <div>
              <div className="text-[11px] text-slate-600/90">当前季节</div>
              <div className="text-lg font-bold text-slate-900">
                {SEASON_NAMES[currentSeason] || '春季'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="card py-2 px-2">
          <div className="text-xs text-slate-500">已解锁</div>
          <div className="text-sm font-bold text-garden-700">{unlockedCount}/30</div>
        </div>
        <div className="card py-2 px-2">
          <div className="text-xs text-slate-500">种植中</div>
          <div className="text-sm font-bold text-garden-700">{plantedCount}</div>
        </div>
        <div className="card py-2 px-2">
          <div className="text-xs text-slate-500">背包</div>
          <div className="text-sm font-bold text-garden-700">{user.inventorySize}格</div>
        </div>
      </div>

      {/* 花园标题 */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          🌳 我的花园
          <span className="text-xs font-normal text-slate-400">
            第 {page + 1} / {totalPages} 页
          </span>
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 min-h-[44px] flex items-center"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 min-h-[44px] flex items-center"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 九宫格地块 */}
      <div className={classNames('rounded-2xl p-3 bg-gradient-to-br shadow-inner relative overflow-hidden', bgClass, bgIsDark ? 'text-white' : '')}>
        <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.25),transparent_45%)]" />
        <div className="grid grid-cols-3 gap-2.5 relative">
          {Array.from({ length: plotsPerPage }).map((_, i) => {
            const plotIdx = startIdx + i
            const plot = user.plots[plotIdx]
            if (!plot) return <div key={i} className="aspect-square" />
            return <Plot key={plot.id} plot={plot} onUpdate={() => setTick(t => t + 1)} />
          })}
        </div>
      </div>

      {/* 提示 */}
      <div className="mt-6 text-center text-xs text-slate-400">
        💡 小贴士：多浇水施肥可以让花朵长得更快，品质更高哦！
      </div>
    </div>
  )
}
