'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatDateTime } from '@/lib/utils'
import { Users, Search, Plus, X, Check, MessageCircle, UserPlus, Eye, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import LoginModal from '@/components/LoginModal'

type FriendTab = 'friends' | 'requests' | 'search'

export default function FriendsPage() {
  const { user, updateUser, showToast } = useAppStore()
  const [tab, setTab] = useState<FriendTab>('friends')
  const [friends, setFriends] = useState<any[]>([])
  const [incoming, setIncoming] = useState<any[]>([])
  const [outgoing, setOutgoing] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchKw, setSearchKw] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = async () => {
    if (!user) return
    setLoading('refresh')
    try {
      const [fRes, rRes] = await Promise.all([
        apiFetch('/api/friends?action=list'),
        apiFetch('/api/friends?action=requests'),
      ])
      if (fRes.success) setFriends(fRes.data || [])
      if (rRes.success) {
        setIncoming(rRes.data?.incoming || [])
        setOutgoing(rRes.data?.outgoing || [])
      }
    } finally {
      setLoading(null)
    }
  }

  useEffect(() => { refresh() }, [user, refreshKey])

  const doSearch = async () => {
    if (!user || !searchKw.trim()) return
    setLoading('search')
    try {
      const res = await apiFetch(`/api/friends?action=search&kw=${encodeURIComponent(searchKw)}`)
      if (res.success) setSearchResults(res.data || [])
      else showToast(res.error || '搜索失败', 'error')
    } finally { setLoading(null) }
  }

  const sendRequest = async (toUserId: string, message = '') => {
    if (!user) return
    setLoading(`send_${toUserId}`)
    try {
      const res = await apiFetch('/api/friends', {
        method: 'POST',
        body: JSON.stringify({ mode: 'send-request', toUserId, message }),
      })
      if (res.success) {
        showToast('好友申请已发送', 'success')
        setRefreshKey((k) => k + 1)
      } else showToast(res.error || '发送失败', 'error')
    } finally { setLoading(null) }
  }

  const handleRequest = async (requestId: string, accept: boolean) => {
    if (!user) return
    setLoading(`req_${requestId}_${accept}`)
    try {
      const res = await apiFetch('/api/friends', {
        method: 'POST',
        body: JSON.stringify({
          mode: accept ? 'accept-request' : 'reject-request',
          requestId,
        }),
      })
      if (res.success) {
        showToast(accept ? '已添加好友！' : '已拒绝', 'success')
        setRefreshKey((k) => k + 1)
        // 刷新用户（好友数更新）
        const uRes = await apiFetch('/api/user/me')
        if (uRes.success && uRes.data) updateUser(uRes.data)
      } else showToast(res.error || '操作失败', 'error')
    } finally { setLoading(null) }
  }

  const removeFriend = async (friendId: string) => {
    if (!confirm('确定删除该好友吗？')) return
    setLoading(`rm_${friendId}`)
    try {
      const res = await apiFetch('/api/friends', {
        method: 'POST',
        body: JSON.stringify({ mode: 'remove-friend', friendId }),
      })
      if (res.success) {
        showToast('已删除好友', 'info')
        setRefreshKey((k) => k + 1)
        const uRes = await apiFetch('/api/user/me')
        if (uRes.success && uRes.data) updateUser(uRes.data)
      } else showToast(res.error || '操作失败', 'error')
    } finally { setLoading(null) }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 text-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
        <div className="card p-10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <Users size={40} className="text-green-500" />
          </div>
          <h2 className="font-bold text-lg mb-1 text-slate-800">请先登录</h2>
          <p className="text-sm text-slate-500 mb-5">登录后使用好友系统</p>
          <button onClick={() => setShowLogin(true)} className="btn-primary">登录 / 注册</button>
        </div>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </div>
    )
  }

  const pendingCount = incoming.length

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      {/* 顶部 */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-md shadow-green-200">
            <Users size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">好友</h1>
            <p className="text-xs text-slate-500">
              共 {friends.length} 位好友
              {pendingCount > 0 && <span className="ml-2 text-red-500 font-medium">· {pendingCount} 条申请</span>}
            </p>
          </div>
          <button
            onClick={() => { setTab('search'); setSearchKw(''); setSearchResults([]) }}
            className="btn-primary py-2 px-3 text-xs flex items-center gap-1"
          >
            <UserPlus size={14} /> 加好友
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-4">
        {([
          { k: 'friends', label: '好友列表', count: friends.length },
          { k: 'requests', label: '好友申请', count: pendingCount },
          { k: 'search', label: '添加好友' },
        ] as const).map((t) => {
          const active = tab === t.k
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={classNames(
                'py-2 rounded-lg text-xs font-medium transition-all relative',
                active ? 'bg-white text-garden-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {t.label}
              {'count' in t && t.count > 0 ? (
                <span className={classNames(
                  'ml-1 inline-flex items-center justify-center text-[10px] rounded-full min-w-[16px] px-1 h-4',
                  t.k === 'requests' ? 'bg-red-100 text-red-600' : 'bg-garden-100 text-garden-700'
                )}>
                  {t.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* 好友列表 */}
      {tab === 'friends' && (
        <div className="space-y-2">
          {loading === 'refresh' && friends.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">加载中...</div>
          )}
          {friends.length === 0 && loading !== 'refresh' ? (
            <div className="card p-10 text-center">
              <Users size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="text-slate-500 text-sm">还没有好友</p>
              <p className="text-slate-400 text-xs mt-1 mb-4">去添加一些花友一起玩吧</p>
              <button onClick={() => setTab('search')} className="btn-primary py-2 text-sm">
                <UserPlus size={14} /> 立即添加
              </button>
            </div>
          ) : (
            friends.map((f) => (
              <div key={f.id} className="card p-3 flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-2xl">
                    {f.avatar}
                  </div>
                  <span className={classNames(
                    'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white',
                    f.online ? 'bg-green-500' : 'bg-slate-300'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 truncate">{f.nickname}</span>
                    {f.title && <span className="chip text-[9px] bg-amber-100 text-amber-700">{f.title}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {f.online ? <span className="text-green-600">● 在线</span> : `离线 · ${formatDateTime(f.lastLogin).slice(5, 16)}`}
                    {' · '}花园 {f.plotsUnlocked} 块
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => window.open(`/visit?u=${f.id}`, '_blank')}
                    className="px-2.5 py-1 rounded-lg text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-1"
                  >
                    <Eye size={12} /> 拜访
                  </button>
                  <button
                    onClick={() => removeFriend(f.id)}
                    disabled={loading === `rm_${f.id}`}
                    className="px-2.5 py-1 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> 删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 好友申请 */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {/* 收到的申请 */}
          <div>
            <h3 className="text-xs font-medium text-slate-500 mb-2 px-1">
              收到的申请 {incoming.length > 0 && <span className="text-red-500">（{incoming.length}）</span>}
            </h3>
            {incoming.length === 0 ? (
              <div className="card p-6 text-center text-sm text-slate-400">
                暂无新的好友申请
              </div>
            ) : (
              <div className="space-y-2">
                {incoming.map((r) => (
                  <div key={r.id} className="card p-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center text-2xl">
                      {r.fromUserAvatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800">{r.fromUserName}</div>
                      {r.message ? (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">「{r.message}」</div>
                      ) : (
                        <div className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(r.createdAt)}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleRequest(r.id, false)}
                        disabled={!!loading?.startsWith(`req_${r.id}`)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-1"
                      >
                        <X size={12} /> 拒绝
                      </button>
                      <button
                        onClick={() => handleRequest(r.id, true)}
                        disabled={!!loading?.startsWith(`req_${r.id}`)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-garden-500 text-white hover:bg-garden-600 flex items-center gap-1"
                      >
                        <Check size={12} /> 接受
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 发出的申请 */}
          <div>
            <h3 className="text-xs font-medium text-slate-500 mb-2 px-1">我发出的申请（{outgoing.length}）</h3>
            {outgoing.length === 0 ? (
              <div className="card p-6 text-center text-sm text-slate-400">暂无</div>
            ) : (
              <div className="space-y-2">
                {outgoing.map((r) => (
                  <div key={r.id} className="card p-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center text-2xl">
                      {r.toUserAvatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800">{r.toUserName}</div>
                      <div className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" /> 等待处理中...
                      </div>
                    </div>
                    <span className="chip text-[10px] bg-amber-100 text-amber-700">待处理</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 搜索/添加 */}
      {tab === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchKw}
              onChange={(e) => setSearchKw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder="搜索昵称、用户名或ID..."
              className="input pl-10 py-2.5"
            />
          </div>
          <button
            onClick={doSearch}
            disabled={loading === 'search' || !searchKw.trim()}
            className="btn-primary w-full py-2.5 disabled:opacity-50"
          >
            {loading === 'search' ? '搜索中...' : <><Search size={14} /> 搜索用户</>}
          </button>

          {searchResults.length > 0 && (
            <div className="space-y-2 mt-2">
              {searchResults.map((u) => (
                <div key={u.id} className="card p-3 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 flex items-center justify-center text-2xl">
                    {u.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 truncate">{u.nickname}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">@{u.username}</div>
                    <div className="text-[11px] text-slate-400">
                      花园 {u.plots?.filter?.((p: any) => p.unlocked).length || 0} 块
                      {' · '}注册于 {formatDateTime(u.createdAt).slice(0, 10)}
                    </div>
                  </div>
                  <button
                    onClick={() => sendRequest(u.id)}
                    disabled={loading === `send_${u.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-garden-500 text-white hover:bg-garden-600 flex items-center gap-1 disabled:opacity-60"
                  >
                    {loading === `send_${u.id}` ? '已发送' : <><Plus size={12} /> 加好友</>}
                  </button>
                </div>
              ))}
            </div>
          )}
          {searchResults.length === 0 && searchKw && loading !== 'search' && (
            <div className="card p-6 text-center">
              <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">未找到匹配的用户</p>
              <p className="text-xs text-slate-400 mt-1">试试其他关键词</p>
            </div>
          )}
          {!searchKw && (
            <div className="card p-6 text-center text-sm text-slate-400">
              输入关键词搜索其他玩家~
            </div>
          )}
        </div>
      )}
    </div>
  )
}
