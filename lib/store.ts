'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, InventoryItem, Plot, ChatMessage, Notification, GameState as GameStateType } from '@/lib/types'
import type { Announcement } from '@/lib/types'

interface AppState {
  // 用户
  user: User | null
  token: string | null
  isAuthenticated: boolean
  // 聊天
  messages: Record<string, ChatMessage[]>
  lastMessageTimes: Record<string, number[]>
  // 游戏状态
  gameState: GameStateType | null
  // 通知
  notifications: Notification[]
  // 公告
  announcements: Announcement[]
  // UI
  chatExpanded: boolean
  currentChatChannel: 'world' | 'family' | 'friend'
  toast: { message: string; type: 'success' | 'error' | 'info' } | null

  // Actions
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (data: Partial<User>) => void
  setMessages: (channel: string, msgs: ChatMessage[]) => void
  addMessage: (channel: string, msg: ChatMessage) => void
  recordMessageTime: (userId: string) => boolean
  setGameState: (gs: GameStateType) => void
  setAnnouncements: (a: Announcement[]) => void
  setNotifications: (n: Notification[]) => void
  markNotificationRead: (id: string) => void
  setChatExpanded: (e: boolean) => void
  setCurrentChatChannel: (c: 'world' | 'family' | 'friend') => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  hideToast: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      messages: {},
      lastMessageTimes: {},
      gameState: null,
      notifications: [],
      announcements: [],
      chatExpanded: false,
      currentChatChannel: 'world',
      toast: null,

      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, messages: {}, lastMessageTimes: {} }),
      updateUser: (data) => {
        const u = get().user
        if (u) set({ user: { ...u, ...data } })
      },
      setMessages: (channel, msgs) => {
        set(state => ({ messages: { ...state.messages, [channel]: msgs } }))
      },
      addMessage: (channel, msg) => {
        set(state => {
          const existing = state.messages[channel] || []
          return { messages: { ...state.messages, [channel]: [...existing.slice(-200), msg] } }
        })
      },
      recordMessageTime: (userId) => {
        const now = Date.now()
        const times = (get().lastMessageTimes[userId] || []).filter(t => now - t < 60000)
        if (times.length >= 5) return false
        times.push(now)
        set(state => ({ lastMessageTimes: { ...state.lastMessageTimes, [userId]: times } }))
        return true
      },
      setGameState: (gs) => set({ gameState: gs }),
      setAnnouncements: (a) => set({ announcements: a }),
      setNotifications: (n) => set({ notifications: n }),
      markNotificationRead: (id) => {
        set(state => ({
          notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
        }))
      },
      setChatExpanded: (e) => set({ chatExpanded: e }),
      setCurrentChatChannel: (c) => set({ currentChatChannel: c }),
      showToast: (message, type = 'info') => {
        set({ toast: { message, type } })
        setTimeout(() => set({ toast: null }), 2500)
      },
      hideToast: () => set({ toast: null }),
    }),
    {
      name: 'garden-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    }
  )
)
