'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber, formatDateTime } from '@/lib/utils'
import {
  Settings, Users, MessageSquare, TrendingUp, Gift, Coins, Flower2, Tag, Plus, X,
  Search, Ban, Crown, Shield, AlertCircle, Bell, Trash2, Edit
} from 'lucide-react'
import LoginModal from '@/components/LoginModal'

type Tab = 'dashboard' | 'users' | 'announcements' | 'market' | 'cdk'

export default function AdminPage() {
  const { user, showToast } = useAppStore()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [authed, setAuthed] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [cdks, setCdks] = useState<any[]>([])

  const [showAnnForm, setShowAnnForm] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal')
  const [loading, setLoading] = useState<string | null>(null)

  const [showCDKForm, setShowCDKForm] = useState(false)
  const [cdkCoins, setCdkCoins] = useState(0)
  const [cdkCount, setCdkCount] = useState(1)
  const [cdkDays, setCdkDays] = useState(30)

  useEffect(() => {
    const stored = localStorage.getItem('garden-app-storage')
    let isAdmin = user?.isAdmin
    if (!isAdmin && stored) {
      try { isAdmin = JSON.parse(stored).state?.user?.isAdmin } catch {}
    }
    setAuthed(!!isAdmin)
    if (isAdmin) loadAll()
  }, [user?.isAdmin])

  const loadAll = async () => {
    const [uRes, aRes, sRes, cRes] = await Promise.all([
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/announcements'),
      apiFetch('/api/admin/stats'),
      apiFetch('/api/admin/cdks'),
    ])
    if (uRes.success) setUsers(uRes.data)
    if (aRes.success) setAnnouncements(aRes.data)
    if (sRes.success) setStats(sRes.data)
    if (cRes.success) setCdks(cRes.data)
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
            <Shield size={32} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-slate-800">管理员权限验证失败</h1>
          <p className="text-sm text-slate-500 mb-5">请使用管理员账号登录后访问</p>
          <button onClick={() => setShowLogin(true)} className="btn-primary">
            管理员登录
          </button>
          <p className="text-xs text-slate-400 mt-3">
            测试账号: admin / admin123
          </p>
        </div>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => { window.location.reload() }} />}
      </div>
    )
  }

  const deleteAnn = async (id: string) => {
    if (!confirm('确定删除此公告？')) return
    const res = await apiFetch('/api/admin/announcements/' + id, { method: 'DELETE' })
    if (res.success) {
      showToast('已删除', 'success')
      loadAll()
    } else showToast(res.error || '删除失败', 'error')
  }

  const postAnn = async () => {
    if (!annTitle.trim() || !annContent.trim()) return showToast('请填写完整', 'error')
    setLoading('ann')
    const res = await apiFetch('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ title: annTitle, content: annContent, priority: annPriority })
    })
    if (res.success) {
      showToast('发布成功', 'success')
      setShowAnnForm(false); setAnnTitle(''); setAnnContent(''); setAnnPriority('normal')
      loadAll()
    } else showToast(res.error || '发布失败', 'error')
    setLoading(null)
  }

  const genCDK = async () => {
    if (cdkCount < 1) return showToast('数量无效', 'error')
    setLoading('cdk')
    const res = await apiFetch('/api/admin/cdks', {
      method: 'POST',
      body: JSON.stringify({
        count: cdkCount, coins: cdkCoins, days: cdkDays
      })
    })
    if (res.success) {
      showToast(`生成了 ${cdkCount} 个 CDK`, 'success')
      setShowCDKForm(false)
      loadAll()
    } else showToast(res.error || '生成失败', 'error')
    setLoading(null)
  }

  const muteUser = async (userId: string, days: number) => {
    const res = await apiFetch('/api/admin/mute', {
      method: 'POST',
      body: JSON.stringify({ userId, days })
    })
    if (res.success) {
      showToast(days > 0 ? `已禁言 ${days} 天` : '已解除禁言', 'success')
      loadAll()
    } else showToast(res.error || '操作失败', 'error')
  }

  const tabs: { k: Tab; label: string; icon: any }[] = [
    { k: 'dashboard', label: '数据总览', icon: TrendingUp },
    { k: 'users', label: '用户管理', icon: Users },
    { k: 'announcements', label: '公告管理', icon: Bell },
    { k: 'market', label: '市场调控', icon: Tag },
    { k: 'cdk', label: 'CDK管理', icon: Gift },
  ]

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg">花园 · 管理员后台</h1>
            <p className="text-xs text-slate-400">管理用户、公告、市场、CDK</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-300 flex items-center gap-1">
              <Crown size={14} className="text-amber-400" />
              {user?.nickname || '管理员'}
            </span>
            <a href="/garden" className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              ← 返回游戏
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 flex gap-4 flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="md:w-56 flex-shrink-0">
          <div className="card p-2 space-y-1 sticky top-4">
            {tabs.map(t => {
              const Icon = t.icon
              const active = tab === t.k
              return (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={classNames(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-gradient-to-r from-garden-500 to-emerald-500 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  )}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {/* Dashboard */}
          {tab === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '在线用户', value: stats?.online || 3, icon: Users, color: 'from-blue-400 to-blue-600' },
                  { label: '今日注册', value: stats?.newUsers || users.filter(u => (Date.now() - u.createdAt) < 86400000).length, icon: Gift, color: 'from-green-400 to-emerald-600' },
                  { label: '今日交易', value: formatNumber(stats?.trade || 1280), icon: Tag, color: 'from-amber-400 to-orange-500' },
                  { label: '用户总数', value: users.length, icon: MessageSquare, color: 'from-purple-400 to-pink-500' },
                ].map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <div key={idx} className="card p-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 shadow-sm`}>
                        <Icon size={20} className="text-white" />
                      </div>
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className="text-2xl font-bold text-slate-800 mt-1">{item.value}</div>
                    </div>
                  )
                })}
              </div>
              <div className="card p-5">
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" />
                  服务器状态
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-garden-50 rounded-xl border border-garden-200">
                    <div className="text-xs text-slate-500">运行状态</div>
                    <div className="font-bold text-garden-700 flex items-center gap-1 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-garden-500 animate-pulse" /> 正常运行
                    </div>
                  </div>
                  <div className="p-3 bg-garden-50 rounded-xl border border-garden-200">
                    <div className="text-xs text-slate-500">游戏季节</div>
                    <div className="font-bold text-garden-700 mt-0.5">
                      {stats?.season || '春季'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">用户列表</h3>
                <span className="chip bg-slate-100 text-slate-600">共 {users.length} 人</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="text-left p-3 font-medium">用户</th>
                      <th className="text-left p-3 font-medium">ID</th>
                      <th className="text-left p-3 font-medium">金币</th>
                      <th className="text-left p-3 font-medium">注册时间</th>
                      <th className="text-left p-3 font-medium">状态</th>
                      <th className="text-left p-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{u.avatar}</span>
                            <div>
                              <div className="font-medium text-slate-800">
                                {u.nickname}
                                {u.isAdmin && <Crown size={12} className="inline ml-1 text-amber-500" />}
                              </div>
                              <div className="text-[11px] text-slate-400">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-xs">{u.id}</td>
                        <td className="p-3 text-amber-600 font-medium">{formatNumber(u.coins)}</td>
                        <td className="p-3 text-slate-500 text-xs">{formatDateTime(u.createdAt).slice(0, 16)}</td>
                        <td className="p-3">
                          {u.mutedUntil && u.mutedUntil > Date.now() ? (
                            <span className="chip bg-red-100 text-red-700">禁言中</span>
                          ) : (
                            <span className="chip bg-green-100 text-green-700">正常</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {u.mutedUntil && u.mutedUntil > Date.now() ? (
                              <button
                                onClick={() => muteUser(u.id, 0)}
                                className="p-1.5 rounded-lg hover:bg-garden-50 text-garden-600"
                                title="解除禁言"
                              >
                                <Shield size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => muteUser(u.id, 1)}
                                disabled={u.isAdmin}
                                className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 disabled:opacity-30"
                                title="禁言 1 天"
                              >
                                <Ban size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Announcements */}
          {tab === 'announcements' && (
            <div className="space-y-4">
              <div className="card p-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">公告列表</h3>
                <button onClick={() => setShowAnnForm(true)} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
                  <Plus size={16} /> 发布公告
                </button>
              </div>
              <div className="space-y-3">
                {announcements.length === 0 && (
                  <div className="card p-8 text-center text-slate-400 text-sm">暂无公告</div>
                )}
                {announcements.map(a => (
                  <div key={a.id} className={`card p-4 ${
                    a.priority === 'urgent' ? 'ring-2 ring-amber-300' :
                      a.priority === 'important' ? 'ring-1 ring-blue-200' : ''
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-bold text-slate-800">{a.title}</span>
                          <span className={`chip text-[10px] ${
                            a.priority === 'urgent' ? 'bg-amber-100 text-amber-700' :
                              a.priority === 'important' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                          }`}>
                            {a.priority === 'urgent' ? '紧急' : a.priority === 'important' ? '重要' : '普通'}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatDateTime(a.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.content}</p>
                      </div>
                      <button
                        onClick={() => deleteAnn(a.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market */}
          {tab === 'market' && (
            <div className="card p-5">
              <h3 className="font-bold text-slate-800 mb-4">官方收购价调控 (MVP 功能：此页面展示花品种基础信息)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="text-left p-3 font-medium">花品种</th>
                      <th className="text-left p-3 font-medium">适宜季节</th>
                      <th className="text-left p-3 font-medium">最高等级</th>
                      <th className="text-left p-3 font-medium">基础收购价</th>
                      <th className="text-left p-3 font-medium">种子价</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { n: '玫瑰🌹', s: '春夏', r: '钻石', b: 30, seed: 18 },
                      { n: '郁金香🌷', s: '春', r: '铂金', b: 25, seed: 15 },
                      { n: '向日葵🌻', s: '夏', r: '铂金', b: 20, seed: 12 },
                      { n: '雏菊🌼', s: '春秋', r: '黄金', b: 12, seed: 8 },
                      { n: '菊花🏵️', s: '秋', r: '铂金', b: 28, seed: 16 },
                      { n: '梅花🌸', s: '冬', r: '传说', b: 60, seed: 30 },
                    ].map((x, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-3 font-medium text-slate-700">{x.n}</td>
                        <td className="p-3 text-slate-600">{x.s}</td>
                        <td className="p-3">{x.r}</td>
                        <td className="p-3 text-amber-600 font-medium">{x.b} 💰</td>
                        <td className="p-3 text-slate-600">{x.seed} 💰</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CDK */}
          {tab === 'cdk' && (
            <div className="space-y-4">
              <div className="card p-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">CDK 列表</h3>
                <button onClick={() => setShowCDKForm(true)} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
                  <Plus size={16} /> 生成 CDK
                </button>
              </div>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs">
                      <tr>
                        <th className="text-left p-3 font-medium">CDK 码</th>
                        <th className="text-left p-3 font-medium">奖励</th>
                        <th className="text-left p-3 font-medium">使用次数</th>
                        <th className="text-left p-3 font-medium">有效期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cdks.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-sm">暂无 CDK</td></tr>
                      )}
                      {cdks.map((c, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="p-3 font-mono font-bold text-purple-600">{c.code}</td>
                          <td className="p-3 text-slate-600">
                            {c.rewards?.coins ? `${c.rewards.coins} 💰` : '-'}
                          </td>
                          <td className="p-3 text-slate-600">{c.usedCount} / {c.maxUses}</td>
                          <td className="p-3 text-slate-600 text-xs">
                            {c.expiresAt ? formatDateTime(c.expiresAt).slice(0, 16) : '永久'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Ann Form */}
      {showAnnForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAnnForm(false)}>
          <div className="card w-full max-w-md p-5 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800">发布公告</h2>
              <button onClick={() => setShowAnnForm(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">标题</label>
                <input className="input" value={annTitle} onChange={e => setAnnTitle(e.target.value)} maxLength={50} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">优先级</label>
                <div className="grid grid-cols-3 gap-2">
                  {([['normal', '普通', 'bg-slate-100'], ['important', '重要', 'bg-blue-100 text-blue-700'], ['urgent', '紧急', 'bg-amber-100 text-amber-700']] as const).map(([v, l, c]) => (
                    <button
                      key={v}
                      onClick={() => setAnnPriority(v)}
                      className={classNames(
                        'py-2 rounded-lg text-sm font-medium border-2 transition-all',
                        annPriority === v ? c + ' border-transparent' : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                      )}
                    >{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">内容</label>
                <textarea className="input min-h-[120px] resize-none" value={annContent} onChange={e => setAnnContent(e.target.value)} maxLength={500} />
              </div>
              <button onClick={postAnn} disabled={loading === 'ann'} className="btn-primary w-full py-2.5">
                {loading === 'ann' ? '发布中...' : '立即发布'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CDK Form */}
      {showCDKForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCDKForm(false)}>
          <div className="card w-full max-w-md p-5 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Gift size={20} className="text-purple-500" /> 生成 CDK</h2>
              <button onClick={() => setShowCDKForm(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">数量</label>
                  <input type="number" min={1} max={100} className="input" value={cdkCount} onChange={e => setCdkCount(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">有效期 (天)</label>
                  <input type="number" min={1} className="input" value={cdkDays} onChange={e => setCdkDays(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">金币奖励</label>
                <input type="number" min={0} className="input" value={cdkCoins} onChange={e => setCdkCoins(Math.max(0, parseInt(e.target.value) || 0))} />
              </div>
              <div className="p-3 bg-purple-50 rounded-xl text-sm text-purple-700">
                即将生成 <b>{cdkCount}</b> 个 CDK，每个奖励 <b>{cdkCoins} 💰</b>，有效期 <b>{cdkDays} 天</b>
              </div>
              <button onClick={genCDK} disabled={loading === 'cdk'} className="btn-primary w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                {loading === 'cdk' ? '生成中...' : '确认生成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
