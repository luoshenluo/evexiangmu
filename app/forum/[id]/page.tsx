'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatChatTime } from '@/lib/utils'
import { ThumbsUp, MessageCircle, ArrowLeft, Trash2, Flag, Send, X } from 'lucide-react'
import LoginModal from '@/components/LoginModal'

interface ForumPostDetail {
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

interface ForumComment {
  id: string
  postId: string
  userId: string
  content: string
  createdAt: number
  author?: { id: string; nickname: string; avatar: string }
}

export default function ForumDetailPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string
  const { user, showToast } = useAppStore()
  const [post, setPost] = useState<ForumPostDetail | null>(null)
  const [comments, setComments] = useState<ForumComment[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [liking, setLiking] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/forum/posts/${postId}`)
      if (res.success && res.data) {
        setPost(res.data.post)
        setComments(res.data.comments || [])
      } else {
        showToast(res.error || '加载失败', 'error')
        router.push('/forum')
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [postId])

  const toggleLike = async () => {
    if (!user) { setShowLogin(true); return }
    if (liking || !post) return
    setLiking(true)
    try {
      const res = await apiFetch(`/api/forum/posts/${postId}/like`, { method: 'POST' })
      if (res.success && res.data) {
        setPost({ ...post, liked: res.data.liked, likeCount: res.data.likeCount ?? post.likeCount })
      } else showToast(res.error || '操作失败', 'error')
    } finally { setLiking(false) }
  }

  const deletePost = async () => {
    if (!post) return
    if (!confirm('确定删除这篇帖子吗？')) return
    const res = await apiFetch(`/api/forum/posts/${postId}`, { method: 'DELETE' })
    if (res.success) {
      showToast('已删除', 'success')
      router.push('/forum')
    } else showToast(res.error || '删除失败', 'error')
  }

  const submitComment = async () => {
    if (!user) { setShowLogin(true); return }
    if (!comment.trim()) return showToast('请输入评论内容', 'error')
    setSubmitting(true)
    try {
      const res = await apiFetch(`/api/forum/posts/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ content: comment }),
      })
      if (res.success && res.data) {
        setComments([...comments, res.data])
        setComment('')
        setPost(post ? { ...post, commentCount: post.commentCount + 1 } : post)
        showToast('评论成功', 'success')
      } else showToast(res.error || '评论失败', 'error')
    } finally { setSubmitting(false) }
  }

  const deleteComment = async (cid: string) => {
    if (!confirm('确定删除这条评论吗？')) return
    const res = await apiFetch(`/api/forum/comments/${cid}`, { method: 'DELETE' })
    if (res.success) {
      setComments(comments.filter((c) => c.id !== cid))
      setPost(post ? { ...post, commentCount: Math.max(0, post.commentCount - 1) } : post)
      showToast('已删除', 'success')
    } else showToast(res.error || '删除失败', 'error')
  }

  const openReport = (type: 'post' | 'comment', id: string) => {
    if (!user) { setShowLogin(true); return }
    setReportTarget({ type, id })
    setReportReason('')
    setShowReport(true)
  }

  const submitReport = async () => {
    if (!reportTarget) return
    if (!reportReason.trim()) return showToast('请填写举报原因', 'error')
    const base = reportTarget.type === 'post' ? `/api/forum/posts/${reportTarget.id}` : `/api/forum/comments/${reportTarget.id}`
    const res = await apiFetch(`${base}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason: reportReason }),
    })
    if (res.success) {
      showToast('举报成功，感谢反馈', 'success')
      setShowReport(false)
    } else showToast(res.error || '举报失败', 'error')
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="card p-6 animate-pulse">
          <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
          <div className="h-3 bg-slate-100 rounded w-1/3 mb-4" />
          <div className="h-3 bg-slate-100 rounded w-full mb-2" />
          <div className="h-3 bg-slate-100 rounded w-5/6" />
        </div>
      </div>
    )
  }

  if (!post) return null

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      {/* 返回栏 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/forum')} className="icon-btn-sm bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="返回论坛">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => openReport('post', post.id)} className="icon-btn-sm bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500" aria-label="举报帖子">
            <Flag size={16} />
          </button>
          {(user?.id === post.userId || user?.isAdmin) && (
            <button onClick={deletePost} className="icon-btn-sm bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500" aria-label="删除帖子">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 帖子内容 */}
      <div className="card p-5 mb-4">
        <h1 className="font-bold text-lg text-slate-800 leading-snug mb-3">{post.title}</h1>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg">
            {post.author?.avatar || '🌱'}
          </div>
          <div className="text-xs">
            <div className="font-medium text-slate-600">{post.author?.nickname || '已注销用户'}</div>
            <div className="text-slate-400 mt-0.5">{formatChatTime(post.createdAt)}</div>
          </div>
        </div>
        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{post.content}</div>
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100">
          <button
            onClick={toggleLike}
            className={classNames(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              post.liked ? 'bg-garden-100 text-garden-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <ThumbsUp size={14} className={post.liked ? 'fill-garden-500 text-garden-500' : ''} />
            {post.likeCount}
          </button>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <MessageCircle size={14} /> {post.commentCount} 评论
          </span>
        </div>
      </div>

      {/* 评论区 */}
      <div className="mb-4">
        <h2 className="font-bold text-sm text-slate-700 mb-3">全部评论（{comments.length}）</h2>
        {comments.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-400">
            还没有评论，来说两句吧~
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-sm">
                    {c.author?.avatar || '🌱'}
                  </div>
                  <span className="text-xs font-medium text-slate-600">{c.author?.nickname || '已注销用户'}</span>
                  <span className="text-[11px] text-slate-400">· {formatChatTime(c.createdAt)}</span>
                  <div className="flex-1" />
                  <button onClick={() => openReport('comment', c.id)} className="text-slate-300 hover:text-red-400" aria-label="举报评论">
                    <Flag size={13} />
                  </button>
                  {(user?.id === c.userId || user?.isAdmin) && (
                    <button onClick={() => deleteComment(c.id)} className="text-slate-300 hover:text-red-400" aria-label="删除评论">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{c.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 评论输入 */}
      <div className="card p-4 sticky bottom-24">
        <div className="flex items-center gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
            maxLength={500}
            placeholder={user ? '写下你的评论…' : '登录后参与评论'}
            className="input flex-1"
          />
          <button onClick={submitComment} disabled={submitting} className="icon-btn-sm bg-garden-500 text-white hover:bg-garden-600 disabled:opacity-60" aria-label="发送评论">
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* 举报弹窗 */}
      {showReport && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowReport(false)}>
          <div className="card w-full max-w-md p-5 slide-up rounded-t-3xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Flag size={20} className="text-red-500" /> 举报
              </h2>
              <button onClick={() => setShowReport(false)} className="p-2 hover:bg-slate-100 rounded-xl" aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              maxLength={200}
              rows={4}
              placeholder="请描述违规内容或原因…"
              className="input resize-none"
            />
            <button onClick={submitReport} className="btn-primary w-full mt-3">
              提交举报
            </button>
          </div>
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
    </div>
  )
}