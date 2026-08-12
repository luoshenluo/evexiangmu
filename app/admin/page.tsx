'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber, formatDateTime } from '@/lib/utils'
import { ADMIN_PERMISSIONS, userHasPermission, isSuperAdmin as _isSuperAdmin } from '@/lib/auth'
import { SEED_TYPES, FLOWER_TYPES, TOOLS } from '@/lib/game-data'
import type { ItemType } from '@/lib/types'
import {
  Settings, Users, MessageSquare, TrendingUp, Gift, Coins, Tag, Plus, X,
  Search, Ban, Crown, Shield, AlertCircle, Bell, Trash2, Edit, Key,
  RefreshCw, Lock, Unlock, UserCheck, UserX, Eye, Leaf, Flower2, Medal, Sparkles, Hammer,
  ClipboardList
} from 'lucide-react'
import LoginModal from '@/components/LoginModal'
import ChatManagement from '@/components/admin/ChatManagement'
import SensitiveWords from '@/components/admin/SensitiveWords'
import ChatSettingsPanel from '@/components/admin/ChatSettingsPanel'
import AdminMarketPanel from '@/components/admin/AdminMarketPanel'
import TaskManagement from '@/components/admin/TaskManagement'

// CDK 奖励物品行结构
interface CDKItemReward {
  referenceId: string
  quantity: number
  type: ItemType
  name?: string
  emoji?: string
}

const TITLE_OPTIONS: { key: string; label: string }[] = [
  { key: 'newbie', label: '🌱 种花新人' },
  { key: 'green_hand', label: '🌿 园艺新秀' },
  { key: 'expert', label: '🌻 种花专家' },
  { key: 'master', label: '🌹 花园大师' },
  { key: 'legend', label: '👑 传奇园丁' },
  { key: 'first_blood', label: '⚔️ 首战告捷' },
  { key: 'wealthy', label: '💰 小富即安' },
  { key: 'philanthropist', label: '🎁 慷慨之心' },
  { key: 'checkin_dragon', label: '🐉 签到达人' },
]

type Tab = 'dashboard' | 'users' | 'announcements' | 'chat' | 'sensitive' | 'market' | 'tasks' | 'cdk' | 'permissions' | 'settings'

// 将 Tab 映射到权限位
const TAB_PERM_BIT: Record<Tab, number | null> = {
  dashboard: 6,   // 数据总览 - 日志统计（宽松：允许有 0 也可见）
  users: 0,
  announcements: 1,
  chat: 2,
  sensitive: 2,
  market: 4,
  tasks: 7,       // 任务管理 - 经济调控权限
  cdk: 3,
  permissions: 5, // 权限管理（仅超级管理员或具备权限管理位的管理员）
  settings: null, // 改自己密码和权限说明，所有 admin 可见
}

