'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MessageCircle, X, Send, ChevronDown, ChevronLeft,
  Globe, Users, UserPlus, Check,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import {
  apiFetch, classNames, formatDateTime, formatChatTime,
} from '@/lib/utils'
import { filterSensitiveWords } from '@/lib/game-data'
import type { ChatChannel, ChatMessage, PrivateConversation, PrivateMessage } from '@/lib/types'

type FriendChatView = 'conversations' | 'thread'

const channels: { key: ChatChannel; label: string; icon: any }[] = [
  { key: 'world', label: '世界', icon: Globe },
  { key: 'family', label: '家族', icon: Users },
  { key: 'friend', label: '好友', icon: UserPlus },
]

interface Props {
  onRequestLogin?: () => void
  /** 由外部跳转（好友列表点击好友头像私聊）指定 peerId 时直接进入会话 */
  initialPeerId?: string
}

export default function ChatWidget({ onRequestLogin, initialPeerId }: Props) {
  const {
    user, chatExpanded, currentChatChannel, messages,
    setChatExpanded, setCurrentChatChannel, setMessages, addMessage,
    recordMessageTime, showToast,
    isGuest, isOffline,
  } = useAppStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ========= 好友私聊状态 =========
  const [friendView, setFriendView] = useState<FriendChatView>(
    initialPeerId ? 'thread' : 'conversations',
  )
  const [activePeerId, setActivePeerId] = useState<string>(initialPeerId || '')
  const [conversations, setConversations] = useState<PrivateConversation[]>([])
  const [threadMessages, setThreadMessages] = useState<PrivateMessage[]>([])
  const [pmUnreadTotal, setPmUnreadTotal] = useState<number>(0)
  const [convLoading, setConvLoading] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const convPollingRef = useRef(0)
  const threadPollingRef = useRef(0)
  // 由外部事件带入的对方昵称/头像（尚未有历史会话时用于展示）
  const [pendingPeerMeta, setPendingPeerMeta] = useState<{ name?: string; avatar?: string } | null>(null)

  // 当 parent 传入 initialPeerId（好友列表点击私聊跳转）→ 自动打开好友Tab并进入会话
  useEffect(() => {
    if (initialPeerId) {
      setCurrentChatChannel('friend')
      setActivePeerId(initialPeerId)
      setFriendView('thread')
      setChatExpanded(true)
    }
  }, [initialPeerId, setCurrentChatChannel, setChatExpanded])

  // 监听 CustomEvent（好友列表页通过 window.dispatchEvent 唤起私聊会话）
  useEffect(() => {
    const onOpenPm = (e: any) => {
      const peerId = String(e?.detail?.peerId || '').trim()
      if (!peerId) return
      setCurrentChatChannel('friend')
      setActivePeerId(peerId)
      setFriendView('thread')
      setChatExpanded(true)
      setPendingPeerMeta({
        name: String(e?.detail?.peerName || ''),
        avatar: String(e?.detail?.peerAvatar || ''),
      })
    }
    if (typeof window === 'undefined') return
    window.addEventListener('garden:open-private-chat', onOpenPm)
    return () => window.removeEventListener('garden:open-private-chat', onOpenPm)
  }, [setCurrentChatChannel, setChatExpanded])

  // ========== 公共频道（世界/家族）加载逻辑 ==========
  useEffect(() => {
    if (isOffline) return
    if (currentChatChannel === 'friend') return // 好友走独立逻辑
    const load = async () => {
      const res = await apiFetch(`/api/chat/${currentChatChannel}`)
      if (res.success && res.data) {
        setMessages(currentChatChannel, res.data)
      }
    }
    load()
  }, [currentChatChannel, isOffline, setMessages])

  // 公共频道轮询
  useEffect(() => {
    if (isOffline) return
    if (currentChatChannel === 'friend') return
    const interval = setInterval(async () => {
      const res = await apiFetch(`/api/chat/${currentChatChannel}`)
      if (res.success && res.data) {
        const existing = messages[currentChatChannel] || []
        if (res.data.length > existing.length) {
          setMessages(currentChatChannel, res.data)
        }
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [currentChatChannel, messages, isOffline, setMessages])

  // ========== 私聊：会话列表加载/轮询 + 总未读数 ==========
  useEffect(() => {
    if (isOffline || !user) return
    if (currentChatChannel !== 'friend') return

    let cancelled = false
    const loadConvs = async () => {
      setConvLoading(true)
      try {
        const [rConv, rUnread] = await Promise.all([
          apiFetch('/api/chat/private?action=conversations'),
          apiFetch('/api/chat/private?action=unread'),
        ])
        if (cancelled) return
        if (rConv.success && rConv.data) setConversations(rConv.data.items || [])
        if (rUnread.success && rUnread.data) setPmUnreadTotal(Number(rUnread.data.count) || 0)
      } finally {
        if (!cancelled) setConvLoading(false)
      }
    }
    loadConvs()
    const t = window.setInterval(loadConvs, 5000)
    convPollingRef.current = t
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [currentChatChannel, isOffline, user])

  // ========== 私聊：当前会话消息加载/轮询 ==========
  useEffect(() => {
    if (isOffline || !user) return
    if (currentChatChannel !== 'friend' || friendView !== 'thread' || !activePeerId) return
    let cancelled = false
    const loadThread = async () => {
      setThreadLoading(true)
      try {
        const res = await apiFetch(`/api/chat/private/${encodeURIComponent(activePeerId)}`)
        if (cancelled) return
        if (res.success && res.data) setThreadMessages(res.data.items || [])
      } finally {
        if (!cancelled) setThreadLoading(false)
      }
    }
    loadThread()
    const t = window.setInterval(loadThread, 3000)
    threadPollingRef.current = t
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [currentChatChannel, friendView, activePeerId, isOffline, user])

  // 进入会话/切Tab或消息更新后滚动到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentChatChannel, chatExpanded, threadMessages, friendView])

  // ========== 发送消息（公共频道 or 私聊） ==========
  const sendMessage = async () => {
    if (!input.trim() || !user) return

    if (user.mutedUntil && user.mutedUntil > Date.now()) {
      const mins = Math.ceil((user.mutedUntil - Date.now()) / 60000)
      showToast(`你已被禁言，还有 ${mins} 分钟解除`, 'error')
      return
    }
    if (!recordMessageTime(user.id)) {
      showToast('发言过于频繁，每分钟最多 5 条', 'error')
      return
    }
    const content = filterSensitiveWords(input.trim())
    setLoading(true)
    try {
      if (currentChatChannel === 'friend') {
        // ====== 私聊发送 ======
        if (friendView !== 'thread' || !activePeerId) {
          showToast('请先选择一位好友开始私聊~', 'error')
          return
        }
        const res = await apiFetch('/api/chat/private', {
          method: 'POST',
          body: JSON.stringify({ toUserId: activePeerId, content }),
        })
        if (res.success && res.data) {
          const sent = res.data.message as PrivateMessage
          setThreadMessages(prev => [...prev, sent])
          // 发完立刻拉一次会话，避免会话列表最后一条消息没变
          const conv = await apiFetch('/api/chat/private?action=conversations')
          if (conv.success && conv.data) setConversations(conv.data.items || [])
          setInput('')
        } else {
          showToast(res.error || '发送失败', 'error')
        }
      } else {
        // ====== 公共频道（世界/家族）发送 ======
        const res = await apiFetch(`/api/chat/${currentChatChannel}`, {
          method: 'POST',
          body: JSON.stringify({ content })
        })
        if (res.success && res.data) {
          addMessage(currentChatChannel, res.data)
          setInput('')
        } else {
          showToast(res.error || '发送失败', 'error')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ===== 当前公共频道消息（必须在任何条件 return 之前调用，遵守 Hooks 规则）=====
  const currentPublicMessages = useMemo(
    () => (currentChatChannel === 'friend' ? [] : (messages[currentChatChannel] || []) as ChatMessage[]),
    [currentChatChannel, messages],
  )

  // ===== 折叠状态：只显示右下角聊天按钮 =====
  if (!chatExpanded) {
    const hasUnread = pmUnreadTotal > 0
    return (
      <button
        onClick={() => setChatExpanded(true)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-garden-500 to-garden-600 text-white shadow-xl shadow-garden-300/50 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 md:bottom-20"
      >
        <MessageCircle size={24} />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] flex items-center justify-center font-bold">
            {pmUnreadTotal > 99 ? '99+' : pmUnreadTotal}
          </span>
        )}
      </button>
    )
  }

  // ===== 渲染内容 =====
  const headerTime = formatDateTime(Date.now()).slice(0, 16)
  const activeConv = conversations.find(c => c.peerId === activePeerId)
  // 无历史会话时，用事件带入的昵称/头像兜底
  const threadPeer: PrivateConversation | undefined = activeConv || (pendingPeerMeta?.name ? {
    peerId: activePeerId,
    peerName: pendingPeerMeta.name,
    peerAvatar: pendingPeerMeta.avatar || '🌱',
    lastMessage: '',
    lastMessageAt: Date.now(),
    unreadCount: 0,
  } : undefined)

  return (
    <div className="fixed bottom-24 right-4 z-50 w-[92vw] max-w-sm h-[480px] max-h-[75vh] card slide-up overflow-hidden flex flex-col shadow-2xl md:bottom-20 md:right-4 md:w-96 md:h-[560px] md:max-h-[80vh]">
      {/* Header */}
      <div className="bg-gradient-to-r from-garden-500 to-garden-600 px-3 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {currentChatChannel === 'friend' && friendView === 'thread' && (
            <button
              onClick={() => { setFriendView('conversations'); setActivePeerId('') }}
              className="p-1 rounded hover:bg-white/20 text-white transition-colors flex-shrink-0"
              title="返回会话列表"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <MessageCircle size={18} className="text-white flex-shrink-0" />
          <span className="text-white font-semibold text-sm truncate">
            {currentChatChannel === 'friend' && friendView === 'thread' && threadPeer
              ? `私聊 · ${threadPeer.peerName}`
              : currentChatChannel === 'friend' ? '私聊' : '聊天'}
          </span>
          <span className="text-garden-100 text-xs ml-2 flex-shrink-0 hidden sm:inline">{headerTime}</span>
        </div>
        <button
          onClick={() => setChatExpanded(false)}
          className="p-1 rounded hover:bg-white/20 text-white transition-colors flex-shrink-0"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Channel Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        {channels.map((ch) => {
          const Icon = ch.icon
          const active = ch.key === currentChatChannel
          const showUnreadBadge = ch.key === 'friend' && pmUnreadTotal > 0
          return (
            <button
              key={ch.key}
              onClick={() => {
                setCurrentChatChannel(ch.key)
                if (ch.key === 'friend') {
                  setFriendView('conversations')
                  setActivePeerId('')
                }
              }}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors border-b-2 relative',
                active
                  ? 'border-garden-500 text-garden-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon size={14} />
              {ch.label}
              {showUnreadBadge && (
                <span className="absolute -top-0.5 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                  {pmUnreadTotal > 99 ? '99+' : pmUnreadTotal}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 消息区 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin bg-gradient-to-b from-slate-50/30 to-white"
      >
        {isGuest ? (
          <GuestHint onLogin={() => onRequestLogin?.()} />
        ) : currentChatChannel === 'friend' ? (
          // ========== 好友私聊分支 ==========
          friendView === 'conversations' ? (
            <ConversationsView
              conversations={conversations}
              loading={convLoading}
              onSelect={(peerId) => { setActivePeerId(peerId); setFriendView('thread') }}
            />
          ) : (
            <ThreadView
              peer={threadPeer}
              peerId={activePeerId}
              messages={threadMessages}
              currentUserId={user?.id}
              loading={threadLoading}
            />
          )
        ) : (
          // ========== 公共频道：世界/家族 ==========
          currentPublicMessages.length === 0 ? (
            <div className="text-center text-slate-400 text-xs py-8">
              暂无消息，快来发言吧~
            </div>
          ) : (
            currentPublicMessages.map((msg) => (
              <PublicMessageBubble key={msg.id} msg={msg} myId={user?.id} />
            ))
          )
        )}
      </div>

      {/* Input / 游客提示 / 离线提示 */}
      <div className="border-t border-slate-100 p-2 flex gap-2 flex-shrink-0 bg-white">
        {isOffline ? (
          <div className="flex-1 py-2 text-center text-xs text-slate-400">🌙 已离线</div>
        ) : isGuest ? (
          <div className="flex-1 flex items-center gap-2">
            <span className="flex-1 px-3 py-2 text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
              游客无法发言，请先登录
            </span>
            <button
              onClick={() => onRequestLogin?.()}
              className="px-3 py-2 rounded-lg bg-garden-500 text-white text-xs font-medium hover:bg-garden-600 active:scale-95 transition-all"
            >
              登录
            </button>
          </div>
        ) : currentChatChannel === 'friend' && friendView === 'conversations' ? (
          <div className="flex-1 py-2 text-center text-xs text-slate-400">
            选择一位好友开始私聊~
          </div>
        ) : (
          <>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentChatChannel === 'friend'
                  ? '给TA发消息...'
                  : '说点什么...'
              }
              className="flex-1 px-3 py-2 text-sm bg-slate-50 rounded-lg border border-slate-200 focus:border-garden-400 focus:ring-1 focus:ring-garden-200 outline-none"
              maxLength={currentChatChannel === 'friend' ? 500 : 200}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className={classNames(
                'px-3 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-1 transition-all',
                input.trim() && !loading
                  ? 'bg-garden-500 hover:bg-garden-600 active:scale-95'
                  : 'bg-slate-300 cursor-not-allowed'
              )}
            >
              <Send size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ==================== 子组件：游客提示 ====================
function GuestHint({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
        <MessageCircle size={28} className="text-slate-400" />
      </div>
      <p className="text-sm text-slate-500 mb-3">登录后即可聊天</p>
      <button
        onClick={onLogin}
        className="px-4 py-2 rounded-lg bg-garden-500 text-white text-xs font-medium hover:bg-garden-600"
      >去登录</button>
    </div>
  )
}

// ==================== 子组件：公共频道消息气泡 ====================
function PublicMessageBubble({ msg, myId }: { msg: ChatMessage; myId?: string }) {
  const isMe = msg.userId === myId
  return (
    <div key={msg.id} className={classNames('text-sm slide-up', msg.isSystem && 'text-center')}>
      {msg.isSystem ? (
        <div className="chip bg-amber-50 text-amber-700 mx-auto text-[11px] my-1">
          {msg.content}
        </div>
      ) : (
        <div className={classNames('flex gap-2', isMe ? 'flex-row-reverse' : '')}>
          <div className={classNames(
            'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm',
            isMe ? 'bg-garden-500 text-white' : 'bg-slate-200',
          )}>
            {msg.userName[0] || '?'}
          </div>
          <div className={classNames('max-w-[75%]', isMe ? 'items-end' : '')}>
            <div className={classNames(
              'text-[11px] text-slate-400 mb-0.5',
              isMe ? 'text-right' : '',
            )}>
              {msg.userName} · {formatChatTime(msg.timestamp)}
            </div>
            <div className={classNames(
              'px-3 py-1.5 rounded-2xl break-words',
              isMe
                ? 'bg-garden-500 text-white rounded-tr-sm'
                : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm',
            )}>
              {msg.content}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 子组件：私聊会话列表 ====================
function ConversationsView({
  conversations, loading, onSelect,
}: {
  conversations: PrivateConversation[]
  loading: boolean
  onSelect: (peerId: string) => void
}) {
  if (loading && conversations.length === 0) {
    return (
      <div className="text-center text-slate-400 text-xs py-8">加载中...</div>
    )
  }
  if (conversations.length === 0) {
    return (
      <div className="text-center text-slate-400 text-xs py-10 px-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
          <UserPlus size={26} className="text-slate-400" />
        </div>
        还没有私聊会话~
        <div className="text-[11px] mt-2 text-slate-400/80">
          添加好友后，到「我的→好友」或好友头像点击开始聊天吧
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1 -mx-1">
      {conversations.map((c) => (
        <button
          key={c.peerId}
          onClick={() => onSelect(c.peerId)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 bg-gradient-to-br from-indigo-100 to-violet-200 relative">
            {c.peerAvatar || '🌱'}
            {c.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 truncate">{c.peerName}</span>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{formatChatTime(c.lastMessageAt)}</span>
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {c.lastMessage || '暂未开始聊天'}
            </div>
          </div>
          {c.unreadCount > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold flex-shrink-0">
              {c.unreadCount > 99 ? '99+' : c.unreadCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ==================== 子组件：私聊会话线程 ====================
function ThreadView({
  peer, peerId, messages: msgs, currentUserId, loading,
}: {
  peer?: PrivateConversation
  peerId: string
  messages: PrivateMessage[]
  currentUserId?: string
  loading: boolean
}) {
  if (loading && msgs.length === 0) {
    return <div className="text-center text-slate-400 text-xs py-8">加载中...</div>
  }
  if (!peerId) {
    return <div className="text-center text-slate-400 text-xs py-8">未选择好友</div>
  }
  if (msgs.length === 0) {
    return (
      <div className="text-center text-slate-400 text-xs py-10 px-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 flex items-center justify-center text-2xl">
          {peer?.peerAvatar || '🌱'}
        </div>
        <p className="text-sm text-slate-600 font-medium">{peer?.peerName || '好友'}</p>
        <p className="mt-2">还没有消息，发送第一句问候吧~</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {msgs.map((m) => {
        const isMe = m.fromUserId === currentUserId
        return (
          <div key={m.id} className={classNames('flex gap-2 text-sm slide-up', isMe ? 'flex-row-reverse' : '')}>
            <div className={classNames(
              'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm',
              isMe ? 'bg-garden-500 text-white' : 'bg-violet-200',
            )}>
              {isMe
                ? (peer?.peerName?.[0] ?? '我')
                : (peer?.peerAvatar?.[0] ?? peer?.peerName?.[0] ?? '?')}
            </div>
            <div className={classNames('max-w-[75%]', isMe ? 'items-end' : '')}>
              <div className={classNames(
                'text-[11px] text-slate-400 mb-0.5 flex items-center gap-1',
                isMe ? 'justify-end flex-row-reverse' : '',
              )}>
                <span>{isMe ? '我' : (peer?.peerName || '对方')}</span>
                <span>· {formatChatTime(m.createdAt)}</span>
                {isMe && m.readAt && <Check size={11} className="text-garden-500" />}
              </div>
              <div className={classNames(
                'px-3 py-1.5 rounded-2xl break-words',
                isMe
                  ? 'bg-garden-500 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm',
              )}>
                {m.content}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
