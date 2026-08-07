'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatDateTime } from '@/lib/utils'
import {
  MessageSquare, Trash2, RefreshCw, Search, Globe, Users, UserPlus,
  TrendingUp, Ban, Eye, Filter, AlertCircle,
} from 'lucide-react'

type Channel = 'world' | 'family' | 'friend' | 'all'

interface AdminMessage {
  id: string
  channel: string
  userId: string
  userName: string
  content: string
  timestamp: number
  isSystem: boolean
}

interface ChatStats {
  worldCount: number
  familyCount: number
  friendCount: number
  totalCount: number
  todayCount: number
  topUsers: { userId: string; userName: string; count: number }[]
}

const CHANNEL_LABELS: Record<string, string> = {
  world: '世界',
  family: '家族',
  friend: '好友',
}

export default function ChatManagement() {
  const { showToast } = useAppStore()
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [stats, setStats] = useState<ChatStats | null>(null)
  const [channel, setChannel] = useState<Channel>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [delLoading, setDelLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [msgRes, statsRes] = await Promise.all([
        apiFetch(`/api/admin/chat/messages?limit=100${channel !== 'all' ? `&channel=${channel}` : ''}`),
        apiFetch('/api/admin/chat/stats'),
      ])
      if (msgRes.success) setMessages(msgRes.data || [])
      if (statsRes.success) setStats(statsRes.data)
    } finally {
      setLoading(false)
    }
  }, [channel])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  const deleteMsg = async (id: string) => {
    if (!confirm('确定删除这条消息？此操作不可恢复。')) return
    setDelLoading(id)
    const res = await apiFetch(`/api/admin/chat/messages/${id}`, { method: 'DELETE' })
    if (res.success) {
      showToast('已删除', 'success')
      setMessages(prev => prev.filter(m => m.id !== id))
    } else {
      showToast(res.error || '删除失败', 'error')
    }
    setDelLoading(null)
  }

  const filtered = messages.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.content?.toLowerCase().includes(q) ||
      m.userName?.toLowerCase().includes(q) ||
      m.userId?.toLowerCase().includes(q)
    )
  })

  const channelTabs: { k: Channel; label: string; icon: any }[] = [
    { k: 'all', label: '全部', icon: Filter },
    { k: 'world', label: '世界', icon: Globe },
    { k: 'family', label: '家族', icon: Users },
    { k: 'friend', label: '好友', icon: UserPlus },
  ]

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '世界消息', value: stats?.worldCount || 0, icon: Globe, color: 'from-blue-400 to-blue-600' },
          { label: '家族消息', value: stats?.familyCount || 0, icon: Users, color: 'from-purple-400 to-pink-500' },
          { label: '好友消息', value: stats?.friendCount || 0, icon: UserPlus, color: 'from-emerald-400 to-teal-500' },
          { label: '今日消息', value: stats?.todayCount || 0, icon: TrendingUp, color: 'from-amber-400 to-orange-500' },
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <div key={i} className="card p-4">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-2`}>
                <Icon size={16} className="text-white" />
              </div>
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="text-xl font-bold text-slate-800 mt-0.5">{item.value}</div>
            </div>
          )
        })}
      </div>

      {/* 活跃用户 */}
      {stats && stats.topUsers.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-garden-500" />
            发言最多 Top 10
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.topUsers.map((u, i) => (
              <div key={u.userId} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className={classNames(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                  i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-400' : 'bg-slate-300'
                )}>
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700 font-medium">{u.userName}</span>
                <span className="text-xs text-slate-400">{u.count} 条</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
          {channelTabs.map(c => {
            const Icon = c.icon
            const active = channel === c.k
            return (
              <button
                key={c.k}
                onClick={() => setChannel(c.k)}
                className={classNames(
                  'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  active ? 'bg-white text-garden-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon size={12} />
                {c.label}
              </button>
            )
          })}
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-[160px]">
          <Search size={14} className="text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索内容/用户..."
            className="flex-1 text-sm bg-transparent outline-none"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <MessageSquare size={32} className="mx-auto mb-2 text-slate-300" />
            暂无消息
          </div>
        ) : (
          <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
            {filtered.map(m => (
              <div key={m.id} className="p-3 hover:bg-slate-50 transition-colors group">
                <div className="flex items-start gap-3">
                  <div className={classNames(
                    'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm',
                    m.isSystem ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'
                  )}>
                    {m.isSystem ? '🔔' : (m.userName?.[0] || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-medium text-slate-800">
                        {m.isSystem ? '系统' : m.userName}
                      </span>
                      <span className="chip bg-slate-100 text-slate-500 text-[10px]">
                        {CHANNEL_LABELS[m.channel] || m.channel}
                      </span>
                      {!m.isSystem && (
                        <span className="text-[10px] text-slate-400">ID: {m.userId}</span>
                      )}
                      <span className="text-[10px] text-slate-400">{formatDateTime(m.timestamp)}</span>
                    </div>
                    <p className="text-sm text-slate-600 break-words">{m.content}</p>
                  </div>
                  <button
                    onClick={() => deleteMsg(m.id)}
                    disabled={delLoading === m.id}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="删除消息"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 flex items-center gap-1">
        <AlertCircle size={12} />
        删除消息会从数据库永久移除（不影响其他消息），请谨慎操作
      </div>
    </div>
  )
}
