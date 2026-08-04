'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { FLOWER_TYPES, SEASON_NAMES, SEASON_COLORS, TOOLS, getFlowerSellPrice, RankNames, RankColors } from '@/lib/game-data'
import type { Plot as PlotType, InventoryItem, SeedType, PlantedFlower } from '@/lib/types'
import { Lock, Droplets, Sparkles, Bug, Leaf, Coins, AlertTriangle, ChevronLeft, ChevronRight, Store } from 'lucide-react'
import SeedSelector from './SeedSelector'

interface Props {
  plot: PlotType
  onUpdate: () => void
}

export default function Plot({ plot, onUpdate }: Props) {
  const { user, updateUser, showToast } = useAppStore()
  const [showPlant, setShowPlant] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [loading, setLoading] = useState(false)
  const flower = plot.flower
  const flowerType = flower ? FLOWER_TYPES.find(f => f.id === flower.flowerTypeId) : null

  const unlock = async () => {
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
    setLoading(true)
    try {
      const res = await apiFetch('/api/garden/plot-action', {
        method: 'POST',
        body: JSON.stringify({ plotId: plot.id, action })
      })
      if (res.success) {
        if (action === 'harvest') {
          showToast(`🎉 收获成功！获得 ${res.data.rewardName}，金币+${res.data.coinsEarned || 0}`, 'success')
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
          onClick={() => setShowPlant(true)}
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
  const sellPrice = getFlowerSellPrice(flowerType, flower.rank)

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

        {/* 花朵 */}
        <div className={classNames(
          'relative bloom-anim',
          flower.hasPest && 'shake-anim'
        )}>
          <div className="text-5xl" style={{ filter: `hue-rotate(${flower.rank * 10}deg)` }}>
            {flowerType.emoji}
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
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowActions(false)}
        >
          <div
            className="card w-full max-w-md p-5 slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 花信息 */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
              <div className={classNames(
                'w-20 h-20 rounded-2xl flex items-center justify-center text-5xl',
                'bg-gradient-to-br from-garden-100 to-emerald-100 border border-garden-200'
              )}>
                {flower.hasPest && <span className="shake-anim">{flowerType.emoji}</span>}
                {!flower.hasPest && <span className="bloom-anim">{flowerType.emoji}</span>}
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

            {/* 操作按钮 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {!flower.isReady && (
                <>
                  <button
                    onClick={() => performAction('water')}
                    disabled={loading}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all active:scale-95"
                  >
                    <Droplets size={20} className="text-blue-500" />
                    <span className="text-xs font-medium text-blue-700">浇水</span>
                  </button>
                  <button
                    onClick={() => performAction('fertilize')}
                    disabled={loading}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all active:scale-95"
                  >
                    <Sparkles size={20} className="text-purple-500" />
                    <span className="text-xs font-medium text-purple-700">施肥</span>
                  </button>
                  <button
                    onClick={() => performAction('speedup')}
                    disabled={loading}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 transition-all active:scale-95"
                  >
                    <Leaf size={20} className="text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-700">加速</span>
                  </button>
                  <button
                    onClick={() => performAction('pesticide')}
                    disabled={loading}
                    className={classNames(
                      'flex flex-col items-center gap-1 py-3 rounded-xl transition-all active:scale-95',
                      flower.hasPest
                        ? 'bg-red-50 hover:bg-red-100 border-2 border-red-400 animate-pulse'
                        : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                    )}
                  >
                    <Bug size={20} className={flower.hasPest ? 'text-red-500' : 'text-slate-500'} />
                    <span className={classNames(
                      'text-xs font-medium',
                      flower.hasPest ? 'text-red-700' : 'text-slate-600'
                    )}>除虫</span>
                  </button>
                </>
              )}
            </div>

            {flower.isReady && (
              <button
                onClick={() => performAction('harvest')}
                disabled={loading}
                className="w-full btn-primary py-3 mt-3 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                🎉 立即收获（获得金币 +{sellPrice}）
              </button>
            )}

            <button
              onClick={() => setShowActions(false)}
              className="w-full btn-secondary mt-2"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  )
}
