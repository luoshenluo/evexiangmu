'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { FLOWER_TYPES, SEED_TYPES, TOOL_TYPES, RankNames, RankColors } from '@/lib/game-data'
import type { MarketListing, BuyOrder, InventoryItem } from '@/lib/types'
import { ShoppingCart, Tag, Download, Flower2, Leaf, Search, ArrowRightLeft, Coins, Plus, X, Minus, ShoppingBag, MessageCircle, Trash2, Sparkles } from 'lucide-react'

type Tab = 'flower' | 'seed' | 'tool' | 'buy' | 'sell'

export default function MarketPage() {
  const { user, updateUser, showToast, isGuest } = useAppStore()
  const [tab, setTab] = useState<Tab>('flower')
  const [listings, setListings] = useState<MarketListing[]>([])
  const [buyOrders, setBuyOrders] = useState<BuyOrder[]>([])
  const [myListings, setMyListings] = useState<MarketListing[]>([])
  const [myOrders, setMyOrders] = useState<BuyOrder[]>([])
  const [prices, setPrices] = useState<any>(null) // 应用价格覆盖后的有效定价
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // 挂售/收购单创建弹窗
  const [createMode, setCreateMode] = useState<null | 'listing' | 'order'>(null)
  const [createItem, setCreateItem] = useState<InventoryItem | null>(null) // 挂售选择物品
  const [createItemType, setCreateItemType] = useState<'flower' | 'seed'>('flower')
  const [createReferenceId, setCreateReferenceId] = useState<string>('')
  const [createName, setCreateName] = useState<string>('')
  const [createEmoji, setCreateEmoji] = useState<string>('')
  const [createRank, setCreateRank] = useState<number | undefined>(undefined)
  const [createQuantity, setCreateQuantity] = useState<number>(1)
  const [createPrice, setCreatePrice] = useState<number>(1)
  const [subTab, setSubTab] = useState<'listings' | 'orders' | 'create'>('listings')

  const refresh = async () => {
    const [fRes, sRes, tRes, oRes, pRes, myLRes, myORes] = await Promise.all([
      apiFetch('/api/market/listings?type=flower'),
      apiFetch('/api/market/listings?type=seed'),
      apiFetch('/api/market/listings?type=tool'),
      apiFetch('/api/market/buy-orders'),
      apiFetch('/api/market/prices'),
      user && !isGuest ? apiFetch('/api/market/my?kind=listings') : { data: [] },
      user && !isGuest ? apiFetch('/api/market/my?kind=orders') : { data: [] },
    ])
    const allListings = [
      ...(fRes.data || []),
      ...(sRes.data || []),
      ...(tRes.data || []),
    ] as MarketListing[]
    setListings(allListings)
    setBuyOrders((oRes.data || []) as BuyOrder[])
    if (pRes.success && pRes.data) setPrices(pRes.data)
    setMyListings((myLRes.data || []) as MarketListing[])
    setMyOrders((myORes.data || []) as BuyOrder[])
  }

  useEffect(() => { refresh() }, [user, isGuest])

  // 有效售价（应用价格覆盖）：花按等级倍率，种子/工具取覆盖价
  const effFlowerPrice = (flowerId: string, rank: number): number => {
    const base = prices?.flowers?.[flowerId]?.baseSellPrice
    const multipliers = [1, 1.5, 2.2, 3.2, 5, 8, 15]
    const m = multipliers[Math.max(0, Math.min(multipliers.length - 1, rank - 1))] || 1
    return Math.floor((base ?? FLOWER_TYPES.find(f => f.id === flowerId)?.baseSellPrice ?? 0) * m)
  }
  const effSeedPrice = (seedId: string): number =>
    prices?.seeds?.[seedId]?.price ?? SEED_TYPES.find(s => s.id === seedId)?.price ?? 10

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
    const item = user.inventory.find(
      i => i.type === order.itemType
        && i.referenceId === order.referenceId
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

  // 我的挂售：取消下架
  const cancelListing = async (id: string) => {
    setLoading(id)
    try {
      const res = await apiFetch('/api/market/my', {
        method: 'POST',
        body: JSON.stringify({ mode: 'cancel-listing', id }),
      })
      if (res.success) {
        if (res.data?.newInventory) updateUser({ ...user!, inventory: res.data.newInventory })
        showToast('已下架，物品已归还背包', 'success')
        refresh()
      } else {
        showToast(res.error || '下架失败', 'error')
      }
    } finally { setLoading(null) }
  }

  // 我的收购单：取消退款
  const cancelOrder = async (id: string) => {
    setLoading(id)
    try {
      const res = await apiFetch('/api/market/my', {
        method: 'POST',
        body: JSON.stringify({ mode: 'cancel-order', id }),
      })
      if (res.success) {
        showToast(`收购单已取消，退还 ${res.data?.refund || 0} 金币`, 'success')
        // 重新拉取用户金币
        const uRes = await apiFetch('/api/user/me')
        if (uRes.success && uRes.data) updateUser(uRes.data)
        refresh()
      } else {
        showToast(res.error || '取消失败', 'error')
      }
    } finally { setLoading(null) }
  }

  // 打开创建挂售
  const openCreateListing = (item: InventoryItem) => {
    setCreateMode('listing')
    setCreateItem(item)
    setCreateItemType(item.type as any)
    setCreateReferenceId(item.referenceId)
    setCreateName(item.name)
    setCreateEmoji(item.emoji)
    setCreateRank(item.rank)
    setCreateQuantity(1)
    const ft = FLOWER_TYPES.find((f) => f.id === item.referenceId)
    const base = ft ? effFlowerPrice(item.referenceId, (item.rank || 1) as any) : effSeedPrice(item.referenceId as any)
    setCreatePrice(base)
  }

  // 打开创建收购单
  const openCreateOrder = () => {
    setCreateMode('order')
    setCreateItemType('flower')
    setCreateReferenceId('')
    setCreateName('')
    setCreateEmoji('')
    setCreateRank(undefined)
    setCreateQuantity(1)
    setCreatePrice(10)
  }

  // 提交创建
  const submitCreate = async () => {
    if (!user || !createMode) return
    if (!createQuantity || createQuantity <= 0) return showToast('数量必须大于 0', 'error')
    if (!createPrice || createPrice <= 0) return showToast('价格必须大于 0', 'error')

    setLoading('create')
    try {
      const body: any = {
        mode: createMode === 'listing' ? 'create-listing' : 'create-order',
      }
      if (createMode === 'listing') {
        if (!createItem) return showToast('请选择要挂售的物品', 'error')
        if (createItem.quantity < createQuantity) return showToast('背包数量不足', 'error')
        body.itemType = createItem.type
        body.referenceId = createItem.referenceId
        body.rank = createItem.rank
        body.quantity = createQuantity
        body.price = createPrice
      } else {
        if (!createReferenceId) return showToast('请选择收购物品', 'error')
        const total = createQuantity * createPrice
        if (user.coins < total) return showToast(`金币不足（锁定共需 ${total}）`, 'error')
        body.itemType = createItemType
        body.referenceId = createReferenceId
        body.quantity = createQuantity
        body.price = createPrice
      }
      const res = await apiFetch('/api/market/my', { method: 'POST', body: JSON.stringify(body) })
      if (res.success) {
        showToast(createMode === 'listing' ? '挂售成功！' : '收购单已发布，金币已锁定', 'success')
        if (res.data?.newInventory) updateUser({ ...user, inventory: res.data.newInventory })
        setCreateMode(null)
        refresh()
      } else {
        showToast(res.error || '失败', 'error')
      }
    } finally { setLoading(null) }
  }

  const renderListingList = (type: 'flower' | 'seed' | 'tool') => {
    let items = listings.filter(l => l.itemType === type)
    if (categoryFilter) items = items.filter(l => l.referenceId === categoryFilter)
    if (search) items = items.filter(l => l.name.includes(search))

    const categories = type === 'flower' ? FLOWER_TYPES : type === 'seed' ? SEED_TYPES : TOOL_TYPES

    return (
      <div>
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
                    : type === 'seed'
                    ? 'bg-gradient-to-br from-garden-50 to-emerald-100'
                    : 'bg-gradient-to-br from-amber-50 to-orange-100'
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
                  {isGuest ? (
                    <span className="text-[11px] text-slate-400 px-2 py-1">登录后可交易</span>
                  ) : (
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
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const tradeableItems = (user?.inventory || []).filter((i) => i.tradeable && i.quantity > 0)

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
          <ShoppingCart size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">花市</h1>
          <p className="text-xs text-slate-500">买卖花朵、种子、工具，自由交易</p>
        </div>
        <div className="ml-auto flex items-center gap-1 bg-white rounded-xl px-3 py-1.5 border border-amber-200">
          <Coins size={16} className="text-amber-500" />
          <span className="font-bold text-amber-700">{formatNumber(user?.coins || 0)}</span>
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索商品名称..."
          className="input pl-10 py-2.5"
        />
      </div>

      <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-xl mb-4">
        {([
          { key: 'flower', label: '鲜花', icon: Flower2 },
          { key: 'seed', label: '种子', icon: Leaf },
          { key: 'tool', label: '工具', icon: Sparkles },
          { key: 'buy', label: '收购', icon: Download },
          { key: 'sell', label: '我的', icon: Tag },
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

      <div>
        {tab === 'flower' && renderListingList('flower')}
        {tab === 'seed' && renderListingList('seed')}
        {tab === 'tool' && renderListingList('tool')}
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
                      <span className={order.isOfficial ? 'text-garden-600 font-medium' : 'text-amber-600 font-medium'}>{order.buyerName}</span>
                      {' · '}收购 {order.quantity}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-0.5 text-amber-600 font-bold">
                      <Download size={14} />
                      {formatNumber(order.price)}
                    </div>
                    {isGuest ? (
                      <span className="text-[11px] text-slate-400 px-2 py-1">登录后可交易</span>
                    ) : (
                      <button
                        onClick={() => sellToSystem(order)}
                        disabled={loading === order.id}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-1"
                      >
                        <ArrowRightLeft size={12} />
                        出售
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'sell' && (
          <div>
            {isGuest ? (
              <div className="text-center py-12 text-slate-400 text-sm">请先登录</div>
            ) : (
              <>
                {/* 我的挂售 Tab 内子菜单 */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-50 rounded-xl mb-3">
                  {([
                    { k: 'listings', label: '我的挂售', icon: ShoppingBag },
                    { k: 'orders', label: '我的收购单', icon: MessageCircle },
                    { k: 'create', label: '发布', icon: Plus },
                  ] as const).map(t => (
                    <button
                      key={t.k}
                      onClick={() => {
                        setSubTab(t.k)
                        if (t.k === 'create') {
                          // 默认打开创建挂售但需选择物品
                          if (tradeableItems.length > 0) {
                            openCreateListing(tradeableItems[0])
                          } else {
                            openCreateOrder()
                          }
                        }
                      }}
                      className={classNames(
                        'py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1',
                        subTab === t.k ? 'bg-white shadow-sm text-garden-700' : 'text-slate-500'
                      )}
                    >
                      <t.icon size={12} /> {t.label}
                    </button>
                  ))}
                </div>

                {subTab === 'listings' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-500 px-1">我发布的挂售（共 {myListings.length}）</div>
                      {tradeableItems.length > 0 && (
                        <button
                          onClick={() => { setSubTab('create'); openCreateListing(tradeableItems[0]) }}
                          className="chip bg-garden-50 text-garden-700 hover:bg-garden-100"
                        >
                          <Plus size={12} className="inline mr-1" /> 挂售物品
                        </button>
                      )}
                    </div>
                    {myListings.length === 0 ? (
                      <div className="card p-6 text-center">
                        <ShoppingBag size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-slate-500 text-sm">暂无挂售</p>
                        <p className="text-slate-400 text-xs mt-1">
                          选择背包中的物品可自由定价上架到市场出售
                        </p>
                        {tradeableItems.length > 0 && (
                          <button
                            onClick={() => { setSubTab('create'); openCreateListing(tradeableItems[0]) }}
                            className="btn-primary mt-4 py-2 text-sm"
                          >
                            立即挂售
                          </button>
                        )}
                      </div>
                    ) : (
                      myListings.map((l) => (
                        <div key={l.id} className="card p-3 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center text-2xl flex-shrink-0">{l.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800">{l.name}</div>
                            <div className="text-[11px] text-slate-500">库存 {l.quantity} · 单价 {formatNumber(l.price)}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="text-amber-600 font-bold text-sm">
                              <Coins size={12} className="inline mr-1" />
                              {formatNumber(l.quantity * l.price)}
                            </div>
                            <button
                              onClick={() => cancelListing(l.id)}
                              disabled={loading === l.id}
                              className="px-2.5 py-1 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                            >
                              <Trash2 size={12} /> 下架
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {subTab === 'orders' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-500 px-1">我发布的收购单（共 {myOrders.length}）</div>
                      <button
                        onClick={() => { setSubTab('create'); openCreateOrder() }}
                        className="chip bg-amber-50 text-amber-700 hover:bg-amber-100"
                      >
                        <Plus size={12} className="inline mr-1" /> 发布收购
                      </button>
                    </div>
                    {myOrders.length === 0 ? (
                      <div className="card p-6 text-center">
                        <MessageCircle size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-slate-500 text-sm">暂无收购单</p>
                        <p className="text-slate-400 text-xs mt-1">
                          发布收购单，其他玩家可以直接把物品卖给你
                        </p>
                        <button
                          onClick={() => { setSubTab('create'); openCreateOrder() }}
                          className="btn-primary mt-4 py-2 text-sm"
                        >
                          立即发布收购
                        </button>
                      </div>
                    ) : (
                      myOrders.map((o) => (
                        <div key={o.id} className="card p-3 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center text-2xl flex-shrink-0">{o.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800">{o.name}</div>
                            <div className="text-[11px] text-slate-500">收 {o.quantity} · 单价 {formatNumber(o.price)} · 共锁定 {formatNumber(o.quantity * o.price)}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="text-slate-400 text-xs">等玩家出售</div>
                            <button
                              onClick={() => cancelOrder(o.id)}
                              disabled={loading === o.id}
                              className="px-2.5 py-1 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                            >
                              <Trash2 size={12} /> 取消
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {subTab === 'create' && !createMode && (
                  <div className="card p-4 text-center">
                    <p className="text-sm text-slate-500 mb-3">选择创建类型</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => tradeableItems.length > 0 ? openCreateListing(tradeableItems[0]) : showToast('背包中没有可出售物品', 'error')}
                        className="p-4 rounded-xl border-2 border-dashed border-garden-200 hover:border-garden-400 text-garden-700"
                      >
                        <ShoppingBag size={24} className="mx-auto mb-2" />
                        <div className="text-sm font-medium">挂售物品</div>
                        <div className="text-[11px] text-slate-500 mt-1">从背包选物品上架卖</div>
                      </button>
                      <button
                        onClick={openCreateOrder}
                        className="p-4 rounded-xl border-2 border-dashed border-amber-200 hover:border-amber-400 text-amber-700"
                      >
                        <MessageCircle size={24} className="mx-auto mb-2" />
                        <div className="text-sm font-medium">发布收购单</div>
                        <div className="text-[11px] text-slate-500 mt-1">我出价收别人的物品</div>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 创建挂售/收购 弹窗 */}
      {createMode && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCreateMode(null)}>
          <div className="card w-full max-w-md sm:rounded-2xl rounded-t-3xl p-5 slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800">
                {createMode === 'listing' ? '上架出售' : '发布收购单'}
              </h2>
              <button onClick={() => setCreateMode(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>

            {createMode === 'listing' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">选择要挂售的物品</label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 rounded-xl bg-slate-50">
                    {tradeableItems.length === 0 && (
                      <div className="col-span-3 text-center text-xs text-slate-400 py-3">
                        背包中没有可交易物品
                      </div>
                    )}
                    {tradeableItems.map((it) => {
                      const active = createItem?.id === it.id
                      return (
                        <button
                          key={it.id}
                          onClick={() => openCreateListing(it)}
                          className={classNames(
                            'p-2 rounded-xl text-xs flex flex-col items-center gap-1 border',
                            active ? 'border-garden-500 bg-garden-50' : 'border-slate-200 bg-white'
                          )}
                        >
                          <span className="text-2xl">{it.emoji}</span>
                          <div className="font-medium text-slate-800 truncate w-full text-center">{it.name}</div>
                          <div className="text-[10px] text-slate-500">x{it.quantity}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {createItem && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">出售数量</label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setCreateQuantity(Math.max(1, createQuantity - 1))}
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={createItem.quantity}
                          value={createQuantity}
                          onChange={(e) => setCreateQuantity(Math.max(1, Math.min(createItem.quantity, Number(e.target.value) || 1)))}
                          className="flex-1 input text-center"
                        />
                        <button
                          onClick={() => setCreateQuantity(Math.min(createItem.quantity, createQuantity + 1))}
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">最大 {createItem.quantity}</div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">单价（金币/件）</label>
                      <div className="relative">
                        <Coins size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                        <input
                          type="number"
                          min={1}
                          value={createPrice}
                          onChange={(e) => setCreatePrice(Math.max(1, Number(e.target.value) || 1))}
                          className="input pl-10"
                        />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        总收益（扣 5% 手续费后）：
                        <span className="text-garden-700 font-medium ml-1">{formatNumber(Math.floor(createQuantity * createPrice * 0.95))}</span>
                      </div>
                    </div>

                    <button onClick={submitCreate} disabled={loading === 'create'} className="btn-primary w-full py-2.5">
                      {loading === 'create' ? '发布中...' : `发布挂售（共 ${createQuantity} 件，总价 ${formatNumber(createQuantity * createPrice)}）`}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">收购类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setCreateItemType('flower'); setCreateReferenceId('') }}
                      className={classNames('py-2 rounded-xl text-sm font-medium border',
                        createItemType === 'flower' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200')}>🌸 花朵</button>
                    <button onClick={() => { setCreateItemType('seed'); setCreateReferenceId('') }}
                      className={classNames('py-2 rounded-xl text-sm font-medium border',
                        createItemType === 'seed' ? 'border-garden-500 bg-garden-50 text-garden-700' : 'border-slate-200')}>🌱 种子</button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">选择物品</label>
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 rounded-xl bg-slate-50">
                    {(createItemType === 'flower' ? FLOWER_TYPES : SEED_TYPES).map((c) => {
                      const active = createReferenceId === c.id
                      return (
                        <button key={c.id}
                          onClick={() => {
                            setCreateReferenceId(c.id)
                            setCreateName(c.name)
                            setCreateEmoji(createItemType === 'flower' ? (c as any).emoji : '🌱')
                            if (createItemType === 'flower') setCreateRank(1)
                            const p = createItemType === 'flower'
                              ? effFlowerPrice(c.id, 1) || 10
                              : effSeedPrice(c.id) || 10
                            setCreatePrice(Math.floor(p * 1.1))
                          }}
                          className={classNames(
                            'p-2 rounded-xl text-xs flex flex-col items-center gap-1 border',
                            active ? 'border-garden-500 bg-garden-50' : 'border-slate-200 bg-white'
                          )}>
                          <span className="text-2xl">{createItemType === 'flower' ? (c as any).emoji : '🌱'}</span>
                          <div className="font-medium truncate w-full text-center">{c.name}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {createItemType === 'flower' && createReferenceId && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">品质（越高价越高）</label>
                    <div className="grid grid-cols-7 gap-1">
                      {([1, 2, 3, 4, 5, 6, 7] as const).map((r) => (
                        <button key={r}
                          onClick={() => {
                            setCreateRank(r)
                            const p = effFlowerPrice(createReferenceId, r)
                            setCreatePrice(Math.floor(p * 1.1))
                          }}
                          className={classNames(
                            'py-1.5 rounded-lg text-[10px] border',
                            createRank === r ? 'border-garden-500 bg-garden-50 text-garden-700 font-bold' : 'border-slate-200'
                          )}>
                          {RankNames[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">收购数量</label>
                  <input
                    type="number" min={1} value={createQuantity}
                    onChange={(e) => setCreateQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">单价（金币/件）</label>
                  <div className="relative">
                    <Coins size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                    <input
                      type="number" min={1}
                      value={createPrice}
                      onChange={(e) => setCreatePrice(Math.max(1, Number(e.target.value) || 1))}
                      className="input pl-10"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <Coins size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    发布收购单需要<b>先锁定金币</b>：共 {formatNumber(createQuantity * createPrice)} 金币
                    <br />
                    取消收购单或收购完成剩余部分时会自动退还。
                  </div>
                </div>

                <button onClick={submitCreate} disabled={loading === 'create' || !createReferenceId || !user}
                  className="btn-primary w-full py-2.5 disabled:opacity-50">
                  {loading === 'create' ? '发布中...' : `发布收购单（锁定 ${formatNumber((createQuantity || 0) * (createPrice || 0))} 金币）`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
