'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, classNames } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { SEED_TYPES, FLOWER_TYPES, TOOLS } from '@/lib/game-data'
import { ClipboardList, Plus, X, Edit, Trash2, Power, Coins, Gift, Calendar, CalendarDays, Award } from 'lucide-react'

// 触发行为选项
const ACTION_OPTIONS = [
  { value: 'login', label: '登录游戏', desc: '每日首次登录自动完成' },
  { value: 'plant', label: '种植花朵', desc: '种下任意一朵花' },
  { value: 'water', label: '浇水', desc: '给花朵浇水' },
  { value: 'fertilize', label: '施肥', desc: '给花朵施肥' },
  { value: 'pesticide', label: '除虫', desc: '给花朵除虫' },
  { value: 'speedup', label: '加速卡', desc: '使用加速卡' },
  { value: 'harvest', label: '收获花朵', desc: '收获成熟的花朵' },
  { value: 'chat', label: '聊天发言', desc: '在任意频道发言' },
  { value: 'trade', label: '市场交易', desc: '买入或卖出物品' },
  { value: 'unlock', label: '解锁地块', desc: '花费金币解锁新地块' },
  { value: 'earn_coin', label: '获得金币', desc: '通过任意途径获得金币' },
]

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  daily: { label: '每日', icon: Calendar, color: 'bg-blue-100 text-blue-700' },
  weekly: { label: '每周', icon: CalendarDays, color: 'bg-purple-100 text-purple-700' },
  monthly: { label: '每月', icon: Award, color: 'bg-amber-100 text-amber-700' },
}

