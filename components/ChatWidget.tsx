'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, ChevronDown, Globe, Users, UserPlus } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatDateTime } from '@/lib/utils'
import { filterSensitiveWords } from '@/lib/game-data'
import type { ChatChannel, ChatMessage } from '@/lib/types'

const channels: { key: ChatChannel; label: string; icon: any }[] = [
  { key: 'world', label: '世界', icon: Globe },
  { key: 'family', label: '家族', icon: Users },
  { key: 'friend', label: '好友', icon: UserPlus },
]

interface Props {
  onRequestLogin?: () => void
}

export default function ChatWidget({ onRequestLogin }: Props) {
  const {
    user, chatExpanded, currentChatChannel, messages,
    setChatExpanded, setCurrentChatChannel, setMessages, addMessage,
    recordMessageTime, showToast,
    isGuest, isOffline,
  } = useAppStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 加载消息（离线时跳过；恢复在线时会因 isOffline 变化重新触发，实现刷新）
  useEffect(() => {
    if (isOffline) return
    const load = async () => {
      const res = await apiFetch(`/api/chat/${currentChatChannel}`)
      if (res.success && res.data) {
        setMessages(currentChatChannel, res.data)
      }
    }
    load()
  }, [currentChatChannel, isOffline])

  // 轮询新消息（离线时暂停，节省资源）
  useEffect(() => {
    if (isOffline) return
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
  }, [currentChatChannel, messages, isOffline])

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentChatChannel, chatExpanded])

  const sendMessage = async () => {
    if (!input.trim() || !user) return

    // 禁言检查
    if (user.mutedUntil && user.mutedUntil > Date.now()) {
      const mins = Math.ceil((user.mutedUntil - Date.now()) / 60000)
      showToast(`你已被禁言，还有 ${mins} 分钟解除`, 'error')
      return
    }

    // 频率检查
    if (!recordMessageTime(user.id)) {
      showToast('发言过于频繁，每分钟最多 5 条', 'error')
      return
    }

    // 敏感词过滤
    const content = filterSensitiveWords(input.trim())

    setLoading(true)
    try {
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

  // 折叠状态
  if (!chatExpanded) {
    return (
      <button
        onClick={() => setChatExpanded(true)}
        className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-garden-500 to-garden-600 text-white shadow-xl shadow-garden-300/50 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 md:bottom-6"
      >
        <MessageCircle size={24} />
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] flex items-center justify-center font-bold">
          新
        </span>
      </button>
    )
  }

  const currentMessages = (messages[currentChatChannel] || []) as ChatMessage[]
  const nowStr = formatDateTime(Date.now()).slice(0, 16)

  return (
    <div className="fixed bottom-24 right-4 z-30 w-[92vw] max-w-sm h-[420px] max-h-[60vh] card slide-up overflow-hidden flex flex-col shadow-2xl md:bottom-6 md:w-96 md:h-[500px] md:max-h-[70vh]">
      {/* Header */}
      <div className="bg-gradient-to-r from-garden-500 to-garden-600 px-3 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-white" />
          <span className="text-white font-semibold text-sm">聊天</span>
          <span className="text-garden-100 text-xs ml-2">{nowStr}</span>
        </div>
        <button
          onClick={() => setChatExpanded(false)}
          className="p-1 rounded hover:bg-white/20 text-white transition-colors"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Channel Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        {channels.map((ch) => {
          const Icon = ch.icon
          const active = ch.key === currentChatChannel
          return (
            <button
              key={ch.key}
              onClick={() => setCurrentChatChannel(ch.key)}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors border-b-2',
                active
                  ? 'border-garden-500 text-garden-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon size={14} />
              {ch.label}
            </button>
          )
        })}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin bg-gradient-to-b from-slate-50/30 to-white"
      >
        {currentMessages.length === 0 ? (
          <div className="text-center text-slate-400 text-xs py-8">
            暂无消息，快来发言吧~
          </div>
        ) : (
          currentMessages.map((msg) => (
            <div key={msg.id} className={classNames('text-sm slide-up', msg.isSystem && 'text-center')}>
              {msg.isSystem ? (
                <div className="chip bg-amber-50 text-amber-700 mx-auto text-[11px] my-1">
                  {msg.content}
                </div>
              ) : (
                <div className={classNames(
                  'flex gap-2',
                  msg.userId === user?.id ? 'flex-row-reverse' : ''
                )}>
                  <div className={classNames(
                    'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm',
                    msg.userId === user?.id ? 'bg-garden-500 text-white' : 'bg-slate-200'
                  )}>
                    {msg.userName[0] || '?'}
                  </div>
                  <div className={classNames(
                    'max-w-[75%]',
                    msg.userId === user?.id ? 'items-end' : ''
                  )}>
                    <div className={classNames(
                      'text-[11px] text-slate-400 mb-0.5',
                      msg.userId === user?.id ? 'text-right' : ''
                    )}>
                      {msg.userName} · {formatDateTime(msg.timestamp).slice(11, 16)}
                    </div>
                    <div className={classNames(
                      'px-3 py-1.5 rounded-2xl break-words',
                      msg.userId === user?.id
                        ? 'bg-garden-500 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                    )}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input / 游客提示 / 离线提示 */}
      <div className="border-t border-slate-100 p-2 flex gap-2 flex-shrink-0 bg-white">
        {isOffline ? (
          <div className="flex-1 py-2 text-center text-xs text-slate-400">
            🌙 已离线
          </div>
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
        ) : (
          <>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="说点什么..."
              className="flex-1 px-3 py-2 text-sm bg-slate-50 rounded-lg border border-slate-200 focus:border-garden-400 focus:ring-1 focus:ring-garden-200 outline-none"
              maxLength={200}
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
