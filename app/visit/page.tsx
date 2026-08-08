'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { FLOWER_TYPES, RankNames, RankColors } from '@/lib/game-data'
import { ChevronLeft, Users, Coins, Shield, Bug, Sparkles, Search, Heart, Droplets } from 'lucide-react'

interface RankedUser {
  id: string
  nickname: string
  avatar: string
  coins: number
  value: number
}

interface VisitedPlot {
  id: number
  unlocked: boolean
  unlockPrice: number
  flower: {
    flowerTypeId: string
    rank: 1 | 2 | 3 | 4 | 5 | 6 | 7
    growthProgress: number
    isReady: boolean
    hasPest: boolean
    waterCount: number
    fertilizeCount: number
  } | null
  canSteal: boolean
  canWater?: boolean
}

interface VisitedGarden {
  user: { id: string; nickname: string; avatar: string; coins: number }
  isSelf: boolean
  isFriend: boolean
  isProtected: boolean
  canSteal: boolean
  stealCountToday: number
  stealLimit: number
  likeCount?: number
  liked?: boolean
  friendWaterRemaining?: number
  plots: VisitedPlot[]
}

export default function VisitPage() {
  const { user, updateUser, showToast } = useAppStore()
  const [tab, setTab] = useState<'list' | 'garden'>('list')
  const [rankedUsers, setRankedUsers] = useState<RankedUser[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [garden, setGarden] = useState<VisitedGarden | null>(null)
  const [stealing, setStealing] = useState<number | null>(null)
  const [watering, setWatering] = useState<number | null>(null)
  const [liking, setLiking] = useState(false)

  // 加载排行榜作为玩家列表
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch<RankedUser[]>('/api/rankings?type=coins')
        if (res.success && res.data) {
          setRankedUsers(res.data.filter(u => u.id !== user?.id))
        }
      } catch {}
    }
    load()
  }, [user?.id])

  const visitGarden = async (userId: string) => {
    setLoading(true)
    setTargetId(userId)
    try {
      const res = await apiFetch<VisitedGarden>(`/api/garden/visit/${userId}`)
      if (res.success && res.data) {
        setGarden(res.data)
        setTab('garden')
      } else {
        showToast(res.error || '访问失败', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSteal = async (plotId: number) => {
    if (!targetId) return
    setStealing(plotId)
    try {
      const res = await apiFetch<any>('/api/garden/steal', {
        method: 'POST',
        body: JSON.stringify({ victimId: targetId, plotId }),
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast(res.data?.message || '偷花成功！', 'success')
        // 重新加载花园
        await visitGarden(targetId)
      } else {
        showToast(res.error || res.data?.message || '偷花失败', 'error')
      }
    } finally {
      setStealing(null)
    }
  }

  const handleLike = async () => {
    if (!targetId || !garden) return
    setLiking(true)
    try {
      const res = await apiFetch<any>('/api/garden/like', {
        method: 'POST',
        body: JSON.stringify({ targetId }),
      })
      if (res.success && res.data) {
        setGarden({ ...garden, liked: res.data.liked, likeCount: res.data.count })
        showToast(res.data.liked ? '已点赞 ❤️' : '已取消点赞', 'success')
      } else {
        showToast(res.error || '操作失败', 'error')
      }
    } finally {
      setLiking(false)
    }
  }

  const handleWater = async (plotId: number) => {
    if (!targetId) return
    setWatering(plotId)
    try {
      const res = await apiFetch<any>('/api/garden/water-friend', {
        method: 'POST',
        body: JSON.stringify({ targetId, plotId }),
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast(res.data?.message || '浇水成功！', 'success')
        await visitGarden(targetId)
      } else {
        showToast(res.error || res.data?.message || '浇水失败', 'error')
      }
    } finally {
      setWatering(null)
    }
  }

  const filteredUsers = rankedUsers.filter(u =>
    !search || u.nickname.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      {/* 顶部 */}
      <div className="flex items-center gap-3 mb-4">
        {tab === 'garden' && (
          <button
            onClick={() => { setTab('list'); setGarden(null); setTargetId(null) }}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users size={22} className="text-garden-600" />
          {tab === 'list' ? '访问玩家花园' : `${garden?.user.nickname || ''}的花园`}
        </h1>
      </div>

      {/* 玩家列表 */}
      {tab === 'list' && (
        <>
          <div className="card p-3 mb-4">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索玩家昵称..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="card p-8 text-center text-slate-400 text-sm">
              {loading ? '加载中...' : '暂无其他玩家'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u, idx) => (
                <div
                  key={u.id}
                  className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => visitGarden(u.id)}
                >
                  <div className="text-xs font-bold text-slate-400 w-6">#{idx + 1}</div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-garden-100 to-emerald-100 flex items-center justify-center text-xl">
                    {u.avatar || '🌱'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800">{u.nickname}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Coins size={11} /> {formatNumber(u.coins)}
                    </div>
                  </div>
                  <div className="text-xs text-garden-600 font-medium px-3 py-1.5 rounded-lg bg-garden-50">
                    访问 →
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 text-center text-xs text-slate-400">
            💡 访问其他玩家花园可以偷取已成熟的花，每日限 3 次
          </div>
        </>
      )}

      {/* 访问的花园 */}
      {tab === 'garden' && garden && (
        <>
          {/* 花园主人信息 */}
          <div className="card p-4 mb-4 flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-garden-200 to-emerald-200 flex items-center justify-center text-2xl shadow-md">
              {garden.user.avatar || '🌱'}
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-800 text-lg">{garden.user.nickname}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="flex items-center gap-0.5"><Coins size={11} /> {formatNumber(garden.user.coins)}</span>
                {garden.isFriend && <span className="text-garden-600">· 好友</span>}
                {typeof garden.likeCount === 'number' && (
                  <span className="flex items-center gap-0.5 text-pink-500">
                    · <Heart size={11} className={garden.liked ? 'fill-pink-500' : ''} /> {garden.likeCount}
                  </span>
                )}
              </div>
            </div>
            {garden.isProtected && (
              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                <Shield size={12} /> 受保护
              </div>
            )}
            {!garden.isSelf && (
              <button
                onClick={handleLike}
                disabled={liking}
                className={classNames(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  garden.liked
                    ? 'bg-pink-100 text-pink-600 border border-pink-200'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-pink-200 hover:text-pink-500'
                )}
              >
                <Heart size={14} className={garden.liked ? 'fill-pink-500' : ''} />
                {garden.liked ? '已赞' : '点赞'}
              </button>
            )}
          </div>

          {/* 偷花 + 好友浇水状态 */}
          {!garden.isSelf && (
            <div className="card p-3 mb-4 flex items-center justify-between text-sm bg-slate-50">
              <div className="flex items-center gap-2">
                {garden.canSteal ? (
                  <>
                    <Sparkles size={16} className="text-amber-500" />
                    <span className="text-slate-700">
                      偷花 <span className="font-bold text-amber-600">
                        {garden.stealLimit - garden.stealCountToday}
                      </span>/{garden.stealLimit}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">偷花次数已用完</span>
                )}
              </div>
              {typeof garden.friendWaterRemaining === 'number' && (
                <div className="flex items-center gap-1 text-slate-600">
                  <Droplets size={14} className="text-blue-500" />
                  帮浇水 <span className="font-bold text-blue-600">{garden.friendWaterRemaining}</span>/5
                </div>
              )}
            </div>
          )}

          {/* 花园地块 */}
          <div className="grid grid-cols-3 gap-2.5">
            {garden.plots.filter(p => p.unlocked).map((p) => {
              const ft = p.flower ? FLOWER_TYPES.find(f => f.id === p.flower!.flowerTypeId) : null
              return (
                <div
                  key={p.id}
                  className={classNames(
                    'aspect-square rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden',
                    p.flower
                      ? 'bg-gradient-to-br from-garden-100 to-emerald-100 border-garden-200'
                      : 'bg-amber-50 border-amber-200/60 border-dashed'
                  )}
                >
                  {p.flower && ft ? (
                    <>
                      <div className={classNames('text-4xl', p.flower.hasPest && 'shake-anim')}>
                        {ft.emoji}
                      </div>
                      {p.flower.hasPest && (
                        <div className="absolute top-1 right-1">
                          <Bug size={12} className="text-red-500" />
                        </div>
                      )}
                      {p.flower.isReady && (
                        <div className="absolute top-1 left-1">
                          <Sparkles size={12} className="text-yellow-500" />
                        </div>
                      )}
                      <div
                        className="mt-0.5 chip text-[9px] font-bold"
                        style={{
                          backgroundColor: RankColors[p.flower.rank] + '33',
                          color: RankColors[p.flower.rank],
                        }}
                      >
                        {RankNames[p.flower.rank]}
                      </div>
                      <div className="text-[10px] text-slate-600">{ft.name}</div>
                      {!p.flower.isReady && (
                        <div className="text-[10px] text-slate-500">{p.flower.growthProgress}%</div>
                      )}
                      {p.canSteal && p.flower.isReady && !garden.isSelf && (
                        <button
                          onClick={() => handleSteal(p.id)}
                          disabled={stealing === p.id}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold hover:bg-black/50 transition-colors"
                        >
                          {stealing === p.id ? '偷取中...' : '🤏 偷花'}
                        </button>
                      )}
                      {p.canWater && !p.flower.isReady && !garden.isSelf && (
                        <button
                          onClick={() => handleWater(p.id)}
                          disabled={watering === p.id}
                          className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
                          title="帮好友浇水"
                        >
                          <Droplets size={14} className={watering === p.id ? 'animate-spin' : ''} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="text-3xl opacity-30">🌿</div>
                  )}
                </div>
              )
            })}
          </div>

          {garden.isSelf && (
            <div className="mt-6 text-center text-xs text-slate-400">
              这是你自己的花园～
            </div>
          )}
        </>
      )}
    </div>
  )
}
