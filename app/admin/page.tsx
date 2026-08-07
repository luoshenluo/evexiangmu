'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber, formatDateTime } from '@/lib/utils'
import {
  Settings, Users, MessageSquare, TrendingUp, Gift, Coins, Tag, Plus, X,
  Search, Ban, Crown, Shield, AlertCircle, Bell, Trash2, Edit, Key,
  RefreshCw, Lock, Unlock, UserCheck, UserX, Eye
} from 'lucide-react'
import LoginModal from '@/components/LoginModal'
import ChatManagement from '@/components/admin/ChatManagement'
import SensitiveWords from '@/components/admin/SensitiveWords'
import ChatSettingsPanel from '@/components/admin/ChatSettingsPanel'

type Tab = 'dashboard' | 'users' | 'announcements' | 'chat' | 'sensitive' | 'market' | 'cdk' | 'settings'

export default function AdminPage() {
  const { user, showToast } = useAppStore()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [authed, setAuthed] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [cdks, setCdks] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const [showAnnForm, setShowAnnForm] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal')

  const [showCDKForm, setShowCDKForm] = useState(false)
  const [cdkCoins, setCdkCoins] = useState(0)
  const [cdkCount, setCdkCount] = useState(1)
  const [cdkDays, setCdkDays] = useState(30)

  const [loading, setLoading] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPwdChange, setShowPwdChange] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const loadAll = useCallback(async () => {
    setRefreshing(true)
    try {
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
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('garden-app-storage')
    let isAdmin = user?.isAdmin
    if (!isAdmin && stored) {
      try { isAdmin = JSON.parse(stored).state?.user?.isAdmin } catch {}
    }
    setAuthed(!!isAdmin)
  }, [user?.isAdmin])

  useEffect(() => {
    if (authed) {
      loadAll()
      const interval = setInterval(() => {
        setRefreshTick(t => t + 1)
        loadAll()
      }, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [authed, loadAll])

  useEffect(() => {
    if (authed && refreshTick > 0) {
      loadAll()
    }
  }, [refreshTick])

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
        </div>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => { window.location.reload() }} />}
      </div>
    )
  }

  const deleteAnn = async (id: string) => {
    if (!confirm('确定删除此公告？')) return
    const res = await apiFetch('/api/admin/announcements/' + id, { method: 'DELETE' })
    if (res.success) { showToast('已删除', 'success'); loadAll() }
    else showToast(res.error || '删除失败', 'error')
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
      body: JSON.stringify({ count: cdkCount, coins: cdkCoins, days: cdkDays })
    })
    if (res.success) {
      showToast(`生成了 ${cdkCount} 个 CDK`, 'success')
      setShowCDKForm(false); loadAll()
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

  const updateUserPermission = async (userId: string, isAdmin: boolean) => {
    setLoading(`perm_${userId}`)
    const res = await apiFetch('/api/admin/users/action', {
      method: 'POST',
      body: JSON.stringify({ userId, makeAdmin: isAdmin })
    })
    if (res.success) {
      showToast(isAdmin ? '已设为管理员' : '已取消管理员权限', 'success')
      loadAll()
    } else showToast(res.error || '操作失败', 'error')
    setLoading(null)
  }

  const resetUserPassword = async (userId: string) => {
    if (!newPassword.trim()) return showToast('请输入新密码', 'error')
    setLoading(`pwd_${userId}`)
    const res = await apiFetch('/api/admin/users/action', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword })
    })
    if (res.success) {
      showToast('密码已重置', 'success')
      setEditingUser(null); setNewPassword('')
      loadAll()
    } else showToast(res.error || '重置失败', 'error')
    setLoading(null)
  }

  const changeMyPassword = async () => {
    if (!oldPwd.trim() || !newPwd.trim()) return showToast('请填写完整', 'error')
    if (newPwd.length < 4) return showToast('新密码至少4位', 'error')
    setLoading('mypwd')
    const res = await apiFetch('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
    })
    if (res.success) {
      showToast('密码修改成功', 'success')
      setShowPwdChange(false); setOldPwd(''); setNewPwd('')
    } else showToast(res.error || '修改失败', 'error')
    setLoading(null)
  }

  const filteredUsers = users.filter(u =>
    !searchTerm ||
    u.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id?.toString().includes(searchTerm)
  )

  const tabs: { k: Tab; label: string; icon: any }[] = [
    { k: 'dashboard', label: '数据总览', icon: TrendingUp },
    { k: 'users', label: '用户管理', icon: Users },
    { k: 'announcements', label: '公告管理', icon: Bell },
    { k: 'chat', label: '聊天管理', icon: MessageSquare },
    { k: 'sensitive', label: '敏感词库', icon: Shield },
    { k: 'market', label: '市场调控', icon: Tag },
    { k: 'cdk', label: 'CDK管理', icon: Gift },
    { k: 'settings', label: '系统设置', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg">花园 · 管理员后台</h1>
            <p className="text-xs text-slate-400">管理用户、公告、市场、CDK</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => loadAll()}
              disabled={refreshing}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
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

        <main className="flex-1 min-w-0">
          {tab === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '在线用户', value: stats?.onlineUsers || 0, icon: Users, color: 'from-blue-400 to-blue-600' },
                  { label: '今日注册', value: stats?.todayNewUsers || 0, icon: Gift, color: 'from-green-400 to-emerald-600' },
                  { label: '今日消息', value: stats?.todayMessages || 0, icon: MessageSquare, color: 'from-amber-400 to-orange-500' },
                  { label: '用户总数', value: stats?.totalUsers || 0, icon: TrendingUp, color: 'from-purple-400 to-pink-500' },
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

              <div className="grid grid-cols-2 gap-3">
                <div className="card p-5">
                  <h3 className="font-bold text-slate-800 mb-3">市场数据</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">挂售订单</span>
                      <span className="font-bold text-slate-800">{stats?.totalListings || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">收购订单</span>
                      <span className="font-bold text-slate-800">{stats?.totalBuyOrders || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-slate-800 mb-3">服务器状态</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-garden-50 rounded-xl border border-garden-200">
                      <div className="text-xs text-slate-500">运行状态</div>
                      <div className="font-bold text-garden-700 flex items-center gap-1 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-garden-500 animate-pulse" /> 正常运行
                      </div>
                    </div>
                    <div className="p-3 bg-garden-50 rounded-xl border border-garden-200">
                      <div className="text-xs text-slate-500">游戏季节</div>
                      <div className="font-bold text-garden-700 mt-0.5">{stats?.season || '春季'}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-400 text-center">
                数据每 5 分钟自动刷新 · 最后更新: {stats ? formatDateTime(Date.now()) : '加载中...'}
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-3">
              <div className="card p-3 flex items-center gap-3">
                <Search size={16} className="text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="搜索用户名、昵称或ID..."
                  className="flex-1 text-sm bg-transparent outline-none"
                />
                <span className="chip bg-slate-100 text-slate-600 text-xs">共 {filteredUsers.length} 人</span>
              </div>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs">
                      <tr>
                        <th className="text-left p-3 font-medium">用户</th>
                        <th className="text-left p-3 font-medium">金币</th>
                        <th className="text-left p-3 font-medium">状态</th>
                        <th className="text-left p-3 font-medium">管理员</th>
                        <th className="text-left p-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">无用户</td></tr>
                      )}
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{u.avatar}</span>
                              <div>
                                <div className="font-medium text-slate-800 flex items-center gap-1">
                                  {u.nickname}
                                  {u.isAdmin && <Crown size={12} className="text-amber-500" />}
                                </div>
                                <div className="text-[11px] text-slate-400">@{u.username} · ID: {u.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-amber-600 font-medium">{formatNumber(u.coins)}</td>
                          <td className="p-3">
                            {u.mutedUntil && u.mutedUntil > Date.now() ? (
                              <span className="chip bg-red-100 text-red-700">
                                <Ban size={10} className="inline mr-1" /> 禁言中
                              </span>
                            ) : (
                              <span className="chip bg-green-100 text-green-700">正常</span>
                            )}
                          </td>
                          <td className="p-3">
                            {u.isAdmin ? (
                              <Crown size={14} className="text-amber-500" />
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {u.mutedUntil && u.mutedUntil > Date.now() ? (
                                <button onClick={() => muteUser(u.id, 0)} className="p-1.5 rounded-lg hover:bg-garden-50 text-garden-600" title="解除禁言">
                                  <Unlock size={14} />
                                </button>
                              ) : (
                                <button onClick={() => muteUser(u.id, 1)} disabled={u.isAdmin} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 disabled:opacity-30" title="禁言 1 天">
                                  <Ban size={14} />
                                </button>
                              )}
                              {!u.isAdmin && (
                                <button onClick={() => updateUserPermission(u.id, true)} disabled={loading?.startsWith('perm_')} className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600" title="设为管理员">
                                  <UserCheck size={14} />
                                </button>
                              )}
                              {u.isAdmin && u.id !== 'admin' && (
                                <button onClick={() => updateUserPermission(u.id, false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="取消管理员">
                                  <UserX size={14} />
                                </button>
                              )}
                              <button onClick={() => { setEditingUser(u); setNewPassword('') }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="重置密码">
                                <Key size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'announcements' && (
            <div className="space-y-4">
              <div className="card p-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">公告列表</h3>
                <button onClick={() => setShowAnnForm(true)} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
                  <Plus size={16} /> 发布公告
                </button>
              </div>
              {announcements.length === 0 && (
                <div className="card p-8 text-center text-slate-400 text-sm">暂无公告</div>
              )}
              {announcements.map(a => (
                <div key={a.id} className={`card p-4 ${a.priority === 'urgent' ? 'ring-2 ring-amber-300' : a.priority === 'important' ? 'ring-1 ring-blue-200' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="font-bold text-slate-800">{a.title}</span>
                        <span className={`chip text-[10px] ${a.priority === 'urgent' ? 'bg-amber-100 text-amber-700' : a.priority === 'important' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {a.priority === 'urgent' ? '紧急' : a.priority === 'important' ? '重要' : '普通'}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDateTime(a.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.content}</p>
                    </div>
                    <button onClick={() => deleteAnn(a.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'chat' && <ChatManagement />}

          {tab === 'sensitive' && <SensitiveWords />}

          {tab === 'market' && (
            <div className="card p-5">
              <h3 className="font-bold text-slate-800 mb-4">花品种基础信息</h3>
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
                          <td className="p-3 text-slate-600">{c.rewards?.coins ? `${c.rewards.coins} 💰` : '-'}</td>
                          <td className="p-3 text-slate-600">{c.usedCount} / {c.maxUses}</td>
                          <td className="p-3 text-slate-600 text-xs">{c.expiresAt ? formatDateTime(c.expiresAt).slice(0, 16) : '永久'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              <ChatSettingsPanel />

              <div className="card p-5">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Key size={18} className="text-blue-500" /> 修改管理员密码
                </h3>
                <div className="space-y-3 max-w-sm">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">原密码</label>
                    <input type="password" className="input" value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">新密码 (至少4位)</label>
                    <input type="password" className="input" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                  </div>
                  <button onClick={changeMyPassword} disabled={loading === 'mypwd'} className="btn-primary w-full py-2.5">
                    {loading === 'mypwd' ? '修改中...' : '确认修改'}
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" /> 权限说明
                </h3>
                <div className="text-sm text-slate-600 space-y-2">
                  <p>• 超级管理员 (ID: admin) 拥有全部权限，不能被取消权限</p>
                  <p>• 子管理员可由超级管理员设置，具备公告发布、用户管理、禁言等权限</p>
                  <p>• 所有管理员操作会被记录</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

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
                  {([['normal', '普通'], ['important', '重要'], ['urgent', '紧急']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setAnnPriority(v)} className={classNames('py-2 rounded-lg text-sm font-medium border-2 transition-all', annPriority === v ? 'border-garden-400 bg-garden-50 text-garden-700' : 'border-slate-100 hover:bg-slate-50 text-slate-600')}>{l}</button>
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

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
          <div className="card w-full max-w-md p-5 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Key size={18} className="text-blue-500" /> 重置密码</h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-700">
                目标用户: <b>{editingUser.nickname}</b> (@{editingUser.username})
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">新密码 (至少4位)</label>
                <input type="text" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <button onClick={() => resetUserPassword(editingUser.id)} disabled={loading?.startsWith('pwd_')} className="btn-primary w-full py-2.5">
                {loading?.startsWith('pwd_') ? '重置中...' : '确认重置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
