'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatChatTime } from '@/lib/utils'
import { MessageSquare, ThumbsUp, MessageCircle, PenSquare, X, Search, TrendingUp, Clock, LogIn, Send } from 'lucide-react'
import LoginModal from '@/components/LoginModal'

interface ForumPostItem {
  id: string
  userId: string
  title: string
  content: string
  createdAt: number
  likeCount: number
  commentCount: number
  author?: { id: string; nickname: string; avatar: string }
  liked?: boolean
}

type SortMode = 'latest' | 'hot'

export default function ForumPage() {
  const { user, showToast } = useAppStore()
  const router = useRouter()
  const [posts, setPosts] = useState<ForumPostItem[]>([])
  const [sort, setSort] = useState<SortMode>('latest')
  const [loading, setLoading] = useState(true)
  const [showNewPost, setShowNewPost] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/forum/posts?sort=${sort}`)
      if (res.success && res.data) setPosts(res.data.items || [])
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => { loadPosts() }, [loadPosts])

  const handleSubmit = async () => {
    if (!user) { setShowLogin(true); return }
    if (!title.trim()) return showToast('请填写标题', 'error')
    if (!content.trim()) return showToast('请填写内容', 'error')
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/forum/posts', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      })
      if (res.success && res.data) {
        showToast('发布成功 🎉', 'success')
        setShowNewPost(false)
        setTitle('')
        setContent('')
        setSort('latest')
        await loadPosts()
        router.push(`/forum/${res.data.id}`)
      } else {
        showToast(res.error || '发布失败', 'error')
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-garden-400 to-garden-600 flex items-center justify-center shadow-sm">
            <MessageSquare size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800 leading-tight">花园闲谈</h1>
            <p className="text-[11px] text-slate-400">分享 · 讨论 · 晒花园</p>
          </div>
        </div>
        <button
          onClick={() => { if (!user) { setShowLogin(true); return } setShowNewPost(true) }}
          className="icon-btn-sm bg-garden-500 text-white hover:bg-garden-600"
          aria-label="发帖"
        >
          <PenSquare size={18} />
        </button>
      </div>

      {/* 排序切换 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSort('latest')}
          className={classNames(
            'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors',
            sort === 'latest' ? 'bg-garden-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <Clock size={12} /> 最新
        </button>
        <button
          onClick={() => setSort('hot')}
          className={classNames(
            'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors',
            sort === 'hot' ? 'bg-garden-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <TrendingUp size={12} /> 热门
        </button>
      </div>

      {/* 帖子列表 */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-full mb-2" />
              <div className="h-3 bg-slate-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600 mb-1">还没有帖子</p>
          <p className="text-sm text-slate-400 mb-4">来发第一帖，开启花园话题吧~</p>
          <button
            onClick={() => { if (!user) { setShowLogin(true); return } setShowNewPost(true) }}
            className="btn-primary"
          >
            <PenSquare size={16} /> 发帖
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/forum/${p.id}`)}
              className="card p-4 w-full text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-base">
                  {p.author?.avatar || '🌱'}
                </div>
                <span className="text-xs font-medium text-slate-600">{p.author?.nickname || '已注销用户'}</span>
                <span className="text-[11px] text-slate-400">· {formatChatTime(p.createdAt)}</span>
              </div>
              <div className="font-bold text-slate-800 text-[15px] leading-snug mb-1 line-clamp-2">{p.title}</div>
              <div className="text-sm text-slate-500 leading-snug line-clamp-2 mb-3">{p.content}</div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <ThumbsUp size={13} className={p.liked ? 'text-garden-500 fill-garden-500' : ''} /> {p.likeCount}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle size={13} /> {p.commentCount}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 发帖弹窗 */}
      {showNewPost && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowNewPost(false)}>
          <div className="card w-full max-w-md p-5 slide-up rounded-t-3xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <PenSquare size={20} className="text-garden-500" /> 发布新帖
              </h2>
              <button onClick={() => setShowNewPost(false)} className="p-2 hover:bg-slate-100 rounded-xl" aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">标题</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={50}
                  placeholder="一句话说清主题"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">内容</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={2000}
                  rows={6}
                  placeholder="分享你的花园、经验或问题…"
                  className="input resize-none"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary w-full disabled:opacity-60"
              >
                <Send size={16} /> {submitting ? '发布中…' : '发布'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
    </div>
  )
}