interface TaskTemplate {
  id: string
  type: string
  title: string
  description: string
  target: number
  action: string
  rewards: { coins?: number; items?: any[] }
  enabled: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export default function TaskManagement() {
  const { showToast } = useAppStore()
  const [tasks, setTasks] = useState<TaskTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TaskTemplate | null>(null)

  // 表单状态
  const [fType, setFType] = useState('daily')
  const [fTitle, setFTitle] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fAction, setFAction] = useState('login')
  const [fTarget, setFTarget] = useState(1)
  const [fCoins, setFCoins] = useState(10)
  const [fItems, setFItems] = useState<any[]>([])
  const [fSort, setFSort] = useState(99)
  const [fEnabled, setFEnabled] = useState(true)
  const [fItemId, setFItemId] = useState('')
  const [fItemQty, setFItemQty] = useState(1)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/tasks')
      if (res.success) setTasks(res.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const openCreate = () => {
    setEditing(null)
    setFType('daily')
    setFTitle('')
    setFDesc('')
    setFAction('login')
    setFTarget(1)
    setFCoins(10)
    setFItems([])
    setFSort(99)
    setFEnabled(true)
    setShowForm(true)
  }

  const openEdit = (t: TaskTemplate) => {
    setEditing(t)
    setFType(t.type)
    setFTitle(t.title)
    setFDesc(t.description)
    setFAction(t.action)
    setFTarget(t.target)
    setFCoins(t.rewards?.coins || 0)
    setFItems(t.rewards?.items || [])
    setFSort(t.sortOrder)
    setFEnabled(t.enabled)
    setShowForm(true)
  }

  const save = async () => {
    if (!fTitle.trim()) { showToast('请输入任务标题', 'error'); return }
    const rewards: any = { coins: Number(fCoins) || 0 }
    if (fItems.length > 0) rewards.items = fItems

    const body = {
      op: editing ? 'update' : 'create',
      id: editing?.id,
      type: fType,
      title: fTitle.trim(),
      description: fDesc.trim(),
      target: Number(fTarget) || 1,
      action: fAction,
      rewards,
      enabled: fEnabled,
      sortOrder: Number(fSort) || 99,
    }
    const res = await apiFetch('/api/admin/tasks', { method: 'POST', body: JSON.stringify(body) })
    if (res.success) {
      showToast(editing ? '保存成功' : '创建成功', 'success')
      setShowForm(false)
      refresh()
    } else {
      showToast(res.error || '保存失败', 'error')
    }
  }

  const toggle = async (t: TaskTemplate) => {
    const res = await apiFetch('/api/admin/tasks', {
      method: 'POST',
      body: JSON.stringify({ op: 'toggle', id: t.id, enabled: !t.enabled })
    })
    if (res.success) {
      showToast(t.enabled ? '已禁用' : '已启用', 'success')
      refresh()
    } else {
      showToast(res.error || '操作失败', 'error')
    }
  }

  const remove = async (t: TaskTemplate) => {
    if (!confirm(`确定删除任务「${t.title}」吗？已记录的玩家进度不会被清除。`)) return
    const res = await apiFetch('/api/admin/tasks', {
      method: 'POST',
      body: JSON.stringify({ op: 'delete', id: t.id })
    })
    if (res.success) {
      showToast('删除成功', 'success')
      refresh()
    } else {
      showToast(res.error || '删除失败', 'error')
    }
  }

  const addItem = () => {
    if (!fItemId) return
    const [itype, iref] = fItemId.split(':')
    let name = '', emoji = '🎁'
    if (itype === 'seed') {
      const s = SEED_TYPES.find(s => s.id === iref)
      name = s?.name || '种子'; emoji = '🌱'
    } else if (itype === 'flower') {
      const f = FLOWER_TYPES.find(f => f.id === iref)
      name = f?.name || '花'; emoji = f?.emoji || '🌸'
    } else if (itype === 'tool') {
      const t = TOOLS.find(t => t.id === iref)
      name = t?.name || '工具'; emoji = t?.emoji || '🔧'
    }
    setFItems([...fItems, { referenceId: iref, type: itype, quantity: Number(fItemQty) || 1, name, emoji }])
    setFItemId(''); setFItemQty(1)
  }

  const removeItem = (idx: number) => {
    setFItems(fItems.filter((_, i) => i !== idx))
  }

  const filtered = filterType === 'all' ? tasks : tasks.filter(t => t.type === filterType)

  const allItems = [
    ...SEED_TYPES.map(s => ({ value: `seed:${s.id}`, label: `${s.emoji} ${s.name}` })),
    ...FLOWER_TYPES.map(f => ({ value: `flower:${f.id}`, label: `${f.emoji} ${f.name}` })),
    ...TOOLS.map(t => ({ value: `tool:${t.id}`, label: `${t.emoji} ${t.name}` })),
  ]

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
          <ClipboardList size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800">任务中心管理</h2>
          <p className="text-xs text-slate-500">配置每日/每周/每月任务，设置完成条件和奖励</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-gradient-to-r from-garden-500 to-emerald-500 text-white text-sm font-medium flex items-center gap-1 hover:shadow-md transition-all">
          <Plus size={16} /> 新建任务
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2">
        {(['all', 'daily', 'weekly', 'monthly'] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={classNames('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              filterType === t ? 'bg-garden-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
            {t === 'all' ? '全部' : TYPE_LABELS[t]?.label || t}
          </button>
        ))}
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-slate-400 text-sm">
          <ClipboardList size={36} className="mx-auto mb-2 text-slate-300" />
          暂无任务，点击「新建任务」创建
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const typeInfo = TYPE_LABELS[t.type] || TYPE_LABELS.daily
            const actionInfo = ACTION_OPTIONS.find(a => a.value === t.action)
            const TIcon = typeInfo.icon
            return (
              <div key={t.id} className={classNames('card p-4 transition-all', !t.enabled && 'opacity-50')}>
                <div className="flex items-start gap-3">
                  <div className={classNames('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', typeInfo.color)}>
                    <TIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800 text-sm">{t.title}</h3>
                      <span className={classNames('chip text-[10px]', typeInfo.color)}>{typeInfo.label}</span>
                      <span className="chip bg-slate-100 text-slate-600 text-[10px]">{actionInfo?.label || t.action}</span>
                      {!t.enabled && <span className="chip bg-red-100 text-red-600 text-[10px]">已禁用</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{t.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                      <span className="flex items-center gap-1"><ClipboardList size={12} /> 目标: {t.target}</span>
                      {t.rewards?.coins ? <span className="flex items-center gap-1"><Coins size={12} className="text-amber-500" /> {t.rewards.coins}</span> : null}
                      {t.rewards?.items?.map((it, i) => (
                        <span key={i} className="flex items-center gap-1"><Gift size={12} className="text-purple-500" /> {it.name || it.referenceId} ×{it.quantity}</span>
                      ))}
                      <span className="text-slate-400">排序: {t.sortOrder}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggle(t)} title={t.enabled ? '禁用' : '启用'}
                      className={classNames('p-2 rounded-lg transition-colors', t.enabled ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-garden-50 text-garden-600')}>
                      <Power size={16} />
                    </button>
                    <button onClick={() => openEdit(t)} title="编辑" className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => remove(t)} title="删除" className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-lg p-5 slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800">{editing ? '编辑任务' : '新建任务'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {/* 类型 */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">任务类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(t => {
                    const info = TYPE_LABELS[t]
                    const Icon = info.icon
                    return (
                      <button key={t} onClick={() => setFType(t)}
                        className={classNames('py-2.5 rounded-lg text-sm font-medium border-2 transition-all flex items-center justify-center gap-1.5',
                          fType === t ? 'border-garden-400 bg-garden-50 text-garden-700' : 'border-slate-100 hover:bg-slate-50 text-slate-600')}>
                        <Icon size={14} /> {info.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 标题 */}
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">任务标题</label>
                <input className="input" value={fTitle} onChange={e => setFTitle(e.target.value)} maxLength={30} placeholder="如：登录游戏" />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">任务描述</label>
                <input className="input" value={fDesc} onChange={e => setFDesc(e.target.value)} maxLength={60} placeholder="如：今日首次登录游戏" />
              </div>

              {/* 触发行为 + 目标 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">触发行为</label>
                  <select className="input" value={fAction} onChange={e => setFAction(e.target.value)}>
                    {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">{ACTION_OPTIONS.find(a => a.value === fAction)?.desc}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">完成目标数</label>
                  <input type="number" min={1} className="input" value={fTarget} onChange={e => setFTarget(Number(e.target.value))} />
                </div>
              </div>

              {/* 奖励 */}
              <div className="border-t pt-3">
                <label className="block text-sm font-medium mb-2 text-slate-700">奖励</label>
                <div className="flex items-center gap-2 mb-3">
                  <Coins size={18} className="text-amber-500" />
                  <input type="number" min={0} className="input flex-1" value={fCoins} onChange={e => setFCoins(Number(e.target.value))} placeholder="金币奖励" />
                </div>

                {/* 物品奖励 */}
                <div className="space-y-2">
                  {fItems.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                      <span className="text-sm flex-1">{it.emoji} {it.name} ×{it.quantity}</span>
                      <button onClick={() => removeItem(idx)} className="p-1 hover:bg-red-100 rounded text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <select className="input flex-1" value={fItemId} onChange={e => setFItemId(e.target.value)}>
                      <option value="">选择物品...</option>
                      {allItems.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}
                    </select>
                    <input type="number" min={1} className="input w-20" value={fItemQty} onChange={e => setFItemQty(Number(e.target.value))} />
                    <button onClick={addItem} disabled={!fItemId} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm disabled:opacity-50">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 排序 + 启用 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">排序权重</label>
                  <input type="number" className="input" value={fSort} onChange={e => setFSort(Number(e.target.value))} placeholder="数字越小越靠前" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">启用状态</label>
                  <button onClick={() => setFEnabled(!fEnabled)}
                    className={classNames('w-full py-2.5 rounded-lg text-sm font-medium border-2 transition-all',
                      fEnabled ? 'border-garden-400 bg-garden-50 text-garden-700' : 'border-slate-100 text-slate-400')}>
                    {fEnabled ? '✅ 已启用' : '⏸️ 已禁用'}
                  </button>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200">取消</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-garden-500 to-emerald-500 text-white text-sm font-medium hover:shadow-md">
                {editing ? '保存修改' : '创建任务'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
