'use client'

import { useEffect, useState } from 'react'
import { apiFetch, classNames, formatDateTime, formatNumber } from '@/lib/utils'
import { Tag, Plus, X, Edit, Check, Coins, Trash2, RefreshCw, Package, ShoppingCart, BarChart3, History } from 'lucide-react'
import { useAppStore } from '@/lib/store'

type SubTab = 'overview' | 'prices' | 'official' | 'player'

export default function AdminMarketPanel() {
  const { showToast } = useAppStore()
  const [subTab, setSubTab] = useState<SubTab>('prices')
  const [loading, setLoading] = useState(false)
  const [flowerTypes, setFlowerTypes] = useState<any[]>([])
  const [seedTypes, setSeedTypes] = useState<any[]>([])
  const [toolTypes, setToolTypes] = useState<any[]>([])
  const [overrides, setOverrides] = useState<any>({})
  // 花朵价格编辑
  const [flowerEdits, setFlowerEdits] = useState<Record<string, { baseSellPrice?: number; seedPrice?: number }>>({})
  const [seedEdits, setSeedEdits] = useState<Record<string, { price?: number }>>({})
  const [toolEdits, setToolEdits] = useState<Record<string, { price?: number }>>({})
  const [feeRate, setFeeRate] = useState<number>(0.05)
  const [minListPrice, setMinListPrice] = useState<number>(1)
  const [maxListPrice, setMaxListPrice] = useState<number>(999999)

  const [official, setOfficial] = useState<any[]>([])
  const [player, setPlayer] = useState<any[]>([])
  const [totalListings, setTotalListings] = useState(0)
  const [econStats, setEconStats] = useState<any>(null)
  const [overrideHistory, setOverrideHistory] = useState<any[]>([])

  const [showCreate, setShowCreate] = useState(false)
  const [newItemType, setNewItemType] = useState<'seed' | 'flower' | 'tool'>('seed')
  const [newRefId, setNewRefId] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('🌱')
  const [newPrice, setNewPrice] = useState<number>(10)
  const [newQty, setNewQty] = useState<number>(999)
  const [newRank, setNewRank] = useState<number>(1)
  const [refresher, setRefresher] = useState(0)

  const refresh = async () => {
    setLoading(true)
    try {
      const [p, m, e, h] = await Promise.all([
        apiFetch('/api/admin/market?action=price-overrides'),
        apiFetch('/api/admin/market?action=market-items'),
        apiFetch('/api/admin/market?action=econ-stats'),
        apiFetch('/api/admin/market?action=override-history'),
      ])
      if (p.success) {
        setFlowerTypes(p.data?.flowerTypes || [])
        setSeedTypes(p.data?.seedTypes || [])
        setToolTypes(p.data?.toolTypes || [])
        const o = p.data?.overrides || {}
        setOverrides(o)
        const fe: any = {}
        for (const f of p.data?.flowerTypes || []) {
          const over = o.flowers?.[f.id] || {}
          fe[f.id] = {
            baseSellPrice: over.baseSellPrice ?? f.baseSellPrice,
            seedPrice: over.seedPrice ?? f.seedPrice,
          }
        }
        setFlowerEdits(fe)
        const se: any = {}
        for (const s of p.data?.seedTypes || []) {
          se[s.id] = { price: o.seeds?.[s.id]?.price ?? s.price }
        }
        setSeedEdits(se)
        const te: any = {}
        for (const t of p.data?.toolTypes || []) {
          te[t.id] = { price: o.tools?.[t.id]?.price ?? t.price }
        }
        setToolEdits(te)
        setFeeRate(o.feeRate ?? 0.05)
        setMinListPrice(o.minListPrice ?? 1)
        setMaxListPrice(o.maxListPrice ?? 999999)
      }
      if (m.success) {
        setOfficial(m.data?.official || [])
        setPlayer(m.data?.player || [])
        setTotalListings(m.data?.totalListings || 0)
      }
      if (e.success) setEconStats(e.data)
      if (h.success) setOverrideHistory(h.data?.items || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [refresher])

  const savePrices = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/market', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'set-price-overrides',
          overrides: {
            flowers: flowerEdits,
            seeds: seedEdits,
            tools: toolEdits,
            feeRate,
            minListPrice,
            maxListPrice,
          },
        }),
      })
      if (res.success) {
        showToast('已保存价格调控', 'success')
        setRefresher((k) => k + 1)
      } else showToast(res.error || '保存失败', 'error')
    } finally { setLoading(false) }
  }

  const removeListing = async (id: string) => {
    if (!confirm('确定下架该官方商品？')) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/market', {
        method: 'POST',
        body: JSON.stringify({ mode: 'remove-official-listing', id }),
      })
      if (res.success) {
        showToast('已下架', 'success')
        setRefresher((k) => k + 1)
      } else showToast(res.error || '失败', 'error')
    } finally { setLoading(false) }
  }

  const createListing = async () => {
    if (!newName || !newPrice || !newQty) return showToast('请填写名称、价格和数量', 'error')
    // 自动生成 referenceId（如果没有手动指定）
    let refId = newRefId.trim()
    if (!refId) {
      const prefix = newItemType === 'flower' ? 'flower' : newItemType === 'seed' ? 'seed' : 'tool'
      refId = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      setNewRefId(refId)
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/market', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'create-official-listing',
          itemType: newItemType,
          referenceId: refId,
          name: newName,
          emoji: newEmoji,
          price: Number(newPrice),
          quantity: Number(newQty),
          rank: newItemType === 'flower' ? Number(newRank) : 1,
        }),
      })
      if (res.success) {
        showToast('已上架官方商品', 'success')
        setShowCreate(false)
        setRefresher((k) => k + 1)
      } else showToast(res.error || '失败', 'error')
    } finally { setLoading(false) }
  }

  const seedPreset = (id: string) => {
    const s = seedTypes.find((x) => x.id === id) || flowerTypes.find((x) => x.id === id)
    if (!s) return
    setNewItemType('seed')
    setNewRefId(id)
    setNewName(`种子：${s.name}`)
    setNewEmoji(s.emoji || '🌱')
    const p = seedEdits[id]?.price ?? s.price ?? 10
    setNewPrice(Math.floor(p * 1.2))
  }
  const flowerPreset = (id: string) => {
    const f = flowerTypes.find((x) => x.id === id)
    if (!f) return
    setNewItemType('flower')
    setNewRefId(id)
    setNewName(`花朵：${f.name}（${newRank === 1 ? '普通' : newRank === 5 ? '完美' : newRank === 7 ? '传说' : `Rank ${newRank}`}）`)
    setNewEmoji(f.emoji)
    const base = (flowerEdits[id]?.baseSellPrice ?? f.baseSellPrice) || 10
    const mul = [1, 1.5, 2.2, 3.2, 5, 8, 15][newRank - 1] || 1
    setNewPrice(Math.floor(base * mul * 1.1))
  }
  const toolPreset = (id: string) => {
    const t = toolTypes.find((x) => x.id === id)
    if (!t) return
    setNewItemType('tool')
    setNewRefId(id)
    setNewName(t.name)
    setNewEmoji(t.emoji || '🔧')
    setNewPrice((toolEdits[id]?.price ?? t.price) || 10)
  }

  const seasonLabel = (seasons: string[] = []) => {
    const m: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }
    return seasons.map((s) => m[s] || s).join('/') || '-'
  }

  return (
    <div className="space-y-4">
      {/* 控制条 */}
      <div className="card p-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Tag size={18} className="text-indigo-500" /> 市场价格调控
          </h3>
          <div className="text-xs text-slate-500 mt-1">
            共 {totalListings} 件挂售商品 · 官方 {official.length} · 玩家 {player.length}
            {overrides.updatedAt && <> · 最近更新：{formatDateTime(overrides.updatedAt).slice(5, 16)}</>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRefresher((k) => k + 1)} disabled={loading} className="btn-secondary py-2 px-3 text-xs">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
          <button onClick={savePrices} disabled={loading} className="btn-primary py-2 px-3 text-xs">
            <Check size={14} /> 保存价格调控
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
        {([
          { k: 'overview', label: '经济仪表盘', icon: BarChart3 },
          { k: 'prices', label: '价格调控', icon: Edit },
          { k: 'official', label: `官方挂售 (${official.length})`, icon: Package },
          { k: 'player', label: `玩家挂售 (${player.length})`, icon: ShoppingCart },
        ] as const).map((t) => (
          <button key={t.k}
            onClick={() => setSubTab(t.k)}
            className={classNames(
              'py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1',
              subTab === t.k ? 'bg-white text-garden-700 shadow-sm' : 'text-slate-500'
            )}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="space-y-3">
          {!econStats ? (
            <div className="card p-8 text-center text-slate-400 text-sm">暂无统计数据</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-4">
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Coins size={12} /> 全服金币总量</div>
                  <div className="text-2xl font-bold text-amber-600">{formatNumber(econStats.totalCoins)}</div>
                  <div className="text-[10px] text-slate-400 mt-1">玩家 {econStats.userCount} 人 · 人均 {formatNumber(econStats.avgCoins)}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Package size={12} /> 挂售商品</div>
                  <div className="text-2xl font-bold text-garden-700">{econStats.totalListings}</div>
                  <div className="text-[10px] text-slate-400 mt-1">官方 {econStats.officialListings} · 玩家 {econStats.playerListings}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><ShoppingCart size={12} /> 收购单</div>
                  <div className="text-2xl font-bold text-indigo-600">{econStats.totalBuyOrders}</div>
                  <div className="text-[10px] text-slate-400 mt-1">锁定金币 {formatNumber(econStats.totalBuyOrderValue)}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><BarChart3 size={12} /> 价格调控</div>
                  <div className={classNames('text-2xl font-bold', econStats.priceOverrideActive ? 'text-emerald-600' : 'text-slate-300')}>
                    {econStats.priceOverrideActive ? '生效中' : '未调控'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">调控物品 {econStats.overriddenItems} 项 · 费率 {(econStats.feeRate * 100).toFixed(2)}%</div>
                </div>
              </div>
              <div className="card p-4 flex items-center justify-between">
                <span className="text-xs text-slate-500">家族数：<b>{econStats.familyCount}</b></span>
                <span className="text-[10px] text-slate-400">更新于 {formatDateTime(econStats.timestamp).slice(5, 16)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {subTab === 'prices' && (
        <div className="space-y-4">
          {/* 手续费 / 上下限 */}
          <div className="card p-4 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">交易手续费率</label>
              <input type="number" step="0.001" min="0" max="0.5" className="input"
                value={feeRate}
                onChange={(e) => setFeeRate(Number(e.target.value))} />
              <div className="text-[10px] text-slate-400 mt-1">{(feeRate * 100).toFixed(2)}% 卖家承担</div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">挂售最低价</label>
              <input type="number" min="1" className="input"
                value={minListPrice}
                onChange={(e) => setMinListPrice(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600">挂售最高价</label>
              <input type="number" min="1" className="input"
                value={maxListPrice}
                onChange={(e) => setMaxListPrice(Number(e.target.value))} />
            </div>
          </div>

          {/* 花朵价格 */}
          <div className="card p-5">
            <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-1">🌸 花朵收购价 + 种子价调控</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="text-left p-3 font-medium">花品种</th>
                    <th className="text-left p-3 font-medium">适宜季节</th>
                    <th className="text-left p-3 font-medium">最高等级</th>
                    <th className="text-left p-3 font-medium">基础收购价 (Rank 1)</th>
                    <th className="text-left p-3 font-medium">种子售价</th>
                    <th className="text-left p-3 font-medium">快捷</th>
                  </tr>
                </thead>
                <tbody>
                  {flowerTypes.map((f) => {
                    const edit = flowerEdits[f.id] || {}
                    const changedSell = edit.baseSellPrice !== f.baseSellPrice
                    const changedSeed = edit.seedPrice !== f.seedPrice
                    return (
                      <tr key={f.id} className="border-t border-slate-100 align-top">
                        <td className="p-3 font-medium text-slate-700">
                          <span className="text-lg mr-1">{f.emoji}</span>
                          {f.name}
                          <div className="text-[10px] text-slate-400 font-normal">id: {f.id}</div>
                        </td>
                        <td className="p-3 text-slate-600">{seasonLabel(f.seasons)}</td>
                        <td className="p-3">{f.maxRank}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" className="input !py-1 !px-2 text-sm w-24"
                              value={edit.baseSellPrice ?? ''}
                              onChange={(e) => setFlowerEdits((p) => ({ ...p, [f.id]: { ...(p[f.id] || {}), baseSellPrice: Number(e.target.value) } }))} />
                            <Coins size={12} className="text-amber-500" />
                            {(changedSell) && <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded px-1.5 py-0.5">默认 {f.baseSellPrice} → 现 {edit.baseSellPrice}</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">默认：{f.baseSellPrice}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" className="input !py-1 !px-2 text-sm w-24"
                              value={edit.seedPrice ?? ''}
                              onChange={(e) => setFlowerEdits((p) => ({ ...p, [f.id]: { ...(p[f.id] || {}), seedPrice: Number(e.target.value) } }))} />
                            <Coins size={12} className="text-amber-500" />
                            {(changedSeed) && <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded px-1.5 py-0.5">默认 {f.seedPrice} → 现 {edit.seedPrice}</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">默认：{f.seedPrice}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            <button onClick={() => seedPreset(f.id)} className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-600">上架种子</button>
                            <button onClick={() => flowerPreset(f.id)} className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-600">上架花朵</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 种子价格（兜底） */}
          {seedTypes.length > 0 && (
            <div className="card p-5">
              <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-1">🌱 种子列表</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="text-left p-3 font-medium">种子</th>
                      <th className="text-left p-3 font-medium">ID</th>
                      <th className="text-left p-3 font-medium">售卖价</th>
                      <th className="text-left p-3 font-medium">快捷</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seedTypes.map((s) => {
                      const e = seedEdits[s.id] || {}
                      const changed = e.price !== undefined && e.price !== s.price
                      return (
                        <tr key={s.id} className="border-t border-slate-100">
                          <td className="p-3 font-medium text-slate-700"><span className="mr-1">{s.emoji}</span>{s.name}</td>
                          <td className="p-3 text-slate-500 text-xs">{s.id}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" className="input !py-1 !px-2 text-sm w-24"
                                value={e.price ?? ''}
                                onChange={(ev) => setSeedEdits((p) => ({ ...p, [s.id]: { price: Number(ev.target.value) } }))} />
                              <Coins size={12} className="text-amber-500" />
                              {changed && <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded px-1.5 py-0.5">默认 {s.price} → 现 {e.price}</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">默认：{s.price}</div>
                          </td>
                          <td className="p-3">
                            <button onClick={() => seedPreset(s.id)} className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-600">上架官方</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 工具价格 */}
          {toolTypes.length > 0 && (
            <div className="card p-5">
              <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-1">🔧 工具价格调控</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {toolTypes.map((t) => {
                  const e = toolEdits[t.id] || {}
                  const changed = e.price !== undefined && e.price !== t.price
                  return (
                    <div key={t.id} className="p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{t.emoji}</span>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800 text-sm">{t.name}</div>
                          <div className="text-[10px] text-slate-400">{t.id}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" className="input !py-1 !px-2 text-sm flex-1"
                          value={e.price ?? ''}
                          onChange={(ev) => setToolEdits((p) => ({ ...p, [t.id]: { price: Number(ev.target.value) } }))} />
                        <Coins size={12} className="text-amber-500" />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-400">默认：{t.price}</span>
                        {changed && <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded px-1.5 py-0.5">默认 {t.price} → 现 {e.price}</span>}
                      </div>
                      <button onClick={() => toolPreset(t.id)} className="mt-2 w-full text-[10px] py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-600">
                        上架官方
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={savePrices} disabled={loading} className="btn-primary py-2.5 px-5">
              {loading ? '保存中...' : '保存价格调控'}
            </button>
          </div>

          {/* 调节历史 */}
          <div className="card p-5">
            <h4 className="font-bold text-slate-800 mb-3 text-sm flex items-center gap-1"><History size={14} /> 调节历史</h4>
            {overrideHistory.length === 0 ? (
              <div className="text-xs text-slate-400">暂无调节记录</div>
            ) : (
              <div className="space-y-2">
                {overrideHistory.map((h) => (
                  <div key={h.id} className="flex items-start justify-between gap-3 p-2 rounded-lg bg-slate-50 text-xs">
                    <div className="flex-1 text-slate-600">
                      <span className="font-medium text-slate-800">{h.adminName}</span>
                      <span className="mx-1 text-slate-400">·</span>
                      <span>{h.detail?.desc || '修改市场价格调控'}</span>
                      {h.detail?.overrides && (
                        <div className="text-[10px] text-slate-400 mt-1 font-mono break-all">
                          {JSON.stringify(h.detail.overrides).slice(0, 200)}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap">{formatDateTime(h.createdAt).slice(5, 16)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'official' && (
        <div className="space-y-3">
          <div className="card p-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">官方挂售商品</h3>
            <button onClick={() => setShowCreate(true)} className="btn-primary py-2 px-3 text-xs">
              <Plus size={14} /> 上架官方商品
            </button>
          </div>
          {official.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-400">暂无官方挂售，点击右上角新增</div>
          ) : (
            <div className="space-y-2">
              {official.map((l) => (
                <div key={l.id} className="card p-3 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {l.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-800">{l.name}</span>
                      <span className="chip text-[10px] bg-violet-100 text-violet-700">官方</span>
                      {l.itemType && <span className="chip text-[10px] bg-slate-100 text-slate-600">{l.itemType}</span>}
                      {l.rank && l.itemType === 'flower' && <span className="chip text-[10px] bg-amber-100 text-amber-700">Rank {l.rank}</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      库存：{formatNumber(l.quantity)} · 单价：<span className="text-amber-600 font-medium">{formatNumber(l.price)} 💰</span>
                    </div>
                    <div className="text-[10px] text-slate-400">ID: {l.id}</div>
                  </div>
                  <button onClick={() => removeListing(l.id)} disabled={loading}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1">
                    <Trash2 size={12} /> 下架
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'player' && (
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">玩家挂售商品（只读）</h3>
          {player.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-8">暂无玩家挂售</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="text-left p-3 font-medium">商品</th>
                    <th className="text-left p-3 font-medium">卖家</th>
                    <th className="text-left p-3 font-medium">单价</th>
                    <th className="text-left p-3 font-medium">库存</th>
                    <th className="text-left p-3 font-medium">发布时间</th>
                  </tr>
                </thead>
                <tbody>
                  {player.slice(0, 100).map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="p-3 font-medium text-slate-700">
                        <span className="mr-1">{l.emoji}</span>{l.name}
                        {l.rank && l.itemType === 'flower' && <span className="text-[10px] ml-1 text-amber-600">R{l.rank}</span>}
                      </td>
                      <td className="p-3 text-slate-600">{l.sellerName || l.sellerId}</td>
                      <td className="p-3 text-amber-600 font-medium">{formatNumber(l.price)} 💰</td>
                      <td className="p-3">{formatNumber(l.quantity)}</td>
                      <td className="p-3 text-xs text-slate-500">{formatDateTime(l.createdAt).slice(5, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {player.length > 100 && <div className="text-center text-xs text-slate-400 pt-3">仅展示最近 100 条，共 {player.length} 条</div>}
            </div>
          )}
        </div>
      )}

      {/* 创建官方挂售弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="card w-full max-w-md p-5 slide-up max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Plus size={18} className="text-indigo-500" /> 上架官方商品
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(['seed', 'flower', 'tool'] as const).map((it) => (
                  <button key={it}
                    onClick={() => setNewItemType(it)}
                    className={classNames(
                      'py-2 rounded-xl text-xs font-medium border',
                      newItemType === it ? 'border-garden-500 bg-garden-50 text-garden-700' : 'border-slate-200 text-slate-600'
                    )}
                  >
                    {it === 'seed' ? '种子' : it === 'flower' ? '花朵' : '工具'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">图标（预设）</label>
                <div className="flex flex-wrap gap-1.5">
                  {['🌱','🌿','🌻','🌹','🌷','🌼','🌺','🍀','🌳','💧','🧪','🧴','⚡','🔧','🎁'].map((e) => (
                    <button key={e} type="button" onClick={() => setNewEmoji(e)}
                      className={classNames(
                        'w-8 h-8 rounded-lg text-lg flex items-center justify-center border',
                        newEmoji === e ? 'border-garden-500 bg-garden-50' : 'border-slate-200 hover:bg-slate-50'
                      )}>{e}</button>
                  ))}
                  <input className="input w-20 !py-1 text-center text-base" maxLength={4} value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} placeholder="🌱" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">商品名称</label>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：郁金香种子" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">引用ID <span className="text-xs text-slate-400 font-normal">（留空自动生成）</span></label>
                <input className="input font-mono text-xs" value={newRefId} onChange={(e) => setNewRefId(e.target.value)} placeholder="自动生成" />
              </div>
              {newItemType !== 'tool' && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    {newItemType === 'flower' ? '花朵等级 Rank' : '种子等级'}
                  </label>
                  <select value={newRank} onChange={(e) => setNewRank(Number(e.target.value))}
                    className="input">
                    {[1,2,3,4,5,6,7].map((r) => <option key={r} value={r}>{r} 级</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">单价 💰</label>
                  <input type="number" min="1" className="input" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">库存</label>
                  <input type="number" min="1" className="input" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} />
                </div>
              </div>
              {/* 快捷选择 */}
              <div className="pt-2">
                <div className="text-xs font-medium mb-2 text-slate-500">📋 快捷选择</div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {newItemType !== 'tool' && seedTypes.map((s) => (
                    <button key={'seed_' + s.id} onClick={() => seedPreset(s.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm">
                      <span>{s.emoji}</span><span className="flex-1">{s.name}</span>
                      <span className="text-xs text-slate-400">种子 {s.price}💰</span>
                    </button>
                  ))}
                  {newItemType === 'flower' && flowerTypes.map((f) => (
                    <button key={'flower_' + f.id} onClick={() => flowerPreset(f.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm">
                      <span>{f.emoji}</span><span className="flex-1">{f.name}</span>
                      <span className="text-xs text-slate-400">R{newRank} {Math.floor(((flowerEdits[f.id]?.baseSellPrice ?? f.baseSellPrice) || 10) * (([1,1.5,2.2,3.2,5,8,15][newRank-1])||1))}💰</span>
                    </button>
                  ))}
                  {newItemType === 'tool' && toolTypes.map((t) => (
                    <button key={'tool_' + t.id} onClick={() => toolPreset(t.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm">
                      <span>{t.emoji}</span><span className="flex-1">{t.name}</span>
                      <span className="text-xs text-slate-400">{toolEdits[t.id]?.price ?? t.price}💰</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={createListing} disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? '上架中...' : '确认上架'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
