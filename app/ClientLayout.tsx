'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import BottomNav from '@/components/BottomNav'
import ChatWidget from '@/components/ChatWidget'
import Toast from '@/components/Toast'
import { useAppStore } from '@/lib/store'
import { apiFetch, formatDateTime } from '@/lib/utils'
import LoginModal from '@/components/LoginModal'
import { Sprout, Leaf, User, LogIn, X, Bell } from 'lucide-react'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const {
    isAuthenticated, isGuest, isOffline,
    setGameState, setAnnouncements,
    enterGuest, setLastActiveAt, setOffline,
    theme, gardenBg, setTheme, setGardenBg,
    announcements,
  } = useAppStore()
  const hasHydrated = useAppStore(s => s._hasHydrated)
  const [showLogin, setShowLogin] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [showAllAnn, setShowAllAnn] = useState(false)
  const lastActivityLogRef = useRef(0)
  const lastHeartbeatRef = useRef(0)

  // ====== 心跳上报：每 30 秒上报一次用户活跃到 DB，供管理员后台统计"最近 5 分钟在线用户"
  const sendHeartbeat = useCallback(async () => {
    try {
      if (!useAppStore.getState().isAuthenticated) return
      if (useAppStore.getState().isOffline) return
      await apiFetch('/api/user/heartbeat', { method: 'POST' })
    } catch {}
  }, [])

  // 初始化 + 定时：30s 一次心跳
  useEffect(() => {
    if (isAuthenticated) {
      // 登录后立即发一次
      sendHeartbeat()
      lastHeartbeatRef.current = Date.now()
    }
    const t = setInterval(() => {
      const now = Date.now()
      if (!isAuthenticated) return
      // 前台 5 分钟无操作视作离线，就不心跳了
      const { lastActiveAt, isOffline } = useAppStore.getState()
      if (isOffline || now - lastActiveAt > 5 * 60 * 1000) return
      if (now - lastHeartbeatRef.current >= 25 * 1000) {
        lastHeartbeatRef.current = now
        sendHeartbeat()
      }
    }, 30000)
    return () => clearInterval(t)
  }, [isAuthenticated, sendHeartbeat])

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

  // 公告弹窗：登录后若存在紧急/重要公告，自动弹出一次（当次会话只弹一次）
  const triggerAnn = announcements.find(a => a.priority === 'urgent' || a.priority === 'important') || null
  useEffect(() => {
    if (!isAuthenticated || !triggerAnn) return
    try {
      if (sessionStorage.getItem('garden-ann-shown')) return
      sessionStorage.setItem('garden-ann-shown', '1')
      setShowAllAnn(false)
      setShowAnnModal(true)
    } catch {}
  }, [isAuthenticated, triggerAnn])

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
    <div className="relative min-h-screen">
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

      {/* 公告弹窗：登录后自动弹出（展示最新紧急/重要公告，可展开全部） */}
      {showAnnModal && triggerAnn && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setShowAnnModal(false); setShowAllAnn(false) }}
        >
          <div className="card w-full max-w-md p-5 slide-up max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Bell size={18} className="text-garden-500" /> 公告
              </h2>
              <button onClick={() => { setShowAnnModal(false); setShowAllAnn(false) }} className="p-2 hover:bg-slate-100 rounded-xl" aria-label="关闭公告">
                <X size={18} />
              </button>
            </div>

            {!showAllAnn ? (
              <div>
                <div className={`p-4 rounded-xl ${
                  triggerAnn.priority === 'urgent' ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-bold text-slate-800">{triggerAnn.title}</span>
                    <span className={`chip text-[10px] ${triggerAnn.priority === 'urgent' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {triggerAnn.priority === 'urgent' ? '紧急' : '重要'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{triggerAnn.content}</p>
                  <div className="text-[11px] text-slate-400 mt-2">{formatDateTime(triggerAnn.createdAt)}</div>
                </div>
                {announcements.length > 1 && (
                  <button onClick={() => setShowAllAnn(true)} className="btn-secondary w-full py-2 mt-3 text-sm">
                    查看全部公告（{announcements.length}）
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {announcements.map(a => (
                  <div key={a.id} className={`p-4 rounded-xl ${
                    a.priority === 'urgent' ? 'bg-amber-50 border border-amber-200' :
                      a.priority === 'important' ? 'bg-blue-50 border border-blue-200' :
                        'bg-slate-50 border border-slate-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-bold text-slate-800">{a.title}</span>
                      <span className={`chip text-[10px] ${
                        a.priority === 'urgent' ? 'bg-amber-100 text-amber-700' :
                          a.priority === 'important' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {a.priority === 'urgent' ? '紧急' : a.priority === 'important' ? '重要' : '普通'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.content}</p>
                    <div className="text-[11px] text-slate-400 mt-2">{formatDateTime(a.createdAt)}</div>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">暂无公告</div>
                )}
              </div>
            )}
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
