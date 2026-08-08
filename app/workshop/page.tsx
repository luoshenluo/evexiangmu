'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { FLOWER_TYPES, getFlowerSellPrice, RankNames, RankColors } from '@/lib/game-data'
import { Flower2, Sparkles, Coins, Beaker, Gift, ArrowRight, Info, X } from 'lucide-react'
import type { InventoryItem } from '@/lib/types'

type Tab = 'breed' | 'bouquet'

export default function WorkshopPage() {
  const { user, updateUser, showToast, isGuest } = useAppStore()
  const [tab, setTab] = useState<Tab>('breed')
  const [selectedA, setSelectedA] = useState<InventoryItem | null>(null)
  const [selectedB, setSelectedB] = useState<InventoryItem | null>(null)
  const [bouquetSelected, setBouquetSelected] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  // 背包里的花（已收获）
  const flowers = useMemo(() => {
    if (!user) return []
    return user.inventory.filter(i => i.type === 'flower' && i.quantity > 0)
  }, [user])

  if (isGuest) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
        <div className="card p-8 text-center text-slate-400 text-sm">
          <Beaker size={40} className="mx-auto mb-2 text-slate-300" />
          登录后解锁花艺工坊
        </div>
      </div>
    )
  }

  if (!user) {
    return <div className="flex items-center justify-center h-96 text-slate-500">加载中...</div>
  }

  const ftA = selectedA ? FLOWER_TYPES.find(f => f.id === selectedA.referenceId) : null
  const ftB = selectedB ? FLOWER_TYPES.find(f => f.id === selectedB.referenceId) : null
  const sellA = ftA ? getFlowerSellPrice(ftA, (selectedA?.rank || 1) as any) : 0
  const sellB = ftB ? getFlowerSellPrice(ftB, (selectedB?.rank || 1) as any) : 0
  const breedCost = (sellA + sellB) * 2

  const bouquetFt = bouquetSelected ? FLOWER_TYPES.find(f => f.id === bouquetSelected.referenceId) : null
  const bouquetSingleSell = bouquetFt ? getFlowerSellPrice(bouquetFt, (bouquetSelected?.rank || 1) as any) : 0
  const bouquetSell = Math.round(bouquetSingleSell * 3 * 1.5)

  const canBreed = selectedA && selectedB &&
    (selectedA.id !== selectedB.id || selectedA.quantity >= 2) &&
    user.coins >= breedCost

  const canCraftBouquet = bouquetSelected && bouquetSelected.quantity >= 3 && user.coins >= 10

  const handleBreed = async () => {
    if (!selectedA || !selectedB || !canBreed) return
    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch('/api/workshop/breed', {
        method: 'POST',
        body: JSON.stringify({ itemAId: selectedA.id, itemBId: selectedB.id }),
      })
      if (res.success && res.data) {
        if (res.data.user) updateUser(res.data.user)
        setResult(res.data)
        showToast(res.data.message, 'success')
        setSelectedA(null)
        setSelectedB(null)
      } else {
        showToast(res.error || '杂交失败', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBouquet = async () => {
    if (!bouquetSelected || !canCraftBouquet) return
    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch('/api/workshop/bouquet', {
        method: 'POST',
        body: JSON.stringify({ itemId: bouquetSelected.id }),
      })
      if (res.success && res.data) {
        if (res.data.user) updateUser(res.data.user)
        setResult(res.data)
        showToast(res.data.message, 'success')
        setBouquetSelected(null)
      } else {
        showToast(res.error || '合成失败', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const tabs: { k: Tab; label: string; icon: any }[] = [
    { k: 'breed', label: '杂交育种', icon: Beaker },
    { k: 'bouquet', label: '花束合成', icon: Gift },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      {/* 标题 */}
      <div className="card p-4 mb-4 flex items-center gap-3 bg-gradient-to-br from-purple-500 to-pink-500 text-white">
        <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
          <Flower2 size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold">🧬 花艺工坊</h1>
          <div className="text-xs opacity-80">杂交育种 · 花束合成</div>
        </div>
        <div className="ml-auto flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm font-bold">
          <Coins size={14} />
          {formatNumber(user.coins)}
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex gap-1 bg-white rounded-xl p-1 mb-4 shadow-sm border border-garden-100">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.k
          return (
            <button
              key={t.k}
              onClick={() => { setTab(t.k); setResult(null) }}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                active ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 杂交育种 */}
      {tab === 'breed' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-start gap-2 mb-3 text-xs text-slate-500 bg-purple-50 rounded-lg p-2.5">
              <Info size={14} className="flex-shrink-0 mt-0.5 text-purple-500" />
              <div>
                选择两朵花进行杂交，消耗金币获得新种子。
                <span className="text-purple-600 font-medium">60%</span> 继承父本 ·
                <span className="text-blue-600 font-medium"> 30%</span> 升级品质 ·
                <span className="text-amber-600 font-medium"> 10%</span> 稀有突变
              </div>
            </div>

            {/* 父本选择区 */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {/* 父本 A */}
              <FlowerSlot
                item={selectedA}
                label="父本 A"
                onClick={() => { setSelectedA(null); setBouquetSelected(null) }}
              />
              <div className="text-2xl text-pink-400 font-bold">×</div>
              {/* 父本 B */}
              <FlowerSlot
                item={selectedB}
                label="父本 B"
                onClick={() => { setSelectedB(null); setBouquetSelected(null) }}
              />
              <ArrowRight size={20} className="text-slate-300" />
              {/* 后代预览 */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 flex items-center justify-center text-2xl">
                  🌱
                </div>
                <div className="text-[10px] text-slate-400 mt-1">未知种子</div>
              </div>
            </div>

            {/* 成本 */}
            {selectedA && selectedB && (
              <div className="text-center text-sm text-slate-600 mb-3">
                预计成本：
                <span className="font-bold text-amber-600 flex items-center justify-center gap-1">
                  <Coins size={14} />{breedCost}
                </span>
              </div>
            )}

            <button
              onClick={handleBreed}
              disabled={!canBreed || loading}
              className="w-full btn-primary py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
            >
              {loading ? '杂交中...' : '🧬 开始杂交'}
            </button>
          </div>

          {/* 花朵选择列表 */}
          <div className="card p-4">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Flower2 size={16} className="text-pink-500" />
              选择父本（共 {flowers.length} 种花）
            </h3>
            {flowers.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                背包里没有花，先去花园种植并收获吧~
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {flowers.map(item => {
                  const ft = FLOWER_TYPES.find(f => f.id === item.referenceId)
                  if (!ft) return null
                  const isA = selectedA?.id === item.id
                  const isB = selectedB?.id === item.id
                  const used = isA || isB
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isA) { setSelectedA(null); return }
                        if (isB) { setSelectedB(null); return }
                        if (!selectedA) setSelectedA(item)
                        else if (!selectedB) {
                          if (item.id === selectedA.id && item.quantity < 2) {
                            showToast('同种花至少需要 2 朵', 'error')
                            return
                          }
                          setSelectedB(item)
                        } else {
                          setSelectedA(item)
                          setSelectedB(null)
                        }
                      }}
                      className={classNames(
                        'relative p-2 rounded-xl border-2 transition-all text-center',
                        used
                          ? 'border-pink-400 bg-pink-50 scale-105'
                          : 'border-slate-100 bg-slate-50 hover:border-pink-200'
                      )}
                    >
                      <div className="text-3xl">{ft.emoji}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate">{ft.name}</div>
                      <div className="text-[10px] text-slate-400">×{item.quantity}</div>
                      {used && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold">
                          {isA ? 'A' : 'B'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 花束合成 */}
      {tab === 'bouquet' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-start gap-2 mb-3 text-xs text-slate-500 bg-amber-50 rounded-lg p-2.5">
              <Info size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
              <div>
                消耗 <span className="font-bold text-amber-600">3 朵同种花</span> +
                <span className="font-bold text-amber-600"> 10 金币</span> 手工费，
                合成花束后售价为单朵的 <span className="font-bold text-amber-600">4.5 倍</span>（3×1.5）
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-4">
              <FlowerSlot item={bouquetSelected} label="选择花" onClick={() => setBouquetSelected(null)} />
              <ArrowRight size={20} className="text-slate-300" />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 flex items-center justify-center text-2xl">
                  💐
                </div>
                <div className="text-[10px] text-slate-400 mt-1">花束</div>
              </div>
            </div>

            {bouquetSelected && (
              <div className="text-center text-sm text-slate-600 mb-3">
                预计售价：
                <span className="font-bold text-amber-600 flex items-center justify-center gap-1">
                  <Coins size={14} />{bouquetSell}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  （单朵 {bouquetSingleSell} × 3 × 1.5）
                </span>
              </div>
            )}

            <button
              onClick={handleBouquet}
              disabled={!canCraftBouquet || loading}
              className="w-full btn-primary py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
            >
              {loading ? '合成中...' : '💐 合成花束'}
            </button>
          </div>

          <div className="card p-4">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Flower2 size={16} className="text-amber-500" />
              选择花（需 ≥3 朵）
            </h3>
            {flowers.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                背包里没有花，先去花园种植并收获吧~
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {flowers.map(item => {
                  const ft = FLOWER_TYPES.find(f => f.id === item.referenceId)
                  if (!ft) return null
                  const enough = item.quantity >= 3
                  const selected = bouquetSelected?.id === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setBouquetSelected(selected ? null : item)}
                      className={classNames(
                        'relative p-2 rounded-xl border-2 transition-all text-center',
                        !enough && 'opacity-40',
                        selected
                          ? 'border-amber-400 bg-amber-50 scale-105'
                          : 'border-slate-100 bg-slate-50 hover:border-amber-200'
                      )}
                    >
                      <div className="text-3xl">{ft.emoji}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate">{ft.name}</div>
                      <div className={classNames('text-[10px]', enough ? 'text-slate-400' : 'text-red-400')}>×{item.quantity}</div>
                      {selected && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 结果展示 */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setResult(null)}>
          <div className="card p-6 max-w-sm w-full text-center slide-up rounded-t-3xl sm:rounded-xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setResult(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
            <div className="text-6xl mb-2 animate-bounce">
              {result.offspring?.emoji || result.bouquet?.emoji || '✨'}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              {result.offspring ? '杂交成功！' : '合成成功！'}
            </h3>
            <div className="chip bg-purple-50 text-purple-600 mx-auto mb-3">
              {result.offspring ? `${result.offspring.rarity}` : '花束'}
            </div>
            <p className="text-sm text-slate-600">{result.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// 花朵插槽组件
function FlowerSlot({ item, label, onClick }: { item: InventoryItem | null; label: string; onClick: () => void }) {
  if (!item) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
          <Sparkles size={20} />
        </div>
        <div className="text-[10px] text-slate-400 mt-1">{label}</div>
      </div>
    )
  }
  const ft = FLOWER_TYPES.find(f => f.id === item.referenceId)
  return (
    <button onClick={onClick} className="flex flex-col items-center group">
      <div className="w-16 h-16 rounded-2xl border-2 border-pink-300 bg-pink-50 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
        {ft?.emoji || '🌸'}
      </div>
      <div className="text-[10px] text-slate-600 mt-1 font-medium">{ft?.name || label}</div>
      <div className="text-[10px] text-slate-400">×{item.quantity}</div>
    </button>
  )
}
