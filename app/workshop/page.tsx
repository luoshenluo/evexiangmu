'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { FLOWER_TYPES, SEED_TYPES, SEASON_NAMES } from '@/lib/game-data'
import { SEED_TIER_CN } from '@/lib/seed-tiers'
import { RANK_CN } from '@/lib/bouquet-config'
import { Flower2, Sparkles, Coins, Beaker, Gift, ArrowRight, Info, X } from 'lucide-react'
import type { InventoryItem } from '@/lib/types'

type Tab = 'breed' | 'bouquet'

export default function WorkshopPage() {
  const { user, updateUser, showToast, isGuest } = useAppStore()
  const [tab, setTab] = useState<Tab>('breed')
  const [selectedA, setSelectedA] = useState<InventoryItem | null>(null)
  const [selectedB, setSelectedB] = useState<InventoryItem | null>(null)
  const [bouquetSelections, setBouquetSelections] = useState<{ id: string; qty: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [flowerPrices, setFlowerPrices] = useState<Record<string, number>>({})
  const [todayPrices, setTodayPrices] = useState<Record<string, number> | null>(null)

  // 拉取应用了后台价格覆盖后的有效收购价（与后端结算口径一致）
  useEffect(() => {
    let alive = true
    apiFetch('/api/market/prices').then(res => {
      if (!alive || !res.success || !res.data) return
      const f: Record<string, number> = {}
      for (const [id, v] of Object.entries(res.data.flowers || {})) f[id] = (v as any)?.baseSellPrice ?? 0
      setFlowerPrices(f)
    }).catch(() => {})
    apiFetch('/api/workshop/bouquet-prices').then(res => {
      if (!alive || !res.success || !res.data) return
      setTodayPrices(res.data.prices || null)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // 花朵的官方收购价（优先覆盖价，回退静态价）
  const effFlowerSellPrice = (flowerId: string, rank: number): number => {
    const over = flowerPrices[flowerId]
    const base = over && over > 0 ? over : (FLOWER_TYPES.find(f => f.id === flowerId)?.baseSellPrice ?? 0)
    const rankMultipliers = [1, 1.5, 2.2, 3.2, 5, 8, 15]
    const mul = rankMultipliers[Math.max(0, Math.min(rankMultipliers.length - 1, rank - 1))] || 1
    return Math.floor(base * mul)
  }

  // 背包里的种子（用于杂交）
  const seeds = useMemo(() => {
    if (!user) return []
    return user.inventory.filter(i => i.type === 'seed' && i.quantity > 0)
  }, [user])

  // 背包里的花（用于花束合成）
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

  const seedA = selectedA ? SEED_TYPES.find(s => s.id === selectedA.referenceId) : null
  const seedB = selectedB ? SEED_TYPES.find(s => s.id === selectedB.referenceId) : null
  const sellA = seedA ? (seedA.price > 0 ? seedA.price : 10) : 0
  const sellB = seedB ? (seedB.price > 0 ? seedB.price : 10) : 0
  const breedCost = Math.min(sellA, sellB)
  const canBreed = selectedA && selectedB &&
    (selectedA.id !== selectedB.id || selectedA.quantity >= 2) &&
    user.coins >= breedCost

  // 花束选择的花朵详情
  const bouquetFlowers = bouquetSelections
    .map(sel => {
      const item = user.inventory.find(i => i.id === sel.id)
      return item ? { item, qty: sel.qty } : null
    })
    .filter(Boolean) as { item: InventoryItem; qty: number }[]
  const bouquetTotalQty = bouquetSelections.reduce((s, x) => s + x.qty, 0)
  const bouquetMaxRank = bouquetFlowers.length > 0
    ? Math.max(...bouquetFlowers.map(f => (f.item.rank || 1) as number)) as any
    : 1
  const bouquetSell = todayPrices ? (todayPrices[String(bouquetMaxRank)] ?? 0) : 0
  const canCraftBouquet = bouquetTotalQty === 3 && user.coins >= 10

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
    if (!canCraftBouquet) return
    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch('/api/workshop/bouquet', {
        method: 'POST',
        body: JSON.stringify({ items: bouquetFlowers.map(f => ({ id: f.item.id, qty: f.qty })) }),
      })
      if (res.success && res.data) {
        if (res.data.user) updateUser(res.data.user)
        setResult(res.data)
        showToast(res.data.message, 'success')
        setBouquetSelections([])
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
                选择两颗种子进行杂交，消耗金币获得一颗新种子，<span className="text-purple-600 font-medium">结果随机</span>。
                产出花型从两亲本季节中随机选取；阶级为两亲本较低阶级或<span className="text-amber-600 font-medium"> +1 级</span>（最高传说）。
              </div>
            </div>

            {/* 父本选择区 */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {/* 父本 A */}
              <SeedSlot
                item={selectedA}
                label="亲本 A"
                onClick={() => setSelectedA(null)}
              />
              <div className="text-2xl text-pink-400 font-bold">×</div>
              {/* 父本 B */}
              <SeedSlot
                item={selectedB}
                label="亲本 B"
                onClick={() => setSelectedB(null)}
              />
              <ArrowRight size={20} className="text-slate-300" />
              {/* 后代预览 */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 flex items-center justify-center text-2xl">
                  🌱
                </div>
                <div className="text-[10px] text-slate-400 mt-1">随机新种子</div>
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
              选择种子（共 {seeds.length} 种）
            </h3>
            {seeds.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                背包里没有种子，先去花园种植收获或到市场购买吧~
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {seeds.map(item => {
                  const seed = SEED_TYPES.find(s => s.id === item.referenceId)
                  if (!seed) return null
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
                            showToast('同种种子至少需要 2 颗', 'error')
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
                      <div className="text-3xl">🌱</div>
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate">{seed.name}</div>
                      <div className="text-[9px] text-purple-600 font-medium">{SEED_TIER_CN[seed.tier]}</div>
                      <div className="text-[9px] text-slate-400">{seed.season.map(s => SEASON_NAMES[s]).join('/')}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">×{item.quantity}</div>
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
                消耗 <span className="font-bold text-amber-600">3 朵花</span>（同种或不同种均可）+
                <span className="font-bold text-amber-600"> 10 金币</span> 手工费，
                合成花束后卖给官方换金币，<span className="font-bold text-amber-600">花越高级花束越值钱</span>（官方每日 00:01 刷新收购价，最高 1000）
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 flex items-center justify-center text-2xl">
                  🌸
                </div>
                <div className="text-[10px] text-slate-400 mt-1">已选 {bouquetTotalQty}/3</div>
              </div>
              <ArrowRight size={20} className="text-slate-300" />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 flex items-center justify-center text-2xl">
                  💐
                </div>
                <div className="text-[10px] text-slate-400 mt-1">花束</div>
              </div>
            </div>

            {bouquetTotalQty > 0 && (
              <div className="text-center text-sm text-slate-600 mb-3">
                预计售价（今日官方价）：
                <span className="font-bold text-amber-600 flex items-center justify-center gap-1">
                  <Coins size={14} />{bouquetSell}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  {bouquetTotalQty === 3 ? `${RANK_CN[(bouquetMaxRank as 1|2|3|4|5|6|7)] || ''}级花束` : '继续添加花朵'}
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
              选择花（点选凑 3 朵，可同种可不同种）
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
                  const sel = bouquetSelections.find(s => s.id === item.id)
                  const selectedQty = sel?.qty || 0
                  const remaining = 3 - bouquetTotalQty
                  const canAdd = remaining > 0
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (selectedQty > 0) {
                          // 已选：减少 1 或移除
                          if (selectedQty === 1) setBouquetSelections(prev => prev.filter(s => s.id !== item.id))
                          else setBouquetSelections(prev => prev.map(s => s.id === item.id ? { ...s, qty: s.qty - 1 } : s))
                          return
                        }
                        if (!canAdd) { showToast('已选满 3 朵', 'info'); return }
                        const qty = Math.min(item.quantity, remaining)
                        setBouquetSelections(prev => [...prev, { id: item.id, qty }])
                      }}
                      className={classNames(
                        'relative p-2 rounded-xl border-2 transition-all text-center',
                        selectedQty > 0
                          ? 'border-amber-400 bg-amber-50 scale-105'
                          : 'border-slate-100 bg-slate-50 hover:border-amber-200',
                        !canAdd && selectedQty === 0 && 'opacity-50'
                      )}
                    >
                      <div className="text-3xl">{ft.emoji}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5 truncate">{ft.name}</div>
                      <div className={classNames('text-[10px]', item.quantity >= 1 ? 'text-slate-400' : 'text-red-400')}>×{item.quantity}</div>
                      {selectedQty > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 px-1.5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                          {selectedQty}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setResult(null)}>
          <div className="card p-6 max-w-sm w-full text-center slide-up" onClick={e => e.stopPropagation()}>
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
              {result.offspring ? `${result.offspring.tierName || result.offspring.rarity || ''}` : '花束'}
            </div>
            <p className="text-sm text-slate-600">{result.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// 种子插槽组件（杂交亲本）
function SeedSlot({ item, label, onClick }: { item: InventoryItem | null; label: string; onClick: () => void }) {
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
  const seed = SEED_TYPES.find(s => s.id === item.referenceId)
  return (
    <button onClick={onClick} className="flex flex-col items-center group">
      <div className="w-16 h-16 rounded-2xl border-2 border-purple-300 bg-purple-50 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
        🌱
      </div>
      <div className="text-[10px] text-slate-600 mt-1 font-medium">{seed?.name || label}</div>
      <div className="text-[9px] text-purple-600">{seed ? SEED_TIER_CN[seed.tier] : ''}</div>
      <div className="text-[9px] text-slate-400">{seed ? seed.season.map(s => SEASON_NAMES[s]).join('/') : ''} · ×{item.quantity}</div>
    </button>
  )
}
