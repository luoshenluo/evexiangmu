'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatDateTime } from '@/lib/utils'
import {
  Flag, Trash2, RefreshCw, FileText, TrendingUp, Check, X,
  Inbox, CheckCircle, MessageSquare,
} from 'lucide-react'

interface ReportItem {
  id: string
  targetType: 'post' | 'comment'
  targetId: string
  reporterId: string
  reason: string
  createdAt: number
  status: string
  reporter?: { id: string; nickname: string; avatar: string }
  targetTitle?: string
  targetUserId?: string
  postId?: string
}

interface ForumPostAdmin {
  id: string
  userId: string
  title: string
  content: string
  createdAt: number
  likeCount: number
  commentCount: number
  author?: { id: string; nickname: string; avatar: string }
  deleted?: boolean
}

interface ForumStats {
  posts: number
  comments: number
  reports: number
  pendingReports: number
}

type ReportFilter = 'pending' | 'handled' | 'dismissed' | 'all'

export default function ForumManagement() {
  const { showToast } = useAppStore()
  const [tab, setTab] = useState<'reports' | 'posts' | 'stats'>('reports')
  const [filter, setFilter] = useState<ReportFilter>('pending')
  const [reports, setReports] = useState<ReportItem[]>([])
  const [posts, setPosts] = useState<ForumPostAdmin[]>([])
  const [stats, setStats] = useState<ForumStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [opLoading, setOpLoading] = useState<string | null>(null)
  const [postPage, setPostPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [repRes, statsRes] = await Promise.all([
        apiFetch(`/api/admin/forum/reports?status=${filter}&limit=100`),
        apiFetch('/api/admin/forum/stats'),
      ])
      if (repRes.success) setReports(repRes.data || [])
      if (statsRes.success) setStats(statsRes.data)
    } finally {
      setLoading(false)
    }
  }, [filter])

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/admin/forum/posts?page=${postPage}`)
      if (res.success) setPosts(res.data?.items || [])
    } finally {
      setLoading(false)
    }
  }, [postPage])

  useEffect(() => {
    if (tab === 'reports') load()
    if (tab === 'stats') load()
    if (tab === 'posts') loadPosts()
  }, [tab, filter, postPage, load, loadPosts])

  const handleReport = async (item: ReportItem, status: 'handled' | 'dismissed', deleteTarget: boolean) => {
    if (deleteTarget && !confirm(`确定删除该${item.targetType === 'post' ? '帖子' : '评论'}吗？（软删除，可恢复）`)) return
    setOpLoading(item.id)
    try {
      const res = await apiFetch(`/api/admin/forum/reports/${item.id}`, {
        method: 'POST',
        body: JSON.stringify({ status, deleteTarget }),
      })
      if (res.success) {
        showToast('处理完成', 'success')
        await load()
      } else showToast(res.error || '操作失败', 'error')
    } finally { setOpLoading(null) }
  }

  const deletePost = async (p: ForumPostAdmin) => {
    if (!confirm(`确定删除帖子「${p.title}」吗？`)) return
    setOpLoading(`p_${p.id}`)
    try {
      const res = await apiFetch(`/api/admin/forum/posts?id=${p.id}`, { method: 'DELETE' })
      if (res.success) {
        showToast('已删除', 'success')
        await loadPosts()
      } else showToast(res.error || '删除失败', 'error')
    } finally { setOpLoading(null) }
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '帖子数', value: stats?.posts ?? 0, icon: FileText, color: 'from-garden-500 to-emerald-600' },
          { label: '评论数', value: stats?.comments ?? 0, icon: MessageSquare, color: 'from-sky-500 to-blue-600' },
          { label: '举报总数', value: stats?.reports ?? 0, icon: Flag, color: 'from-amber-500 to-orange-600' },
          { label: '待处理', value: stats?.pendingReports ?? 0, icon: Inbox, color: 'from-rose-500 to-red-600' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="card p-3">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
                <Icon size={16} className="text-white" />
              </div>
              <div className="text-xl font-bold text-slate-800">{s.value}</div>
              <div className="text-[11px] text-slate-500">{s.label}</div>
            </div>
          )
        })}
      </div>

      {/* 功能切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('reports')}
          className={classNames(
            'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors',
            tab === 'reports' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <Flag size={12} /> 举报处理
        </button>
        <button
          onClick={() => setTab('posts')}
          className={classNames(
            'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors',
            tab === 'posts' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <FileText size={12} /> 帖子管理
        </button>
      </div>

      {/* 举报处理 */}
      {tab === 'reports' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {([
              { k: 'pending', label: '待处理', icon: Inbox },
              { k: 'handled', label: '已处理', icon: CheckCircle },
              { k: 'dismissed', label: '已驳回', icon: X },
              { k: 'all', label: '全部', icon: RefreshCw },
            ] as const).map((f) => {
              const Icon = f.icon
              return (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={classNames(
                    'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors',
                    filter === f.k ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  <Icon size={12} /> {f.label}
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="card p-10 text-center text-slate-400 text-sm">加载中...</div>
          ) : reports.length === 0 ? (
            <div className="card p-10 text-center">
              <CheckCircle size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">暂无举报</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <Flag size={16} className="text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={classNames(
                          'px-2 py-0.5 rounded text-[10px] font-medium',
                          r.targetType === 'post' ? 'bg-garden-100 text-garden-700' : 'bg-sky-100 text-sky-700'
                        )}>
                          {r.targetType === 'post' ? '帖子' : '评论'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {r.targetTitle || '(内容已删除)'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 mb-1">原因：{r.reason}</div>
                      <div className="text-[11px] text-slate-400">
                        举报人：{r.reporter?.nickname || '已注销'} · {formatDateTime(r.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleReport(r, 'handled', true)}
                        disabled={opLoading === r.id}
                        className="px-3 py-1 rounded-lg text-xs bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                      >
                        删除并处理
                      </button>
                      <button
                        onClick={() => handleReport(r, 'handled', false)}
                        disabled={opLoading === r.id}
                        className="px-3 py-1 rounded-lg text-xs bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                      >
                        标记处理
                      </button>
                      {r.status === 'pending' && (
                        <button
                          onClick={() => handleReport(r, 'dismissed', false)}
                          disabled={opLoading === r.id}
                          className="px-3 py-1 rounded-lg text-xs bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50"
                        >
                          驳回
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 帖子管理 */}
      {tab === 'posts' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">帖子列表（含已删除）</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPostPage(Math.max(1, postPage - 1))}
                disabled={postPage <= 1}
                className="px-2 py-1 rounded text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-xs text-slate-500">第 {postPage} 页</span>
              <button
                onClick={() => setPostPage(postPage + 1)}
                className="px-2 py-1 rounded text-xs bg-slate-100 hover:bg-slate-200"
              >
                下一页
              </button>
            </div>
          </div>

          {loading ? (
            <div className="card p-10 text-center text-slate-400 text-sm">加载中...</div>
          ) : posts.length === 0 ? (
            <div className="card p-10 text-center text-slate-500 text-sm">暂无帖子</div>
          ) : (
            posts.map((p) => (
              <div key={p.id} className={classNames('card p-4', p.deleted && 'opacity-50')}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-800 text-sm truncate">{p.title}</span>
                      {p.deleted && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-600">已删除</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-2 mb-1">{p.content}</div>
                    <div className="text-[11px] text-slate-400">
                      {p.author?.nickname || '已注销'} · {formatDateTime(p.createdAt)}
                      {' · '}👍 {p.likeCount} · 💬 {p.commentCount}
                    </div>
                  </div>
                  {!p.deleted && (
                    <button
                      onClick={() => deletePost(p)}
                      disabled={opLoading === `p_${p.id}`}
                      className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      aria-label="删除帖子"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}