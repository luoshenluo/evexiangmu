'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { FLOWER_TYPES, SEED_TYPES, RankNames, RankColors, getFlowerSellPrice } from '@/lib/game-data'
import { ShoppingCart, Tag, Download, Flower2, Leaf, Search, ArrowRightLeft, Coins, Plus } from 'lucide-react'
import type { MarketListing, BuyOrder } from '@/lib/types'

type Tab = 'flower' | 'seed' | 'buy' | 'sell'

export default function MarketPage() {
  const { user, updateUser, showToast } = useAppStore()
  const [tab, setTab] = useState<Tab>('flower')
  const [listings, setListings] = useState<MarketListing[]>([])
  const [buyOrders, setBuyOrders] = useState<BuyOrder[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const refresh = async () => {
    const [fRes, sRes, oRes] = await Promise.all([
      apiFetch('/api/market/listings?type=flower'),
      apiFetch('/api/market/listings?type=seed'),
      apiFetch('/api/market/buy-orders'),
    ])
    const allListings = [
      ...(fRes.data || []),
      ...(sRes.data || []),
    ] as MarketListing[]
    setListings(allListings)
    setBuyOrders((oRes.data || []) as BuyOrder[])
  }

  useEffect(() => { refresh() }, [])

  const buy = async (listing: MarketListing) => {
    if (!user) return
    setLoading(listing.id)
    try {
      const res = await apiFetch('/api/market/buy', {
        method: 'POST',
        body: JSON.stringify({ listingId: listing.id, quantity: 1 })
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast(`购买成功！获得 ${listing.name}`, 'success')
        refresh()
      } else {
        showToast(res.error || '购买失败', 'error')
      }
    } finally {
      setLoading(null)
    }
  }

  const sellToSystem = async (order: BuyOrder) => {
    if (!user) return
    // 找到背包里第一个符合的
    const item = user.inventory.find(
      i => i.type === order.itemType
        && (order.itemType === 'seed' ? i.referenceId === order.referenceId : i.referenceId === order.referenceId)
        && i.quantity > 0
    )
    if (!item) {
      showToast('背包中没有可出售的物品', 'error')
      return
    }
    setLoading(order.id)
    try {
      const res = await apiFetch('/api/market/sell-to-order', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, quantity: 1, inventoryItemId: item.id })
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast(`出售成功！获得 ${res.data.coinsEarned || order.price} 金币`, 'success')
        refresh()
      } else {
        showToast(res.error || '出售失败', 'error')
      }
    } finally {
      setLoading(null)
    }
  }

  const renderListingList = (type: 'flower' | 'seed') => {
    let items = listings.filter(l => l.itemType === type)
    if (categoryFilter) items = items.filter(l => l.referenceId === categoryFilter)
    if (search) items = items.filter(l => l.name.includes(search))

    const categories = type === 'flower' ? FLOWER_TYPES : SEED_TYPES

    return (
      <div>
        {/* 分类栏 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide -mx-4 px-4">
          <button
            onClick={() => setCategoryFilter(null)}
            className={classNames(
              'whitespace-nowrap chip px-3 py-1.5',
              !categoryFilter
                ? 'bg-garden-500 text-white'
                : 'bg-white border border-slate-200 text-slate-600'
            )}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={classNames(
                'whitespace-nowrap chip px-3 py-1.5',
                categoryFilter === c.id
                  ? 'bg-garden-500 text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              )}
            >
              {type === 'flower' ? (c as any).emoji : '🌱'} {c.name}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">暂无上架</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="card p-3 flex items-center gap-3">
                <div className={classNames(
                  'w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0',
                  type === 'flower'
                    ? 'bg-gradient-to-br from-pink-50 to-rose-100'
                    : 'bg-gradient-to-br from-garden-50 to-emerald-100'
                )}>
                  {item.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 truncate">{item.name}</span>
                    {item.rank && (
                      <span
                        className="chip text-[10px]"
                        style={{ backgroundColor: RankColors[item.rank] + '33', color: RankColors[item.rank] }}
                      >
                        {RankNames[item.rank]}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    出售者：
                    <span className={item.isOfficial ? 'text-garden-600 font-medium' : 'text-slate-600'}>
                      {item.sellerName}
                    </span>
                    {' · '}库存 {item.quantity}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-0.5 text-amber-600 font-bold">
                    <Coins size={14} />
                    {formatNumber(item.price)}
                  </div>
                  <button
                    onClick={() => buy(item)}
                    disabled={loading === item.id || !user}
                    className={classNames(
                      'px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all',
                      loading === item.id
                        ? 'bg-slate-200 text-slate-400'
                        : user && user.coins >= item.price
                          ? 'bg-garden-500 text-white hover:bg-garden-600 active:scale-95'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    <ShoppingCart size={12} />
                    购买
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      {/* 顶部标题 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
          <ShoppingCart size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">花市</h1>
          <p className="text-xs text-slate-500">买卖花朵、种子，自由交易</p>
        </div>
        <div className="ml-auto flex items-center gap-1 bg-white rounded-xl px-3 py-1.5 border border-amber-200">
          <Coins size={16} className="text-amber-500" />
          <span className="font-bold text-amber-700">{formatNumber(user?.coins || 0)}</span>
        </div>
      </div>

      {/* 搜索 */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索商品名称..."
          className="input pl-10 py-2.5"
        />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl mb-4">
        {([
          { key: 'flower', label: '鲜花', icon: Flower2 },
          { key: 'seed', label: '种子', icon: Leaf },
          { key: 'buy', label: '收购', icon: Download },
          { key: 'sell', label: '我的挂售', icon: Tag },
        ] as const).map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={classNames(
                'py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1',
                active
                  ? 'bg-white text-garden-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 内容 */}
      <div>
        {tab === 'flower' && renderListingList('flower')}
        {tab === 'seed' && renderListingList('seed')}
        {tab === 'buy' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-500 mb-2 px-1">
              以下价格为官方或玩家收购价，可从背包直接出售
            </div>
            {buyOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">暂无收购</div>
            ) : (
              buyOrders.map(order => (
                <div key={order.id} className="card p-3 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center text-3xl flex-shrink-0">
                    {order.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 truncate">{order.name}</span>
                      {order.rank && order.rank > 1 && (() => {
                        const r = order.rank as 1 | 2 | 3 | 4 | 5 | 6 | 7
                        return (
                          <span
                            key={r}
                            className="chip text-[10px]"
                            style={{ backgroundColor: RankColors[r] + '33', color: RankColors[r] }}
                          >
                            {RankNames[r]}
                          </span>
                        )
                      })()}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      收购方：
                      <span className="text-amber-600 font-medium">{order.buyerName}</span>
                      {' · '}收购 {order.quantity}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-0.5 text-amber-600 font-bold">
                      <Download size={14} />
                      {formatNumber(order.price)}
                    </div>
                    <button
                      onClick={() => sellToSystem(order)}
                      disabled={loading === order.id}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-1"
                    >
                      <ArrowRightLeft size={12} />
                      出售
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'sell' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Plus size={28} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">挂售功能开发中</p>
            <p className="text-slate-400 text-xs mt-1">
              暂请使用上面的&quot;收购&quot;功能直接出售给官方
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
