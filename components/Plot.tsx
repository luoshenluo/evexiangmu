'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { FLOWER_TYPES, SEASON_NAMES, SEASON_COLORS, TOOLS, RankNames, RankColors } from '@/lib/game-data'
import type { Plot as PlotType, InventoryItem, SeedType, PlantedFlower } from '@/lib/types'
import { Lock, Droplets, Sparkles, Bug, Leaf, Coins, AlertTriangle, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import SeedSelector from './SeedSelector'

interface Props {
  plot: PlotType
  onUpdate: () => void
}

// 生长阶段：种子 🌱 → 幼苗 🌿 → 花苞 🪴 → 盛开（花朵本体）
type GrowthStage = 'seed' | 'sprout' | 'bud' | 'bloom'
const STAGE_EMOJI: Record<Exclude<GrowthStage, 'bloom'>, string> = {
  seed: '🌱',
  sprout: '🌿',
  bud: '🪴',
}
const STAGE_SCALE: Record<GrowthStage, number> = {
  seed: 0.7,
  sprout: 0.85,
  bud: 0.95,
  bloom: 1,
}
function getGrowthStage(progress: number, isReady: boolean): GrowthStage {
  if (isReady || progress >= 100) return 'bloom'
  if (progress >= 75) return 'bloom'
  if (progress >= 50) return 'bud'
  if (progress >= 25) return 'sprout'
  return 'seed'
}

export default function Plot({ plot, onUpdate }: Props) {
  const { user, updateUser, showToast, isGuest } = useAppStore()
  const router = useRouter()
  const [showPlant, setShowPlant] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toolPrices, setToolPrices] = useState<Record<string, number>>({})
  const [flowerPrices, setFlowerPrices] = useState<Record<string, number>>({})
  const flower = plot.flower
  const flowerType = flower ? FLOWER_TYPES.find(f => f.id === flower.flowerTypeId) : null

  // 拉取应用了后台价格覆盖后的有效价格（与后端结算口径一致）
  useEffect(() => {
    let alive = true
    apiFetch('/api/market/prices').then(res => {
      if (!alive || !res.success || !res.data) return
      const t: Record<string, number> = {}
      for (const [id, v] of Object.entries(res.data.tools || {})) t[id] = (v as any)?.price ?? 0
      setToolPrices(t)
      const f: Record<string, number> = {}
      for (const [id, v] of Object.entries(res.data.flowers || {})) f[id] = (v as any)?.baseSellPrice ?? 0
      setFlowerPrices(f)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // 工具的单价（优先覆盖价，回退静态价）
  const effToolPrice = (toolId: string): number => {
    const over = toolPrices[toolId]
    if (over && over > 0) return over
    return TOOLS.find(t => t.id === toolId)?.price ?? 0
  }

  // 花朵的官方收购价（优先覆盖价，回退静态价）
  const effFlowerSellPrice = (flowerId: string, rank: number): number => {
    const over = flowerPrices[flowerId]
    const base = over && over > 0 ? over : (FLOWER_TYPES.find(f => f.id === flowerId)?.baseSellPrice ?? 0)
    const rankMultipliers = [1, 1.5, 2.2, 3.2, 5, 8, 15]
    const mul = rankMultipliers[Math.max(0, Math.min(rankMultipliers.length - 1, rank - 1))] || 1
    return Math.floor(base * mul)
  }

  // 从背包获取指定工具的剩余数量
  const getToolCount = (toolRefId: string) => {
    if (!user) return 0
    return user.inventory
      .filter(i => i.type === 'tool' && i.referenceId === toolRefId && i.quantity > 0)
      .reduce((s, i) => s + i.quantity, 0)
  }

  const unlock = async () => {
    if (isGuest) { showToast('请先登录', 'info'); return }
    if (!user || user.coins < plot.unlockPrice) {
      showToast('金币不足！', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/garden/unlock-plot', {
        method: 'POST',
        body: JSON.stringify({ plotId: plot.id })
      })
      if (res.success && res.data) {
        updateUser(res.data)
        showToast(`解锁成功！花费 ${plot.unlockPrice} 金币`, 'success')
        onUpdate()
      } else {
        showToast(res.error || '解锁失败', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const performAction = async (action: 'water' | 'fertilize' | 'pesticide' | 'speedup' | 'harvest') => {
    if (isGuest) { showToast('请先登录', 'info'); return }
    setLoading(true)
    try {
      const res = await apiFetch('/api/garden/plot-action', {
        method: 'POST',
        body: JSON.stringify({ plotId: plot.id, action })
      })
      if (res.success) {
        if (action === 'harvest') {
          // 收获：存入背包（不再直接售卖给金币）
          const fs = res.data?.flowerStored
          showToast(fs
            ? `🌸 收获了 ${fs.name}（${RankNames[(fs.rank || 1) as keyof typeof RankNames] || ''}级），已存入背包，可在市场出售得 ${fs.sellPrice} 💰`
            : (res.data?.message || '🌸 收获成功，花朵已存入背包'), 'success')
        } else {
          const names = { water: '浇水', fertilize: '施肥', pesticide: '除虫', speedup: '加速' }
          showToast(`${names[action as keyof typeof names]}成功！`, 'success')
        }
        if (res.data?.user) updateUser(res.data.user)
        if (res.data?.plot) {
          // 局部刷新
          onUpdate()
        }
        onUpdate()
      } else {
        showToast(res.error || '操作失败', 'error')
      }
    } finally {
      setLoading(false)
      setShowActions(false)
    }
  }

  // 未解锁
  if (!plot.unlocked) {
    return (
      <div
        onClick={unlock}
        className={classNames(
          'aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer plot-hover',
          'border-garden-300/70 bg-gradient-to-br from-garden-50 to-garden-100/50',
          loading && 'opacity-60'
        )}
      >
        <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center mb-2 shadow-sm">
          <Lock size={22} className="text-garden-500" />
        </div>
        <div className="text-xs font-medium text-garden-700 mb-1">解锁 第{plot.id}块</div>
        <div className="flex items-center gap-1 text-amber-600 text-xs font-bold">
          <Coins size={12} />
          {formatNumber(plot.unlockPrice)}
        </div>
      </div>
    )
  }

  // 空地块
  if (!flower || !flowerType) {
    return (
      <>
        <div
          onClick={() => { if (isGuest) { showToast('请先登录', 'info'); return } setShowPlant(true) }}
          className="aspect-square rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer plot-hover overflow-hidden relative bg-gradient-to-br from-amber-100 to-amber-200/80 border-amber-300/60"
        >
          <div className="absolute inset-2 rounded-xl border-2 border-amber-300/40 border-dashed" />
          <Leaf size={32} className="text-amber-600/60 mb-1 animate-pulse-slow" />
          <span className="text-xs font-medium text-amber-800">点击种植</span>
        </div>
        {showPlant && (
          <SeedSelector
            plotId={plot.id}
            onClose={() => setShowPlant(false)}
            onPlanted={() => { setShowPlant(false); onUpdate() }}
          />
        )}
      </>
    )
  }

  // 有花的地块
  const sellPrice = effFlowerSellPrice(flower.flowerTypeId, flower.rank)

  // 生长分阶段：种子→幼苗→花苞→盛开
  const stage = getGrowthStage(flower.growthProgress, flower.isReady)
  const stageEmoji = stage === 'bloom' ? flowerType.emoji : STAGE_EMOJI[stage]
  const stageScale = STAGE_SCALE[stage]

  return (
    <>
      <div
        onClick={() => setShowActions(true)}
        className={classNames(
          'aspect-square rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer plot-hover overflow-hidden relative',
          'bg-gradient-to-br from-garden-100 to-emerald-100 border-garden-200'
        )}
      >
        {/* 生长进度背景条 */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-garden-200/50">
          <div
            className="h-full bg-gradient-to-r from-garden-400 to-garden-500 transition-all duration-500"
            style={{ width: `${flower.growthProgress}%` }}
          />
        </div>

        {/* 花朵（分阶段 + 摇曳动画） */}
        <div className={classNames(
          'relative bloom-anim transition-transform duration-700',
          flower.hasPest && 'shake-anim',
          stage !== 'bloom' && 'sway-anim'
        )}>
          <div
            className="text-5xl transition-all duration-700"
            style={{
              filter: `hue-rotate(${flower.rank * 10}deg)`,
              transform: `scale(${stageScale})`,
            }}
          >
            {stageEmoji}
          </div>
          {flower.hasPest && (
            <div className="absolute -top-1 -right-1">
              <Bug size={16} className="text-red-500" />
            </div>
          )}
          {flower.isReady && (
            <div className="absolute -top-1 -left-1 animate-bounce">
              <Sparkles size={16} className="text-yellow-500" />
            </div>
          )}
        </div>

        {/* 等级标识 */}
        <div
          className="mt-1 chip text-[10px] font-bold shadow-sm"
          style={{ backgroundColor: RankColors[flower.rank] + '33', color: RankColors[flower.rank] }}
        >
          {RankNames[flower.rank]}
        </div>

        {/* 名称 */}
        <div className="text-xs text-slate-700 font-medium mt-0.5">{flowerType.name}</div>

        {/* 底部状态 */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between text-[10px]">
          <div className="flex items-center gap-0.5 text-blue-600 bg-white/80 rounded-full px-1.5 py-0.5">
            <Droplets size={10} />{flower.waterCount}
          </div>
          {flower.isReady ? (
            <div className="flex items-center gap-0.5 text-amber-600 bg-amber-100 rounded-full px-1.5 py-0.5 font-bold">
              <Sparkles size={10} />收获
            </div>
          ) : (
            <div className="text-garden-700 bg-white/80 rounded-full px-1.5 py-0.5 font-medium">
              {flower.growthProgress}%
            </div>
          )}
        </div>
      </div>

      {/* 操作弹窗 */}
      {showActions && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowActions(false)}
        >
          <div
            className="card w-full max-w-md h-[80vh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col slide-up rounded-t-3xl sm:rounded-xl plot-action-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 可滚动内容区 */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 scrollbar-thin">
            {/* 花信息 */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
              <div className={classNames(
                'w-20 h-20 rounded-2xl flex items-center justify-center text-5xl',
                'bg-gradient-to-br from-garden-100 to-emerald-100 border border-garden-200'
              )}>
                {flower.hasPest && <span className="shake-anim">{stageEmoji}</span>}
                {!flower.hasPest && <span className="bloom-anim">{stageEmoji}</span>}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-800">{flowerType.name}</h3>
                  <span
                    className="chip text-xs"
                    style={{ backgroundColor: RankColors[flower.rank] + '33', color: RankColors[flower.rank] }}
                  >
                    {RankNames[flower.rank]}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{flowerType.description}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="flex items-center gap-1 text-slate-600"><Droplets size={12} className="text-blue-500" /> 浇水 {flower.waterCount}</div>
                  <div className="flex items-center gap-1 text-slate-600"><Sparkles size={12} className="text-purple-500" /> 施肥 {flower.fertilizeCount}</div>
                  <div className="flex items-center gap-1 text-slate-600"><Coins size={12} className="text-amber-500" /> 售价 {sellPrice}</div>
                </div>
              </div>
            </div>

            {/* 进度条 */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>生长进度</span>
                <span className="font-bold text-garden-700">{flower.growthProgress}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-garden-400 to-garden-500 transition-all"
                  style={{ width: `${flower.growthProgress}%` }}
                />
              </div>
            </div>

            {/* 虫害提示 */}
            {flower.hasPest && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <div className="font-bold">发现虫害！</div>
                  <div className="text-xs opacity-80 mt-0.5">请立即使用除虫剂消灭害虫，否则将影响花的品质。</div>
                </div>
              </div>
            )}

            {/* 操作按钮：显示道具剩余量，无道具时提示金币价格 */}
            {!flower.isReady && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {(() => {
                    const actions: { key: 'water' | 'fertilize' | 'speedup' | 'pesticide'; toolId: string; label: string; Icon: any; color: string }[] = [
                      { key: 'water', toolId: 'watering_can', label: '浇水', Icon: Droplets, color: 'blue' },
                      { key: 'fertilize', toolId: 'fertilizer', label: '施肥', Icon: Sparkles, color: 'purple' },
                      { key: 'speedup', toolId: 'speedup_card', label: '加速', Icon: Leaf, color: 'yellow' },
                      { key: 'pesticide', toolId: 'pesticide', label: '除虫', Icon: Bug, color: 'red' },
                    ]
                    const colorMap: Record<string, { bg: string; hover: string; border: string; text: string; pulse?: string }> = {
                      blue:   { bg: 'bg-blue-50', hover: 'hover:bg-blue-100',     border: 'border-blue-200',    text: 'text-blue-700' },
                      purple: { bg: 'bg-purple-50', hover: 'hover:bg-purple-100', border: 'border-purple-200',  text: 'text-purple-700' },
                      yellow: { bg: 'bg-yellow-50', hover: 'hover:bg-yellow-100', border: 'border-yellow-200',  text: 'text-yellow-700' },
                      red:    { bg: 'bg-slate-50', hover: 'hover:bg-red-100',    border: 'border-slate-200',   text: 'text-slate-600' },
                    }
                    return actions.map(({ key, toolId, label, Icon, color }) => {
                      const tool = TOOLS.find(t => t.id === toolId)!
                      const cnt = getToolCount(toolId)
                      const hasTool = cnt > 0
                      const cm = color === 'red' && flower.hasPest
                        ? { bg: 'bg-red-50', hover: 'hover:bg-red-100', border: 'border-2 border-red-400 animate-pulse', text: 'text-red-700' }
                        : colorMap[color]
                      const iconClass = color === 'red' && flower.hasPest ? 'text-red-500' : color === 'yellow' ? 'text-yellow-600' : `text-${color}-500`
                      return (
                        <button
                          key={key}
                          onClick={() => performAction(key)}
                          disabled={loading}
                          className={classNames(
                            'flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all active:scale-95 border',
                            cm.bg, cm.hover, cm.border
                          )}
                        >
                          <Icon size={18} className={iconClass} />
                          <span className={classNames('text-xs font-medium', cm.text)}>{label}</span>
                          <span className={classNames(
                            'text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full',
                            hasTool ? 'bg-white/80 text-slate-700' : 'bg-amber-50 text-amber-700'
                          )}>
                            {hasTool ? `剩余 ${cnt}` : `💰${effToolPrice(toolId)}/次`}
                          </span>
                        </button>
                      )
                    })
                  })()}
                </div>
                {/* 道具购买提示 */}
                {(() => {
                  const lacking = ['watering_can', 'fertilizer', 'speedup_card', 'pesticide']
                    .map(id => ({ id, tool: TOOLS.find(t => t.id === id)!, cnt: getToolCount(id) }))
                    .filter(x => x.cnt === 0 && x.tool)
                  if (lacking.length === 0) return null
                  return (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="text-[11px] text-amber-800">
                          <span className="font-bold">💡 道具不足：</span>
                          {lacking.map(x => `${x.tool.name}（${effToolPrice(x.tool.id)}💰）`).join(' · ')}
                          ，无道具时将直接扣除金币使用；也可前往市场购买入背包。
                        </div>
                        <button
                          onClick={() => router.push('/market')}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 transition-all flex items-center gap-1"
                        >
                          <ShoppingCart size={12} /> 去市场
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            {flower.isReady && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
                  <span>售价：{sellPrice} 💰 / 朵（需存入背包后到市场上架出售）</span>
                  <button
                    onClick={() => router.push('/market')}
                    className="text-[11px] font-semibold text-garden-600 hover:text-garden-700 flex items-center gap-0.5"
                  >
                    <ShoppingCart size={12} /> 前往市场
                  </button>
                </div>
              </div>
            )}

            {/* 关闭滚动内容区 */}
            </div>

            {/* Footer 底部按钮区 - 固定不滚动 */}
            <div className="p-5 border-t border-slate-100 flex-shrink-0 space-y-2">
              {flower.isReady && (
                <button
                  onClick={() => performAction('harvest')}
                  disabled={loading}
                  className="w-full btn-primary py-3 text-base bg-gradient-to-r from-garden-500 to-emerald-500 hover:from-garden-600 hover:to-emerald-600"
                >
                  🎁 收获并存入背包
                </button>
              )}
              <button
                onClick={() => setShowActions(false)}
                className="w-full btn-secondary"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
