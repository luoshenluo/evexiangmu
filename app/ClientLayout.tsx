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

  // 刷新公开数据（游戏状态 / 公告），供初始化与恢复在线时复用
  const refreshData = useCallback(async () => {
    try {
      const gsRes = await apiFetch('/api/game/state')
      if (gsRes.success && gsRes.data) setGameState(gsRes.data)
      const annRes = await apiFetch('/api/announcements')
      if (annRes.success && annRes.data) setAnnouncements(annRes.data)
      // 同步用户设置到 store
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

  // 应用主题到 DOM：dataset.theme + dark class（全局 CSS 监听 html[data-theme]）
  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    html.dataset.theme = theme || 'garden'
    if (theme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
  }, [theme])

  // 启动时立即从 Zustand 持久化中应用一次主题（避免 SSR 后默认绿）
  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    // store 的初始值（可能来自 user 或持久化）
    const state = useAppStore.getState()
    const initialTheme = state.theme || (state.user?.theme as any) || 'garden'
    const initialBg = state.gardenBg || (state.user?.gardenBg as any) || 'default'
    html.dataset.theme = initialTheme
    if (initialTheme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
    if (!state.theme) setTheme(initialTheme)
    if (!state.gardenBg) setGardenBg(initialBg)
  }, [setTheme, setGardenBg])

  // 初始化游戏状态 + 定时轮询（离线时暂停，节省资源）
  useEffect(() => {
    refreshData()
    const interval = setInterval(() => {
      if (useAppStore.getState().isOffline) return
      refreshData()
    }, 30000)
    return () => clearInterval(interval)
  }, [refreshData])

  // 欢迎遮罩：只有 Zustand 完成 hydrate 后再判断
  // 未登录、非游客、且登录弹窗未打开时显示
  useEffect(() => {
    if (!hasHydrated) { setShowWelcome(false); return }
    setShowWelcome(!isAuthenticated && !isGuest && !showLogin)
  }, [isAuthenticated, isGuest, showLogin, hasHydrated])

  // 全局活跃监听（mousemove/click/keydown/touchstart），节流 5 秒更新一次 lastActiveAt
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
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity))
    }
  }, [setLastActiveAt])

  // 离线检测：每 30 秒检查无操作是否超过 5 分钟
  useEffect(() => {
    const interval = setInterval(() => {
      const { lastActiveAt, isOffline } = useAppStore.getState()
      if (!isOffline && Date.now() - lastActiveAt > 5 * 60 * 1000) {
        setOffline(true)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [setOffline])

  // 恢复在线：关闭离线遮罩 + 更新活跃时间 + 触发一次数据刷新
  const handleResume = useCallback(() => {
    setOffline(false)
    setLastActiveAt()
    refreshData()
  }, [setOffline, setLastActiveAt, refreshData])

  // 已登录或游客都显示底部导航和聊天；离线时隐藏
  const showChrome = !isOffline && (isAuthenticated || isGuest)

  return (
    <div className="relative min-h-screen md:pl-20 lg:pl-56">
      {children}
      {showChrome && <BottomNav />}
      {showChrome && <ChatWidget onRequestLogin={() => setShowLogin(true)} />}
      <Toast />

      {/* 欢迎遮罩：未登录且非游客 */}
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
              <button
                onClick={() => enterGuest()}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                <User size={18} />
                游客模式（仅浏览）
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
              >
                <LogIn size={18} />
                登录 / 注册
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              游客可浏览花园、市场、排行榜和世界聊天（只读）
            </p>
          </div>
        </div>
      )}

      {/* 离线遮罩：点击恢复 */}
      {isOffline && (
        <div
          onClick={handleResume}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
        >
          <div className="text-center text-white select-none">
            <div className="text-6xl mb-4">🌙</div>
            <div className="text-lg font-bold">你已离线</div>
            <div className="text-sm opacity-80 mt-1">点击屏幕恢复</div>
          </div>
        </div>
      )}

      {/* 登录弹窗 */}
      {showLogin && !isAuthenticated && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
          onGuestEnter={() => { enterGuest(); setShowLogin(false) }}
        />
      )}
    </div>
  )
}
