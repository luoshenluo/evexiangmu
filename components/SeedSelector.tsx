'use client'

import { X, Leaf, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames } from '@/lib/utils'
import { FLOWER_TYPES, SEASON_NAMES, RankNames, RankColors } from '@/lib/game-data'
import type { InventoryItem } from '@/lib/types'

interface Props {
  plotId: number
  onClose: () => void
  onPlanted: () => void
}

export default function SeedSelector({ plotId, onClose, onPlanted }: Props) {
  const { user, updateUser, showToast, gameState } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null)

  const seeds = (user?.inventory || []).filter(i => i.type === 'seed' && i.quantity > 0)
  const currentSeason = gameState?.currentSeason || 'spring'

  const plant = async () => {
    if (!selectedSeed) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/garden/plant', {
        method: 'POST',
        body: JSON.stringify({ plotId, seedId: selectedSeed })
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast('🌱 种植成功！耐心等待花儿长大吧~', 'success')
        onPlanted()
      } else {
        showToast(res.error || '种植失败', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const getSeedInfo = (seedId: string) => {
    const seedMatch = seedId.match(/seed_(.+)/)
    if (!seedMatch) return null
    return FLOWER_TYPES.find(f => f.id === seedMatch[1])
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg max-h-[70vh] sm:max-h-[80vh] overflow-hidden flex flex-col slide-up rounded-t-3xl sm:rounded-xl seed-selector-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0 sm:rounded-t-xl rounded-t-3xl">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Leaf size={20} className="text-garden-500" />
              选择种子
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              当前季节：<span className="font-bold text-garden-600">{SEASON_NAMES[currentSeason]}</span>
              ，非当季花可能无法生长哦
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <X size={20} />
          </button>
        </div>

        {/* 种子列表 */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {seeds.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Leaf size={32} className="text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">背包里还没有种子</p>
              <p className="text-slate-400 text-xs mt-1">去市场购买一些吧~</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {seeds.map((seed) => {
                const flowerInfo = getSeedInfo(seed.referenceId)
                if (!flowerInfo) return null
                const isRightSeason = flowerInfo.season.includes(currentSeason as any)
                const isSelected = selectedSeed === seed.referenceId
                return (
                  <button
                    key={seed.id}
                    onClick={() => setSelectedSeed(seed.referenceId)}
                    disabled={!isRightSeason}
                    className={classNames(
                      'p-2.5 sm:p-3 rounded-2xl border-2 text-left transition-all relative',
                      isSelected
                        ? 'border-garden-500 bg-garden-50 scale-[1.02] shadow-lg shadow-garden-100'
                        : isRightSeason
                          ? 'border-slate-200 bg-white hover:border-garden-300 hover:bg-garden-50/50'
                          : 'border-slate-100 bg-slate-50/50 opacity-60 cursor-not-allowed'
                    )}
                  >
                    {!isRightSeason && (
                      <div className="absolute top-2 right-2 chip bg-red-100 text-red-600 text-[10px]">
                        季节不符
                      </div>
                    )}
                    <div className="flex items-start gap-2 sm:gap-2">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-garden-100 to-garden-200 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                        {isRightSeason ? '🌱' : '🥀'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-sm sm:text-sm truncate">
                          {flowerInfo.name}种子
                        </div>
                        <div className="text-[10px] sm:text-[10px] text-slate-500 mt-0.5">
                          盛开：{flowerInfo.emoji} {flowerInfo.name}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="chip bg-garden-100 text-garden-700 text-[10px]">
                            数量 {seed.quantity}
                          </span>
                          <span
                            className="chip text-[10px] whitespace-nowrap"
                            style={{ backgroundColor: RankColors[flowerInfo.maxRank] + '33', color: RankColors[flowerInfo.maxRank] }}
                          >
                            最高{RankNames[flowerInfo.maxRank]}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {flowerInfo.season.map(s => (
                        <span
                          key={s}
                          className={classNames(
                            'chip text-[10px] px-1.5',
                            s === currentSeason ? 'bg-garden-500 text-white' : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {SEASON_NAMES[s]}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 btn-secondary">
            取消
          </button>
          <button
            onClick={plant}
            disabled={!selectedSeed || loading}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            {loading ? '种植中...' : '确认种植'}
          </button>
        </div>
      </div>
    </div>
  )
}
