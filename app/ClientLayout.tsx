'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import BottomNav from '@/components/BottomNav'
import ChatWidget from '@/components/ChatWidget'
import Toast from '@/components/Toast'
import { useAppStore } from '@/lib/store'
import { apiFetch } from '@/lib/utils'
import LoginModal from '@/components/LoginModal'
import { Sprout, Leaf, User, LogIn } from 'lucide-react'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const {
    isAuthenticated, isGuest, isOffline,
    setGameState, setAnnouncements,
    enterGuest, setLastActiveAt, setOffline,
    theme, gardenBg, setTheme, setGardenBg,
  } = useAppStore()
  const hasHydrated = useAppStore(s => s._hasHydrated)
  const [showLogin, setShowLogin] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const lastActivityLogRef = useRef(0)
  const lastHeartbeatRef = useRef(0)

  const sendHeartbeat = useCallback(async () => {
    try {
      if (!useAppStore.getState().isAuthenticated) return
      if (useAppStore.getState().isOffline) return
      await apiFetch('/api/user/heartbeat', { method: 'POST' })
    } catch {}
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      sendHeartbeat()
      lastHeartbeatRef.current = Date.now()
    }
    const t = setInterval(() => {
      const now = Date.now()
      if (!isAuthenticated) return
      const { lastActiveAt, isOffline } = useAppStore.getState()
      if (isOffline || now - lastActiveAt > 5 * 60 * 1000) return
      if (now - lastHeartbeatRef.current >= 25 * 1000) {
        lastHeartbeatRef.current = now
        sendHeartbeat()
      }
    }, 30000)
    return () => clearInterval(t)
  }, [isAuthenticated, sendHeartbeat])

  const refreshData = useCallback(async () => {
    try {
      const gsRes = await apiFetch('/api/game/state')
      if (gsRes.success && gsRes.data) setGameState(gsRes.data)
      const annRes = await apiFetch('/api/announcements')
      if (annRes.success && annRes.data) setAnnouncements(annRes.data)
      if (isAuthenticated) {
        const settingsRes = await apiFetch('/api/user/settings')
        if (settingsRes.success && settingsRes.data) {
          const s = settingsRes.data
          setTheme(s.theme || 'light')
          setGardenBg(s.gardenBg || 'default')
        }
      }
    } catch {}
  }, [setGameState, setAnnouncements, isAuthenticated, setTheme, setGardenBg])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    html.dataset.theme = theme || 'garden'
    if (theme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    const state = useAppStore.getState()
    const initialTheme = state.theme || (state.user?.theme as any) || 'garden'
    const initialBg = state.gardenBg || (state.user?.gardenBg as any) || 'default'
    html.dataset.theme = initialTheme
    if (initialTheme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
    if (!state.theme) setTheme(initialTheme)
    if (!state.gardenBg) setGardenBg(initialBg)
  }, [setTheme, setGardenBg])

  useEffect(() => {
    refreshData()
    const interval = setInterval(() => {
      if (useAppStore.getState().isOffline) return
      refreshData()
    }, 30000)
    return () => clearInterval(interval)
  }, [refreshData])

  useEffect(() => {
    if (!hasHydrated) { setShowWelcome(false); return }
    setShowWelcome(!isAuthenticated && !isGuest && !showLogin)
  }, [isAuthenticated, isGuest, showLogin, hasHydrated])

  useEffect(() => {
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastActivityLogRef.current > 5000) {
        lastActivityLogRef.current = now
        setLastActiveAt()
      }
    }
    const events = ['mousemove', 'click', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, handleActivity))
  }, [setLastActiveAt])

  useEffect(() => {
    const interval = setInterval(() => {
      const { lastActiveAt, isOffline } = useAppStore.getState()
      if (!isOffline && Date.now() - lastActiveAt > 5 * 60 * 1000) setOffline(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [setOffline])

  const handleResume = useCallback(() => {
    setOffline(false)
    setLastActiveAt()
    refreshData()
  }, [setOffline, setLastActiveAt, refreshData])

  const showChrome = !isOffline && (isAuthenticated || isGuest)

  return (
    <div className="relative min-h-screen">
      {children}
      {showChrome && <BottomNav />}
      {showChrome && <ChatWidget onRequestLogin={() => setShowLogin(true)} />}
      <Toast />
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm p-6 text-center slide-up">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-garden-400 to-garden-600 flex items-center justify-center shadow-lg shadow-garden-200">
              <Sprout size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
              <Leaf size={22} className="text-garden-500" />
              花园 Garden
            </h1>
            <p className="text-sm text-slate-500 mt-1 mb-6">种植 · 交易 · 社交 · 成长</p>
            <div className="space-y-2">
              <button onClick={() => enterGuest()} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                <User size={18} /> 游客模式（仅浏览）
              </button>
              <button onClick={() => setShowLogin(true)} className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2">
                <LogIn size={18} /> 登录 / 注册
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">游客可浏览花园、市场、排行榜和世界聊天（只读）</p>
          </div>
        </div>
      )}
      {isOffline && (
        <div onClick={handleResume} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer">
          <div className="text-center text-white select-none">
            <div className="text-6xl mb-4">🌙</div>
            <div className="text-lg font-bold">你已离线</div>
            <div className="text-sm opacity-80 mt-1">点击屏幕恢复</div>
          </div>
        </div>
      )}
      {showLogin && !isAuthenticated && (
        <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} onGuestEnter={() => { enterGuest(); setShowLogin(false) }} />
      )}
    </div>
  )
}
