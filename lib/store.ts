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
  _hasHydrated: boolean
  // 游客 / 离线
  isGuest: boolean
  lastActiveAt: number
  isOffline: boolean
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
  theme: string
  gardenBg: string

  // Actions
  login: (user: User, token: string) => void
  logout: () => void
  setHasHydrated: (v: boolean) => void
  enterGuest: () => void
  exitGuest: () => void
  setLastActiveAt: () => void
  setOffline: (v: boolean) => void
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
  setTheme: (t: string) => void
  setGardenBg: (b: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,
      isGuest: false,
      lastActiveAt: Date.now(),
      isOffline: false,
      messages: {},
      lastMessageTimes: {},
      gameState: null,
      notifications: [],
      announcements: [],
      chatExpanded: false,
      currentChatChannel: 'world',
      toast: null,
      theme: 'light',
      gardenBg: 'default',

      login: (user, token) => set({ user, token, isAuthenticated: true, isGuest: false, _hasHydrated: true, theme: (user as any).theme || 'light', gardenBg: (user as any).gardenBg || 'default' }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, isGuest: false, messages: {}, lastMessageTimes: {}, theme: 'light', gardenBg: 'default' }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      // 进入游客模式：不调 API，直接以游客身份浏览
      enterGuest: () => set({ isGuest: true, isAuthenticated: false, user: null, token: null }),
      // 退出游客模式（清空游客状态）
      exitGuest: () => set({ isGuest: false }),
      // 更新最后活跃时间
      setLastActiveAt: () => set({ lastActiveAt: Date.now() }),
      // 设置离线状态
      setOffline: (v) => set({ isOffline: v }),
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
      setTheme: (t) => set({ theme: t }),
      setGardenBg: (b) => set({ gardenBg: b }),
    }),
    {
      name: 'garden-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated, isGuest: s.isGuest }),
      onRehydrateStorage: () => (state, error) => {
        if (state) state._hasHydrated = true
      },
    }
  )
)
