'use client'

import { useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import ChatWidget from '@/components/ChatWidget'
import Toast from '@/components/Toast'
import { useAppStore } from '@/lib/store'
import { apiFetch } from '@/lib/utils'
import LoginModal from '@/components/LoginModal'
import { useState } from 'react'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setGameState, setAnnouncements } = useAppStore()
  const [showLogin, setShowLogin] = useState(false)

  // 初始化游戏状态
  useEffect(() => {
    const init = async () => {
      try {
        const gsRes = await apiFetch('/api/game/state')
        if (gsRes.success && gsRes.data) setGameState(gsRes.data)

        const annRes = await apiFetch('/api/announcements')
        if (annRes.success && annRes.data) setAnnouncements(annRes.data)
      } catch (e) {}
    }
    init()
    const interval = setInterval(init, 30000)
    return () => clearInterval(interval)
  }, [])

  // 未登录时展示登录弹窗
  useEffect(() => {
    const stored = localStorage.getItem('garden-app-storage')
    let authed = isAuthenticated
    if (!authed && stored) {
      try { authed = JSON.parse(stored).state?.isAuthenticated } catch {}
    }
    if (!authed) setShowLogin(true)
  }, [isAuthenticated])

  return (
    <div className="relative min-h-screen">
      {children}
      {isAuthenticated && <BottomNav />}
      {isAuthenticated && <ChatWidget />}
      <Toast />
      {showLogin && !isAuthenticated && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
    </div>
  )
}
