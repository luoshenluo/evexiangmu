'use client'

import BottomNav from '@/components/BottomNav'
import WelcomeHero from '@/components/WelcomeHero'
import ChatWidget from '@/components/ChatWidget'
import LoginModal from '@/components/LoginModal'
import { useAppStore } from '@/lib/store'
import { useEffect } from 'react'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isGuest, hydrateFromStorage, checkAdmin, showLogin, setShowLogin } = useAppStore()

  useEffect(() => {
    hydrateFromStorage()
    checkAdmin()
  }, [hydrateFromStorage, checkAdmin])

  return (
    <div className="relative min-h-screen">
      {children}

      {!user && !isGuest && (
        <WelcomeHero
          onClose={() => {}}
          onLoginClick={() => setShowLogin(true)}
          onGuestClick={() => useAppStore.getState().enterGuest()}
        />
      )}

      {showLogin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLogin(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />
          </div>
        </div>
      )}

      {user && !isGuest && <ChatWidget />}

      <BottomNav />
    </div>
  )
}