export default function AdminPage() {
  const { user, showToast } = useAppStore()
  const hasHydrated = useAppStore(s => s._hasHydrated)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [authed, setAuthed] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [cdks, setCdks] = useState<any[]>([])
  const [admins, setAdmins] = useState<any[]>([])
  const [permMeta, setPermMeta] = useState<any[]>([])
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null)
  const [tempPerms, setTempPerms] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const [showAnnForm, setShowAnnForm] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal')

  const [showCDKForm, setShowCDKForm] = useState(false)
  const [cdkCoins, setCdkCoins] = useState(0)
  const [cdkPetalCoins, setCdkPetalCoins] = useState(0)
  const [cdkTitles, setCdkTitles] = useState<string[]>([])
  const [cdkItems, setCdkItems] = useState<CDKItemReward[]>([])
  const [cdkCount, setCdkCount] = useState(1)
  const [cdkDays, setCdkDays] = useState(30)
  const [cdkMaxUses, setCdkMaxUses] = useState(1)
  const [cdkItemTab, setCdkItemTab] = useState<'seed' | 'flower' | 'tool'>('seed')
  const [cdkItemId, setCdkItemId] = useState('')
  const [cdkItemQty, setCdkItemQty] = useState(1)

  const [loading, setLoading] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPwdChange, setShowPwdChange] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [editNickname, setEditNickname] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [showUserEdit, setShowUserEdit] = useState(false)
  // 子管理员权限位编辑
  const [editAdminPerms, setEditAdminPerms] = useState<number>(0)

  // 禁言对话框状态
  const [muteTarget, setMuteTarget] = useState<any>(null)
  const [muteDays, setMuteDays] = useState(1)
  const [muteCustomDays, setMuteCustomDays] = useState('')
  const [mutePreset, setMutePreset] = useState<number | 'custom'>(1)

  // 封号对话框状态
  const [banTarget, setBanTarget] = useState<any>(null)
  const [banDays, setBanDays] = useState(7)
  const [banCustomDays, setBanCustomDays] = useState('')
  const [banPreset, setBanPreset] = useState<number | 'forever' | 'custom'>(7)

  const loadAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const [uRes, aRes, sRes, cRes, pRes] = await Promise.all([
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/announcements'),
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/cdks'),
        apiFetch('/api/admin/permissions'),
      ])
      if (uRes.success) setUsers(uRes.data)
      if (aRes.success) setAnnouncements(aRes.data)
      if (sRes.success) setStats(sRes.data)
      if (cRes.success) setCdks(cRes.data)
      if (pRes.success) {
        setAdmins(pRes.data?.admins || [])
        setPermMeta(pRes.data?.permMeta || [])
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  // 等待 Zustand 持久化完成后再判断权限，避免刷新瞬间误判
  useEffect(() => {
    const stored = localStorage.getItem('garden-app-storage')
    let isAdmin = user?.isAdmin
    if (!isAdmin && stored) {
      try { isAdmin = JSON.parse(stored).state?.user?.isAdmin } catch {}
    }
    setAuthed(!!isAdmin)
  }, [user?.isAdmin, hasHydrated])

  // 授权后加载所有数据
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

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        <div className="text-white text-sm opacity-70">正在验证权限...</div>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
        <div className="card p-8 max-w-md text-center relative">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
            <Shield size={32} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-slate-800">管理员权限验证失败</h1>
          <p className="text-sm text-slate-500 mb-5">请使用管理员账号登录后访问</p>
          <button onClick={() => setShowLogin(true)} className="btn-primary">
            管理员登录
          </button>
        </div>
        {/* LoginModal 自带 fixed z-50 覆盖层，直接渲染即可 */}
        {showLogin && (
          <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => { window.location.reload() }} />
        )}
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
    const hasReward = cdkCoins > 0 || cdkPetalCoins > 0 || cdkTitles.length > 0 || cdkItems.length > 0
    if (!hasReward) return showToast('至少填写一种奖励', 'error')
    setLoading('cdk')
    const res = await apiFetch('/api/admin/cdks', {
      method: 'POST',
      body: JSON.stringify({
        count: cdkCount,
        days: cdkDays,
        maxUses: cdkMaxUses,
        coins: cdkCoins,
        petalCoins: cdkPetalCoins,
        titles: cdkTitles,
        items: cdkItems,
      })
    })
    if (res.success) {
      showToast(`生成了 ${cdkCount} 个 CDK`, 'success')
      setShowCDKForm(false); setCdkCoins(0); setCdkPetalCoins(0); setCdkTitles([]); setCdkItems([])
      loadAll()
    } else showToast(res.error || '生成失败', 'error')
    setLoading(null)
  }

  const addCDKItem = () => {
    if (!cdkItemId || cdkItemQty < 1) return showToast('请选择物品和数量', 'error')
    let name = ''
    let emoji = ''
    if (cdkItemTab === 'seed') {
      const s = (SEED_TYPES as any[]).find(x => x.id === cdkItemId); if (s) { name = s.name; emoji = s.emoji || '🌱' }
    } else if (cdkItemTab === 'flower') {
      const f = (FLOWER_TYPES as any[]).find(x => x.id === cdkItemId); if (f) { name = f.name; emoji = f.emoji }
    } else if (cdkItemTab === 'tool') {
      const t = (TOOLS as any[]).find(x => x.id === cdkItemId); if (t) { name = t.name; emoji = t.emoji || '🧰' }
    }
    setCdkItems(prev => [...prev, {
      referenceId: cdkItemId,
      quantity: Number(cdkItemQty),
      type: cdkItemTab as ItemType,
      name, emoji,
    }])
    setCdkItemId(''); setCdkItemQty(1)
  }

  const toggleCdkTitle = (key: string) => {
    setCdkTitles(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const muteUser = async (userId: string, days: number) => {
    setLoading(`mute_${userId}`)
    const res = await apiFetch('/api/admin/mute', {
      method: 'POST',
      body: JSON.stringify({ userId, days })
    })
    if (res.success) {
      if (days > 0) showToast(`已禁言 ${days} 天`, 'success')
      else showToast('已解除禁言', 'success')
      setMuteTarget(null); loadAll()
    } else showToast(res.error || '操作失败', 'error')
    setLoading(null)
  }

  const openMuteDialog = (u: any) => {
    setMuteTarget(u)
    setMutePreset(1)
    setMuteDays(1)
    setMuteCustomDays('')
  }

  const confirmMute = async () => {
    if (!muteTarget) return
    let days = 0
    if (mutePreset === 'custom') {
      const d = parseFloat(muteCustomDays)
      if (isNaN(d) || d <= 0) { showToast('请输入有效的天数', 'error'); return }
      days = d
    } else {
      days = mutePreset
    }
    await muteUser(muteTarget.id, days)
  }

  const banUser = async (userId: string, ban: boolean, banDays?: number) => {
    setLoading(`ban_${userId}`)
    const body: any = { userId }
    if (ban) {
      body.banUser = true
      if (banDays !== undefined && banDays > 0) body.banDays = banDays
    } else {
      body.unbanUser = true
    }
    const res = await apiFetch('/api/admin/users/action', { method: 'POST', body: JSON.stringify(body) })
    if (res.success) {
      if (ban) showToast(banDays && banDays > 0 ? `已封号 ${banDays} 天` : '已永久封号', 'success')
      else showToast('已解封', 'success')
      setBanTarget(null); loadAll()
    } else showToast(res.error || '操作失败', 'error')
    setLoading(null)
  }

  const openBanDialog = (u: any) => {
    setBanTarget(u)
    setBanPreset(7)
    setBanDays(7)
    setBanCustomDays('')
  }

  const confirmBan = async () => {
    if (!banTarget) return
    let days: number | undefined
    if (banPreset === 'forever') {
      days = undefined
    } else if (banPreset === 'custom') {
      const d = parseFloat(banCustomDays)
      if (isNaN(d) || d <= 0) { showToast('请输入有效的天数', 'error'); return }
      days = d
    } else {
      days = banPreset
    }
    await banUser(banTarget.id, true, days)
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

  const editUserInfo = async () => {
    if (!editingUser) return
    setLoading(`edit_${editingUser.id}`)
    const body: any = { userId: editingUser.id }
    if (editNickname.trim()) body.nickname = editNickname.trim()
    if (editAvatar.trim()) body.avatar = editAvatar.trim()
    const res = await apiFetch('/api/admin/users/action', {
      method: 'POST',
      body: JSON.stringify(body)
    })
    if (res.success) {
      showToast('修改成功', 'success')
      setShowUserEdit(false); setEditingUser(null)
      loadAll()
    } else showToast(res.error || '修改失败', 'error')
    setLoading(null)
  }

  const openUserEdit = (u: any) => {
    setEditingUser(u); setEditNickname(u.nickname || ''); setEditAvatar(u.avatar || '')
    setEditAdminPerms((Number(u.adminPermissions) ?? 0) & 0xff)
    setShowUserEdit(true)
  }

  const saveAdminPermissions = async () => {
    if (!editingUser) return
    if (!_isSuperAdmin(user?.id || '')) return showToast('仅超级管理员可修改权限', 'error')
    setLoading(`perm_${editingUser.id}`)
    const body: any = { userId: editingUser.id }
    // 有任意权限位 => 确保设为管理员；无权限位 => 撤管（同时在 action 端也会做）
    body.adminPermissions = editAdminPerms & 0xff
    body.makeAdmin = (editAdminPerms & 0xff) > 0
    const res = await apiFetch('/api/admin/users/action', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (res.success) {
      showToast('权限已保存', 'success')
      loadAll()
    } else showToast(res.error || '保存失败', 'error')
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
    { k: 'tasks', label: '任务管理', icon: ClipboardList },
    { k: 'cdk', label: 'CDK管理', icon: Gift },
    { k: 'permissions', label: '权限管理', icon: Crown },
    { k: 'settings', label: '系统设置', icon: Settings },
  ]

  // 有权限显示哪些 Tab
  const canSeeTab = (t: Tab): boolean => {
    if (!user) return false
    if (_isSuperAdmin(user.id || '')) return true
    const bit = TAB_PERM_BIT[t]
    if (bit === null) return true
    if (t === 'dashboard') return userHasPermission(user, 6) || userHasPermission(user, 0)
    return userHasPermission(user, bit)
  }

  const canSetAdminPerms = _isSuperAdmin(user?.id || '')

  const visibleTabs = tabs.filter(t => canSeeTab(t.k))

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg">花园 · 管理员后台</h1>
            <p className="text-xs text-slate-400">管理用户、公告、市场、CDK、敏感词、系统设置</p>
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

      <div className="max-w-6xl mx-auto p-4 flex gap-4 flex-col md:flex-row" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>
        <aside className="md:w-56 flex-shrink-0">
          <div className="card p-2 space-y-1 sticky top-4">
            {visibleTabs.map(t => {
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

              {/* 经济仪表盘 */}
              <div className="card p-5">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Coins size={18} className="text-amber-500" />
                  经济仪表盘
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-xs text-slate-500">全服金币</div>
                    <div className="text-lg font-bold text-amber-600 mt-0.5">{formatNumber(stats?.totalCoins || 0)}</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="text-xs text-slate-500">背包花估值</div>
                    <div className="text-lg font-bold text-purple-600 mt-0.5">{formatNumber(stats?.inventoryFlowerValue || 0)}</div>
                  </div>
                  <div className="p-3 bg-pink-50 rounded-xl border border-pink-100">
                    <div className="text-xs text-slate-500">花园点赞</div>
                    <div className="text-lg font-bold text-pink-600 mt-0.5">{stats?.totalLikes || 0}</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <div className="text-xs text-slate-500">前10%占有</div>
                    <div className="text-lg font-bold text-red-600 mt-0.5">{stats?.giniRatio || 0}%</div>
                  </div>
                </div>
                {/* 贫富差距说明 */}
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <AlertCircle size={11} />
                  「前10%占有」= 金币最多的 10% 用户持有的金币占比，数值越高贫富差距越大
                </div>
              </div>

              {/* 种植概况 + 富豪榜 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="card p-5">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Leaf size={16} className="text-garden-500" />
                    种植概况
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">种植中</span>
                      <span className="font-bold text-garden-700">{stats?.plantedCount || 0} 朵</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">已成熟</span>
                      <span className="font-bold text-amber-600">{stats?.maturedCount || 0} 朵</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">平均进度</span>
                      <span className="font-bold text-blue-600">{stats?.avgGrowth || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">虫害</span>
                      <span className="font-bold text-red-500">{stats?.pestCount || 0} 朵</span>
                    </div>
                  </div>
                  {stats?.topFlowers && stats.topFlowers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="text-xs text-slate-500 mb-2">热门花型 Top 5</div>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.topFlowers.map((f: any, i: number) => (
                          <div key={f.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                            <span className="text-slate-400 font-bold">{i + 1}</span>
                            <span>{f.emoji}</span>
                            <span className="text-slate-600">{f.name}</span>
                            <span className="text-slate-400">×{f.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Crown size={16} className="text-amber-500" />
                    金币富豪榜 Top 5
                  </h3>
                  <div className="space-y-2">
                    {stats?.topRich?.map((u: any, i: number) => (
                      <div key={u.id} className="flex items-center gap-2 text-sm">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                          i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-400' : 'bg-slate-300'
                        }`}>{i + 1}</span>
                        <span className="text-lg">{u.avatar || '🌱'}</span>
                        <span className="flex-1 text-slate-700 font-medium truncate">{u.nickname}</span>
                        <span className="font-bold text-amber-600 flex items-center gap-0.5">
                          <Coins size={12} />{formatNumber(u.coins)}
                        </span>
                      </div>
                    )) || <div className="text-sm text-slate-400 text-center py-4">暂无数据</div>}
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
                                  {u.deleted && <span className="chip bg-red-100 text-red-600 text-[9px] ml-1">已封号</span>}
                                </div>
                                <div className="text-[11px] text-slate-400">@{u.username} · ID: {u.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-amber-600 font-medium">{formatNumber(u.coins)}</td>
                          <td className="p-3">
                            {u.deleted && u.bannedUntil && u.bannedUntil > Date.now() ? (
                              <span className="chip bg-red-100 text-red-700">
                                <Ban size={10} className="inline mr-1" /> 封号中 {(() => {
                                  const h = Math.ceil((u.bannedUntil - Date.now()) / 3600000)
                                  return h >= 24 ? Math.ceil(h / 24) + '天' : h + '小时'
                                })()}
                              </span>
                            ) : u.deleted ? (
                              <span className="chip bg-red-100 text-red-700">
                                <Ban size={10} className="inline mr-1" /> 永久封号
                              </span>
                            ) : u.mutedUntil && u.mutedUntil > Date.now() ? (
                              <span className="chip bg-orange-100 text-orange-700">
                                <Ban size={10} className="inline mr-1" /> 禁言中 {(() => {
                                  const h = Math.ceil((u.mutedUntil - Date.now()) / 3600000)
                                  return h >= 24 ? Math.ceil(h / 24) + '天' : h + '小时'
                                })()}
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
                            <div className="flex gap-1 flex-wrap">
                              {/* 禁言：点击打开时长选择弹窗 */}
                              {u.mutedUntil && u.mutedUntil > Date.now() ? (
                                <button onClick={() => muteUser(u.id, 0)} className="p-1.5 rounded-lg hover:bg-garden-50 text-garden-600" title="解除禁言">
                                  <Unlock size={14} />
                                </button>
                              ) : !u.deleted && (
                                <button onClick={() => openMuteDialog(u)} disabled={u.isAdmin} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 disabled:opacity-30" title="禁言">
                                  <MessageSquare size={14} />
                                </button>
                              )}
                              {/* 封号：点击打开时长选择弹窗 */}
                              {!u.isAdmin && !u.deleted && (
                                <button onClick={() => openBanDialog(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="封号">
                                  <UserX size={14} />
                                </button>
                              )}
                              {u.deleted && (
                                <button onClick={() => banUser(u.id, false)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="解封">
                                  <Unlock size={14} />
                                </button>
                              )}
                              {canSetAdminPerms && !u.isAdmin && !u.deleted && (
                                <button onClick={() => updateUserPermission(u.id, true)} disabled={loading?.startsWith('perm_')} className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600" title="设为管理员">
                                  <UserCheck size={14} />
                                </button>
                              )}
                              {canSetAdminPerms && u.isAdmin && u.id !== 'admin' && (
                                <button onClick={() => updateUserPermission(u.id, false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="取消管理员">
                                  <UserX size={14} />
                                </button>
                              )}
                              <button onClick={() => openUserEdit(u)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="编辑用户">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => { setEditingUser(u); setNewPassword('') }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="重置密码">
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
            <div className="space-y-4">
              <AdminMarketPanel />
            </div>
          )}

          {tab === 'tasks' && (
            <TaskManagement />
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
                          <td className="p-3 text-slate-600">
                            <div className="flex flex-wrap gap-1.5 text-xs">
                              {c.rewards?.coins ? <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full">{c.rewards.coins} 💰</span> : null}
                              {c.rewards?.petalCoins ? <span className="px-2 py-0.5 bg-pink-50 text-pink-700 rounded-full">{c.rewards.petalCoins} 🌸</span> : null}
                              {c.rewards?.titles?.length ? c.rewards.titles.map((k: string, i: number) => {
                                const t = TITLE_OPTIONS.find(o => o.key === k)
                                return <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">{t?.label || k}</span>
                              }) : null}
                              {c.rewards?.items?.length ? c.rewards.items.map((r: any, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                                  {r.emoji || '🎁'} {r.name || r.referenceId} ×{r.quantity}
                                </span>
                              )) : null}
                              {!c.rewards?.coins && !c.rewards?.petalCoins && !(c.rewards?.titles?.length) && !(c.rewards?.items?.length) && (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>
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

          {tab === 'permissions' && (
            <div className="space-y-4">
              <div className="card p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Crown size={18} className="text-amber-500" /> 管理员权限管理
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">管理所有管理员账号，分配细粒度权限位</p>
                </div>
                {canSetAdminPerms ? (
                  <button onClick={() => showToast('在「用户管理」中点击普通用户的皇冠图标即可提升为管理员', 'info')} className="btn-secondary text-sm py-1.5 px-3">
                    + 任命新管理员
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">仅超级管理员可修改权限</span>
                )}
              </div>

              {/* 权限位说明 */}
              <div className="card p-4">
                <h3 className="font-bold text-slate-800 text-sm mb-3">权限位说明（Bit 位标识）</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {permMeta.map((p: any) => (
                    <div key={p.bit} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-1">
                        <span className="chip bg-indigo-100 text-indigo-700 text-[9px]">Bit {p.bit}</span>
                        <span className="font-bold text-xs text-slate-700">{p.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 leading-snug">{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 管理员列表 */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm">管理员列表（{admins.length}人）</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {admins.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm">暂无管理员</div>
                  )}
                  {admins.map((a: any) => (
                    <div key={a.id} className="p-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-2xl">
                        {a.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 truncate">{a.nickname}</span>
                          {a.isSuperAdmin ? (
                            <span className="chip bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px]">👑 超级管理员</span>
                          ) : (
                            <span className="chip bg-indigo-100 text-indigo-700 text-[10px]">管理员</span>
                          )}
                          {!a.isSuperAdmin && (
                            <span className="chip bg-slate-100 text-slate-500 text-[10px]">权限位 {a.adminPermissions}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          @{a.username} · ID: {a.id}
                        </div>
                        {!a.isSuperAdmin && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {permMeta.map((p: any) => a.permFlags?.[p.key] && (
                              <span key={p.bit} className="px-1.5 py-0.5 rounded bg-garden-50 text-garden-700 text-[9px]">{p.name}</span>
                            ))}
                            {Object.values(a.permFlags || {}).every(v => !v) && (
                              <span className="text-[10px] text-slate-400">（无任何权限）</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {canSetAdminPerms && !a.isSuperAdmin && (
                          <button
                            onClick={() => {
                              setSelectedAdmin(a)
                              const flags: Record<string, boolean> = {}
                              permMeta.forEach((p: any) => { flags[p.key] = !!a.permFlags?.[p.key] })
                              setTempPerms(flags)
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs bg-blue-50 text-blue-600 hover:bg-blue-100"
                          >
                            <Edit size={12} className="inline mr-1" /> 编辑权限
                          </button>
                        )}
                        {canSetAdminPerms && a.id !== (user?.id || '') && !a.isSuperAdmin && (
                          <button
                            onClick={async () => {
                              if (!confirm(`确定撤销 ${a.nickname} 的管理员权限？`)) return
                              setLoading(`perm_${a.id}`)
                              const r = await apiFetch('/api/admin/users/action', {
                                method: 'POST',
                                body: JSON.stringify({ userId: a.id, makeAdmin: false }),
                              })
                              if (r.success) { showToast('已撤销管理员权限', 'success'); loadAll() }
                              else showToast(r.error || '操作失败', 'error')
                              setLoading(null)
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            <UserX size={12} className="inline mr-1" /> 撤管
                          </button>
                        )}
                        {a.isSuperAdmin && (
                          <span className="text-[10px] text-amber-600">不可修改</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 编辑权限弹窗 */}
          {selectedAdmin && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedAdmin(null)}>
              <div className="card w-full max-w-md p-5 slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Shield size={18} className="text-indigo-500" /> 编辑权限：{selectedAdmin.nickname}
                  </h2>
                  <button onClick={() => setSelectedAdmin(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
                </div>
                <div className="space-y-2 mb-4">
                  {permMeta.map((p: any) => (
                    <label key={p.bit} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={!!tempPerms[p.key]}
                        onChange={(e) => setTempPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                        className="mt-1 w-4 h-4 accent-indigo-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">{p.name}</span>
                          <span className="chip bg-indigo-100 text-indigo-700 text-[9px]">Bit {p.bit}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setSelectedAdmin(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600">取消</button>
                  <button
                    onClick={async () => {
                      if (!selectedAdmin) return
                      setLoading(`perm_${selectedAdmin.id}`)
                      // 计算位掩码
                      let bits = 0
                      permMeta.forEach((p: any) => { if (tempPerms[p.key]) bits |= (1 << p.bit) })
                      const r = await apiFetch('/api/admin/users/action', {
                        method: 'POST',
                        body: JSON.stringify({
                          userId: selectedAdmin.id,
                          adminPermissions: bits,
                          makeAdmin: bits > 0,
                        }),
                      })
                      if (r.success) { showToast('权限已保存', 'success'); setSelectedAdmin(null); loadAll() }
                      else showToast(r.error || '保存失败', 'error')
                      setLoading(null)
                    }}
                    disabled={loading?.startsWith('perm_')}
                    className="flex-1 btn-primary py-2.5"
                  >
                    {loading?.startsWith('perm_') ? '保存中...' : '保存权限'}
                  </button>
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto" onClick={() => setShowCDKForm(false)}>
          <div className="card w-full max-w-2xl p-5 slide-up my-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Gift size={20} className="text-purple-500" /> 生成 CDK（支持所有游戏物品）</h2>
              <button onClick={() => setShowCDKForm(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {/* 基础参数 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600">生成数量</label>
                  <input type="number" min={1} max={100} className="input py-2" value={cdkCount} onChange={e => setCdkCount(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600">有效期 (天)</label>
                  <input type="number" min={1} className="input py-2" value={cdkDays} onChange={e => setCdkDays(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600">最大使用次数</label>
                  <input type="number" min={1} className="input py-2" value={cdkMaxUses} onChange={e => setCdkMaxUses(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
              </div>

              {/* 货币奖励 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-yellow-50 rounded-xl">
                  <label className="block text-xs font-medium mb-1 text-yellow-700 flex items-center gap-1"><Coins size={14} /> 金币</label>
                  <input type="number" min={0} className="input py-2 bg-white" value={cdkCoins} onChange={e => setCdkCoins(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div className="p-3 bg-pink-50 rounded-xl">
                  <label className="block text-xs font-medium mb-1 text-pink-700 flex items-center gap-1"><Flower2 size={14} /> 花瓣</label>
                  <input type="number" min={0} className="input py-2 bg-white" value={cdkPetalCoins} onChange={e => setCdkPetalCoins(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              {/* 称号奖励 */}
              <div className="p-3 bg-indigo-50 rounded-xl">
                <label className="block text-xs font-medium mb-2 text-indigo-700 flex items-center gap-1"><Medal size={14} /> 称号（可多选）</label>
                <div className="flex flex-wrap gap-2">
                  {TITLE_OPTIONS.map(o => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => toggleCdkTitle(o.key)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${cdkTitles.includes(o.key) ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 物品奖励（种子/花卉/工具） */}
              <div className="p-3 bg-emerald-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-emerald-700 flex items-center gap-1"><Sparkles size={14} /> 物品奖励：种子、花卉、工具</label>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(['seed', 'flower', 'tool'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setCdkItemTab(t); setCdkItemId('') }}
                      className={`text-xs py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-1 ${cdkItemTab === t ? 'bg-emerald-600 text-white shadow' : 'bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
                    >
                      {t === 'seed' ? '🌱 种子' : t === 'flower' ? '🌸 花卉' : '🧰 工具'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3">
                    <select
                      value={cdkItemId}
                      onChange={e => setCdkItemId(e.target.value)}
                      className="input py-2 bg-white w-full"
                    >
                      <option value="">-- 选择{cdkItemTab === 'seed' ? '种子' : cdkItemTab === 'flower' ? '花卉' : '工具'} --</option>
                      {(cdkItemTab === 'seed' ? (SEED_TYPES as any[]) : cdkItemTab === 'flower' ? (FLOWER_TYPES as any[]) : (TOOLS as any[])).map((it: any) => (
                        <option key={it.id} value={it.id}>{it.emoji || '🎁'} {it.name} {it.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <input type="number" min={1} className="input py-2 bg-white" value={cdkItemQty} onChange={e => setCdkItemQty(Math.max(1, parseInt(e.target.value) || 1))} placeholder="数量" />
                  </div>
                  <div className="col-span-1">
                    <button type="button" onClick={addCDKItem} className="btn-primary py-2 px-3 text-sm w-full flex items-center justify-center gap-1">
                      <Plus size={14} /> 添加
                    </button>
                  </div>
                </div>

                {cdkItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cdkItems.map((it, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-emerald-800 border border-emerald-200 text-xs">
                        {it.emoji || '🎁'} {it.name || it.referenceId} ×{it.quantity}
                        <button type="button" className="ml-1 hover:text-red-500" onClick={() => setCdkItems(p => p.filter((_, j) => j !== i))}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 预览 */}
              <div className="p-3 bg-purple-50 rounded-xl text-sm text-purple-700 space-y-1">
                <div>即将生成 <b>{cdkCount}</b> 个 CDK，有效期 <b>{cdkDays} 天</b>，每个 CDK 可使用 <b>{cdkMaxUses}</b> 次</div>
                <div className="text-xs opacity-90">
                  奖励预览：
                  {cdkCoins > 0 && <span className="mx-1">· {cdkCoins} 💰</span>}
                  {cdkPetalCoins > 0 && <span className="mx-1">· {cdkPetalCoins} 🌸</span>}
                  {cdkTitles.map(k => { const t = TITLE_OPTIONS.find(o => o.key === k); return <span key={k} className="mx-1">· {t?.label || k}</span> })}
                  {cdkItems.map((it, i) => <span key={i} className="mx-1">· {it.emoji || '🎁'}{it.name || it.referenceId}×{it.quantity}</span>)}
                  {cdkCoins <= 0 && cdkPetalCoins <= 0 && cdkTitles.length === 0 && cdkItems.length === 0 && <span className="opacity-70">（未设置任何奖励）</span>}
                </div>
              </div>

              <button onClick={genCDK} disabled={loading === 'cdk'} className="btn-primary w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                {loading === 'cdk' ? '生成中...' : '确认生成 CDK'}
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

      {showUserEdit && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowUserEdit(false); setEditingUser(null) }}>
          <div className="card w-full max-w-md p-5 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Edit size={18} className="text-blue-500" /> 编辑用户</h2>
              <button onClick={() => { setShowUserEdit(false); setEditingUser(null) }} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-700">
                用户: <b>{editingUser.nickname}</b> (@{editingUser.username})
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">昵称</label>
                <input className="input" value={editNickname} onChange={e => setEditNickname(e.target.value)} maxLength={20} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">头像 (emoji)</label>
                <input className="input" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} maxLength={4} placeholder="输入 emoji，如 🌹" />
                <div className="flex gap-1 mt-2 text-xl">
                  {['🌱','🌿','🍀','🌵','🎍','🌹','🌻','🌼','🌸','🏵️','🌺','🍄','🐰','🐱','🐶','🦊','🐼','🦄','🐸','🐞','🪴','🌳','🌲','🌴','🌵','🌾','🌻'].map(e => (
                    <button key={e} onClick={() => setEditAvatar(e)} className={`w-8 h-8 rounded-lg hover:bg-slate-100 ${editAvatar === e ? 'bg-slate-200' : ''}`}>{e}</button>
                  ))}
                </div>
              </div>

              {/* 子管理员权限配置（仅超级管理员可见） */}
              {canSetAdminPerms && editingUser && _isSuperAdmin(editingUser.id) === false && (
                <div className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700 flex items-center gap-1">
                      <Shield size={14} className="text-indigo-500" /> 管理员权限
                    </label>
                    <div className="text-[10px] text-slate-400">
                      当前权限位: <span className="font-mono">{(editAdminPerms & 0xff).toString(2).padStart(8, '0')} ({editAdminPerms & 0xff})</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {ADMIN_PERMISSIONS.map(p => {
                      const checked = (editAdminPerms & (1 << p.bit)) !== 0
                      return (
                        <label key={p.bit} className={classNames(
                          'p-2 rounded-lg border text-xs cursor-pointer select-none transition-all',
                          checked ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                        )}>
                          <div className="flex items-center gap-1.5">
                            <input type="checkbox" className="accent-indigo-600"
                              checked={checked}
                              onChange={e => setEditAdminPerms(prev => e.target.checked ? prev | (1 << p.bit) : prev & ~(1 << p.bit))} />
                            <span className="font-medium">{p.name}</span>
                          </div>
                          <div className="text-[10px] opacity-70 ml-5 mt-0.5 leading-tight">{p.desc}</div>
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={() => setEditAdminPerms(0xff)} className="flex-1 py-1.5 text-[11px] rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100">全选</button>
                    <button onClick={() => setEditAdminPerms(0)} className="flex-1 py-1.5 text-[11px] rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100">清空</button>
                    <button onClick={() => setEditAdminPerms(1 | 2 | 4)} className="flex-1 py-1.5 text-[11px] rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100">基础权限</button>
                  </div>
                  <button onClick={saveAdminPermissions}
                    disabled={loading?.startsWith('perm_')}
                    className="w-full mt-2 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 text-xs font-medium disabled:opacity-50">
                    {loading?.startsWith('perm_') ? '保存中...' : '保存权限配置（并自动设为管理员/撤管）'}
                  </button>
                </div>
              )}
              <button onClick={editUserInfo} disabled={loading?.startsWith('edit_')} className="btn-primary w-full py-2.5">
                {loading?.startsWith('edit_') ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 禁言对话框 */}
      {muteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMuteTarget(null)}>
          <div className="card w-full max-w-sm p-5 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><MessageSquare size={18} className="text-amber-500" /> 禁言用户</h2>
              <button onClick={() => setMuteTarget(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-700 mb-4">
              目标用户: <b>{muteTarget.nickname}</b> (@{muteTarget.username})
            </div>
            <div className="text-sm font-medium text-slate-700 mb-2">选择禁言时长</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { v: 1/24, label: '1 小时' },
                { v: 1, label: '1 天' },
                { v: 3, label: '3 天' },
                { v: 7, label: '7 天' },
                { v: 30, label: '30 天' },
                { v: 'custom', label: '自定义' },
              ].map(p => (
                <button
                  key={String(p.v)}
                  onClick={() => { setMutePreset(p.v as any); setMuteDays(p.v as number) }}
                  className={`py-2 rounded-lg text-sm border transition ${
                    mutePreset === p.v
                      ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {mutePreset === 'custom' && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  min="0.04"
                  step="0.25"
                  placeholder="天数 (如 1, 0.5, 3.5)"
                  value={muteCustomDays}
                  onChange={e => setMuteCustomDays(e.target.value)}
                  className="flex-1 input"
                />
                <span className="text-sm text-slate-500">天</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setMuteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={confirmMute} disabled={loading?.startsWith('mute_')} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                {loading?.startsWith('mute_') ? '处理中...' : '确认禁言'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 封号对话框 */}
      {banTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBanTarget(null)}>
          <div className="card w-full max-w-sm p-5 slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><UserX size={18} className="text-red-500" /> 封号用户</h2>
              <button onClick={() => setBanTarget(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700 mb-4">
              目标用户: <b>{banTarget.nickname}</b> (@{banTarget.username}) — 封号后该用户将无法登录
            </div>
            <div className="text-sm font-medium text-slate-700 mb-2">选择封号时长</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { v: 1, label: '1 天' },
                { v: 7, label: '7 天' },
                { v: 30, label: '30 天' },
                { v: 90, label: '90 天' },
                { v: 'forever', label: '永久' },
                { v: 'custom', label: '自定义' },
              ].map(p => (
                <button
                  key={String(p.v)}
                  onClick={() => { setBanPreset(p.v as any); if (typeof p.v === 'number') setBanDays(p.v) }}
                  className={`py-2 rounded-lg text-sm border transition ${
                    banPreset === p.v
                      ? p.v === 'forever'
                        ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                        : 'border-red-400 bg-red-50 text-red-600 font-medium'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {banPreset === 'custom' && (
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="天数"
                  value={banCustomDays}
                  onChange={e => setBanCustomDays(e.target.value)}
                  className="flex-1 input"
                />
                <span className="text-sm text-slate-500">天</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setBanTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={confirmBan} disabled={loading?.startsWith('ban_')} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                {loading?.startsWith('ban_') ? '处理中...' : '确认封号'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
