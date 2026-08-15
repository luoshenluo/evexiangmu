'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { RankNames, RankColors, getInventoryExpandPrice, FLOWER_TYPES } from '@/lib/game-data'
import { Package, Trash2, Tag, Droplets, Sparkles, Bug, Zap, Plus, X, Coins, ShoppingCart } from 'lucide-react'
import type { InventoryItem } from '@/lib/types'

export default function InventoryPage() {
  const router = useRouter()
  const { user, updateUser, showToast } = useAppStore()
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [flowerPrices, setFlowerPrices] = useState<Record<string, number>>({})

  // 拉取应用了后台价格覆盖后的有效收购价（与后端结算口径一致）
  useEffect(() => {
    let alive = true
    apiFetch('/api/market/prices').then(res => {
      if (!alive || !res.success || !res.data) return
      const f: Record<string, number> = {}
      for (const [id, v] of Object.entries(res.data.flowers || {})) f[id] = (v as any)?.baseSellPrice ?? 0
      setFlowerPrices(f)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const usedSlots = user ? user.inventory.filter(i => i.quantity > 0).length : 0
  const expandPrice = user ? getInventoryExpandPrice(user.inventorySize) : 100

  const expandInventory = async () => {
    if (!user || user.coins < expandPrice) {
      showToast('金币不足！', 'error')
      return
    }
    setLoading('expand')
    try {
      const res = await apiFetch('/api/inventory/expand', { method: 'POST' })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast(`扩容成功！花费 ${expandPrice} 金币`, 'success')
      } else {
        showToast(res.error || '扩容失败', 'error')
      }
    } finally {
      setLoading(null)
    }
  }

  const discardItem = async () => {
    if (!selectedItem) return
    if (!confirm(`确定丢弃 1 个 ${selectedItem.name} 吗？`)) return
    setLoading('discard')
    try {
      const res = await apiFetch('/api/inventory/discard', {
        method: 'POST',
        body: JSON.stringify({ itemId: selectedItem.id, quantity: 1 })
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast(`已丢弃 1 个 ${selectedItem.name}`, 'info')
        setSelectedItem(null)
      } else {
        showToast(res.error || '操作失败', 'error')
      }
    } finally {
      setLoading(null)
    }
  }

  // 计算花朵官方收购价（用户提示用途，应用后台价格覆盖）
  const getOfficialPrice = (item: InventoryItem): number | null => {
    if (item.type !== 'flower') return null
    const ft = FLOWER_TYPES.find(f => f.id === item.referenceId)
    if (!ft) return null
    const over = flowerPrices[ft.id]
    const base = over && over > 0 ? over : ft.baseSellPrice
    const rankMultipliers = [1, 1.5, 2.2, 3.2, 5, 8, 15]
    const mul = rankMultipliers[Math.max(0, Math.min(rankMultipliers.length - 1, (item.rank || 1) - 1))] || 1
    return Math.floor(base * mul)
  }

  const sellItem = async () => {
    if (!selectedItem || !selectedItem.sellable) return
    // 鲜花：跳转到市场上架（直接出售的bug修复）；非鲜花（种子/道具）仍可直接卖给官方
    if (selectedItem.type === 'flower') {
      const officialPrice = getOfficialPrice(selectedItem)
      const ok = confirm(
        `鲜花不能直接出售。请前往市场上架挂售，可自行设定价格；\n官方收购价约 ${officialPrice} 💰 / 朵，是否前往市场？`
      )
      if (ok) router.push('/market')
      return
    }
    setLoading('sell')
    try {
      const res = await apiFetch('/api/inventory/sell', {
        method: 'POST',
        body: JSON.stringify({ itemId: selectedItem.id, quantity: 1 })
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast(`出售成功！获得 ${res.data.coinsEarned || 0} 金币`, 'success')
        setSelectedItem(null)
      } else {
        showToast(res.error || '出售失败', 'error')
      }
    } finally {
      setLoading(null)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'flower': return { label: '鲜花', color: 'bg-pink-100 text-pink-700' }
      case 'seed': return { label: '种子', color: 'bg-garden-100 text-garden-700' }
      case 'tool': return { label: '道具', color: 'bg-blue-100 text-blue-700' }
      default: return { label: '其他', color: 'bg-slate-100 text-slate-700' }
    }
  }

  const getTypeIcon = (type: string, refId?: string) => {
    if (refId?.includes('water')) return <Droplets size={20} />
    if (refId?.includes('fertil')) return <Sparkles size={20} />
    if (refId?.includes('pest')) return <Bug size={20} />
    if (refId?.includes('speed') || refId?.includes('speedup')) return <Zap size={20} />
    if (type === 'seed') return <Package size={20} />
    if (type === 'flower') return <Tag size={20} />
    return <Package size={20} />
  }

  if (!user) {
    return <div className="p-8 text-center text-slate-500">加载中...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      {/* 顶部 */}
      <div className="card p-3 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-200">
            <Package size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">我的背包</h1>
            <p className="text-xs text-slate-500">已使用 {usedSlots} / {user.inventorySize} 格</p>
          </div>
        </div>
        <button
          onClick={expandInventory}
          disabled={loading === 'expand' || user.coins < expandPrice}
          className={classNames(
            'px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-all',
            user.coins >= expandPrice
              ? 'bg-garden-500 text-white hover:bg-garden-600 active:scale-95'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          )}
        >
          <Plus size={14} />
          扩容 {formatNumber(expandPrice)}
        </button>
      </div>

      {/* 容量条 */}
      <div className="mb-4">
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={classNames(
              'h-full transition-all rounded-full',
              usedSlots / user.inventorySize > 0.8
                ? 'bg-gradient-to-r from-red-400 to-red-500'
                : 'bg-gradient-to-r from-garden-400 to-garden-500'
            )}
            style={{ width: `${(usedSlots / user.inventorySize) * 100}%` }}
          />
        </div>
      </div>

      {/* 背包网格 */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-6">
        {Array.from({ length: user.inventorySize }).map((_, idx) => {
          const item = user.inventory.filter(i => i.quantity > 0)[idx]
          const typeInfo = item ? getTypeLabel(item.type) : null
          return (
            <button
              key={idx}
              onClick={() => item && setSelectedItem(item)}
              className={classNames(
                'aspect-square rounded-xl border-2 flex flex-col items-center justify-center relative transition-all',
                item
                  ? 'bg-white border-slate-200 hover:border-garden-400 hover:shadow-lg cursor-pointer active:scale-95'
                  : 'bg-slate-50/70 border-dashed border-slate-200'
              )}
            >
              {item ? (
                <>
                  <div className="text-2xl mb-0.5">{item.emoji}</div>
                  {/* 等级标签：仅鲜花显示，工具/种子不显示 */}
                  {item.type === 'flower' && item.rank && (
                    <span
                      className="absolute top-1 left-1 text-[9px] px-1 rounded font-bold"
                      style={{ backgroundColor: RankColors[item.rank], color: 'white' }}
                    >
                      {RankNames[item.rank]}
                    </span>
                  )}
                  {/* 数量标签：工具用蓝底、鲜花/种子用 typeInfo 颜色 */}
                  <span
                    className={classNames(
                      'absolute top-1 right-1 text-[10px] px-1.5 rounded-full font-bold',
                      item.type === 'tool' ? 'bg-blue-100 text-blue-700' : (typeInfo?.color || 'bg-slate-100 text-slate-700')
                    )}
                  >
                    ×{item.quantity}
                  </span>
                  {/* 工具名称小字 */}
                  {item.type === 'tool' && (
                    <span className="absolute bottom-1 text-[9px] text-slate-500 font-medium truncate px-1">
                      {item.name}
                    </span>
                  )}
                </>
              ) : (
                <div className="text-slate-300 text-xs">空格</div>
              )}
            </button>
          )
        })}
      </div>

      {/* 物品详情弹窗 */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="card w-full max-w-md h-[70vh] sm:h-auto sm:max-h-[80vh] overflow-hidden flex flex-col slide-up rounded-t-3xl sm:rounded-2xl inventory-item-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 内容滚动区 */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 scrollbar-thin">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 flex items-center justify-center text-5xl relative">
                {selectedItem.emoji}
                {/* 等级标签：仅鲜花显示 */}
                {selectedItem.type === 'flower' && selectedItem.rank && (
                  <span
                    className="absolute -top-2 -left-2 chip text-xs font-bold"
                    style={{ backgroundColor: RankColors[selectedItem.rank], color: 'white' }}
                  >
                    {RankNames[selectedItem.rank]}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-800">{selectedItem.name}</h3>
                  <span className={classNames('chip text-[10px]', getTypeLabel(selectedItem.type).color)}>
                    {getTypeLabel(selectedItem.type).label}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">数量: {selectedItem.quantity} / {selectedItem.maxStack}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {selectedItem.tradeable ? '✓ 可交易' : '✗ 不可交易'} · {selectedItem.sellable ? '✓ 可出售' : '✗ 不可出售'}
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* 鲜花：跳转市场上架；非鲜花：直接出售给官方 */}
            {selectedItem.type === 'flower' && selectedItem.sellable && (
              <div className="mb-2 p-2.5 rounded-xl bg-pink-50 border border-pink-200">
                <div className="text-[11px] text-pink-800">
                  <span className="font-bold">🌸 鲜花挂售提示：</span>
                  鲜花需前往市场上架，可自定义价格卖给其他玩家；
                  官方收购价约 <span className="font-bold text-amber-700">{getOfficialPrice(selectedItem)} 💰</span> / 朵。
                </div>
              </div>
            )}
            {/* 关闭滚动内容区 */}
            </div>

            {/* 固定底部按钮区 */}
            <div className="p-5 border-t border-slate-100 flex-shrink-0">
            <div className="grid grid-cols-2 gap-2">
              {selectedItem.sellable && (
                <button
                  onClick={sellItem}
                  disabled={loading === 'sell'}
                  className={classNames(
                    'flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-medium active:scale-95 transition-all',
                    selectedItem.type === 'flower'
                      ? 'bg-garden-500 text-white hover:bg-garden-600'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  )}
                >
                  {selectedItem.type === 'flower' ? (
                    <><ShoppingCart size={18} /> 前往市场上架</>
                  ) : (
                    <><Coins size={18} /> 出售 1 个</>
                  )}
                </button>
              )}
              <button
                onClick={discardItem}
                disabled={loading === 'discard'}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 font-medium hover:bg-red-100 active:scale-95 transition-all"
              >
                <Trash2 size={18} /> 丢弃 1 个
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
