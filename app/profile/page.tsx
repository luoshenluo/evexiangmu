'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber, formatDateTime } from '@/lib/utils'
import { User, Coins, Award, LogOut, Bell, Gift, Settings, Users, Crown, ChevronRight, X, Search, LogIn, HelpCircle, Sparkles } from 'lucide-react'
import LoginModal from '@/components/LoginModal'

export default function ProfilePage() {
  const { user, logout, showToast, announcements, notifications, setNotifications } = useAppStore()
  const [showCDK, setShowCDK] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [cdkCode, setCdkCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRankList, setShowRankList] = useState(false)
  const [rankings, setRankings] = useState<any[]>([])

  const handleLogout = () => {
    if (!confirm('确定退出登录吗？')) return
    logout()
    showToast('已退出登录', 'info')
  }

  const redeemCDK = async () => {
    if (!cdkCode.trim()) return showToast('请输入 CDK', 'error')
    setLoading(true)
    try {
      const res = await apiFetch('/api/cdk/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: cdkCode.trim().toUpperCase() })
      })
      if (res.success) {
        showToast('🎉 CDK 兑换成功！', 'success')
        setCdkCode('')
        setShowCDK(false)
      } else {
        showToast(res.error || '兑换失败', 'error')
      }
    } finally { setLoading(false) }
  }

  const loadRanking = async () => {
    const res = await apiFetch('/api/rankings')
    if (res.success && res.data) setRankings(res.data)
    setShowRankList(true)
  }

  const loadNotifications = async () => {
    const res = await apiFetch('/api/notifications')
    if (res.success && res.data) setNotifications(res.data)
    setShowNotifications(true)
  }

  // 排行榜数据类型
  const [rankTab, setRankTab] = useState<'coins' | 'flowers' | 'family'>('coins')

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-8 text-center">
        <div className="card p-10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-garden-100 flex items-center justify-center">
            <User size={40} className="text-garden-500" />
          </div>
          <h2 className="font-bold text-lg mb-1 text-slate-800">请先登录</h2>
          <p className="text-sm text-slate-500 mb-5">登录后查看个人中心</p>
          <button onClick={() => setShowLogin(true)} className="btn-primary">
            <LogIn size={16} /> 登录 / 注册
          </button>
        </div>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </div>
    )
  }

  const menuItems = [
    { icon: Bell, label: '消息中心', tip: notifications.filter(n => !n.read).length > 0 ? `${notifications.filter(n => !n.read).length}条未读` : '系统通知', onClick: loadNotifications, color: 'from-blue-400 to-blue-600' },
    { icon: Award, label: '排行榜', tip: '查看全服排名', onClick: loadRanking, color: 'from-amber-400 to-orange-500' },
    { icon: Gift, label: 'CDK 兑换', tip: '输入CDK领奖励', onClick: () => setShowCDK(true), color: 'from-purple-400 to-pink-500' },
    { icon: Sparkles, label: '活动中心', tip: '暂无进行中活动', onClick: () => showToast('活动开发中~', 'info'), color: 'from-red-400 to-rose-500' },
    { icon: Users, label: '好友系统', tip: '添加好友', onClick: () => showToast('好友系统开发中~', 'info'), color: 'from-green-400 to-emerald-600' },
    { icon: HelpCircle, label: '帮助反馈', tip: '游戏介绍', onClick: () => setShowAnnouncements(true), color: 'from-slate-400 to-slate-600' },
  ]

  if (user.isAdmin) {
    menuItems.unshift({
      icon: Settings, label: '管理员后台', tip: '进入后台管理',
      onClick: () => window.open('/admin', '_blank'),
      color: 'from-indigo-500 to-purple-700'
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      {/* 用户卡片 */}
      <div className="card p-5 mb-4 relative overflow-hidden bg-gradient-to-br from-garden-500 to-emerald-600 text-white">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur border-2 border-white/40 flex items-center justify-center text-3xl shadow-lg">
            {user.avatar || '🌱'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold truncate">{user.nickname}</h2>
              {user.isAdmin && (
                <span className="chip bg-white text-amber-700 text-[10px]">
                  <Crown size={10} /> 管理员
                </span>
              )}
            </div>
            <div className="text-xs opacity-80 mt-0.5">ID: {user.id} · 注册于 {formatDateTime(user.createdAt).slice(0, 10)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="chip bg-white/20 backdrop-blur-sm text-white text-[11px]">
                <Coins size={12} /> {formatNumber(user.coins)}
              </div>
              <div className="chip bg-white/20 backdrop-blur-sm text-white text-[11px]">
                🌾 花园 {user.plots.filter(p => p.unlocked).length}块
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 数据统计 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: '花园地块', value: user.plots.filter(p => p.unlocked).length },
          { label: '背包容量', value: user.inventorySize },
          { label: '物品数', value: user.inventory.filter(i => i.quantity > 0).length },
        ].map((item, idx) => (
          <div key={idx} className="card p-3 text-center">
            <div className="text-lg font-bold text-slate-800">{item.value}</div>
            <div className="text-[11px] text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      {/* 菜单 */}
      <div className="card overflow-hidden">
        {menuItems.map((item, idx) => {
          const Icon = item.icon
          return (
            <button
              key={idx}
              onClick={item.onClick}
              className={classNames(
                'w-full p-4 flex items-center gap-3 transition-all hover:bg-slate-50 text-left',
                idx !== menuItems.length - 1 && 'border-b border-slate-100'
              )}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm`}>
                <Icon size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 text-sm">{item.label}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{item.tip}</div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          )
        })}
      </div>

      {/* 退出登录 */}
      <button
        onClick={handleLogout}
        className="w-full mt-4 card py-3.5 text-red-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} /> 退出登录
      </button>

      {/* CDK 弹窗 */}
      {showCDK && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCDK(false)}>
          <div className="card w-full max-w-md p-5 slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Gift size={20} className="text-purple-500" /> CDK 兑换
              </h2>
              <button onClick={() => setShowCDK(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">输入 CDK 码</label>
                <input
                  className="input uppercase tracking-widest"
                  value={cdkCode}
                  onChange={(e) => setCdkCode(e.target.value.toUpperCase())}
                  maxLength={16}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                />
              </div>
              <button
                onClick={redeemCDK}
                disabled={loading || !cdkCode.trim()}
                className="btn-primary w-full py-2.5"
              >
                {loading ? '兑换中...' : '立即兑换'}
              </button>
              <p className="text-xs text-slate-400 text-center">
                CDK 码由官方活动发放，请注意大小写
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 排行榜弹窗 */}
      {showRankList && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowRankList(false)}>
          <div className="card w-full sm:max-w-lg max-h-[85vh] flex flex-col slide-up rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Award size={20} className="text-amber-500" /> 排行榜
              </h2>
              <button onClick={() => setShowRankList(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 m-3 rounded-xl flex-shrink-0">
              {([
                { k: 'coins', l: '总资产' },
                { k: 'flowers', l: '收藏数' },
                { k: 'family', l: '家族贡献' },
              ] as const).map(t => (
                <button
                  key={t.k}
                  onClick={() => setRankTab(t.k as any)}
                  className={classNames(
                    'py-2 rounded-lg text-xs font-medium transition-all',
                    rankTab === t.k ? 'bg-white text-garden-700 shadow-sm' : 'text-slate-500'
                  )}
                >
                  {t.l}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-2 scrollbar-thin">
              {rankings.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-12">暂无数据</div>
              ) : (
                rankings.map((u, idx) => (
                  <div key={u.id} className="card p-3 flex items-center gap-3">
                    <div className={classNames(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                      idx === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white' :
                        idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                          idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-white' :
                            'bg-slate-100 text-slate-500'
                    )}>
                      {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                      {u.avatar || '🌱'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {u.nickname}
                        {u.id === user.id && <span className="chip bg-garden-100 text-garden-700 text-[9px] ml-1">我</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">ID: {u.id}</div>
                    </div>
                    <div className="font-bold text-amber-600 text-sm">{formatNumber(u.value || u.coins || 0)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 通知弹窗 */}
      {showNotifications && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowNotifications(false)}>
          <div className="card w-full sm:max-w-lg max-h-[85vh] flex flex-col slide-up rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Bell size={20} className="text-blue-500" /> 消息中心
              </h2>
              <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">暂无消息</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={classNames('card p-3', !n.read && 'ring-1 ring-garden-300 bg-garden-50/30')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-slate-800">{n.title}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(n.createdAt).slice(5, 16)}</span>
                    </div>
                    <p className="text-xs text-slate-600">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 游戏介绍公告弹窗 */}
      {showAnnouncements && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowAnnouncements(false)}>
          <div className="card w-full sm:max-w-lg max-h-[85vh] flex flex-col slide-up rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h2 className="font-bold text-lg text-slate-800">📖 游戏帮助</h2>
              <button onClick={() => setShowAnnouncements(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {announcements.map(a => (
                <div key={a.id} className={`p-4 rounded-xl ${
                  a.priority === 'urgent' ? 'bg-amber-50 border border-amber-200' :
                    a.priority === 'important' ? 'bg-blue-50 border border-blue-200' :
                      'bg-slate-50'
                }`}>
                  <div className="font-bold text-slate-800 mb-1.5">{a.title}</div>
                  <div className="text-sm text-slate-600 whitespace-pre-wrap">{a.content}</div>
                  <div className="text-[11px] text-slate-400 mt-2">{formatDateTime(a.createdAt)}</div>
                </div>
              ))}
              {announcements.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">暂无公告</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
