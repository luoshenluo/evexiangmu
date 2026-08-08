'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingBag, ClipboardList, Backpack, Users, User, Beaker } from 'lucide-react'
import { classNames } from '@/lib/utils'

const navItems = [
  { href: '/garden', label: '花园', icon: Home },
  { href: '/market', label: '市场', icon: ShoppingBag },
  { href: '/workshop', label: '工坊', icon: Beaker },
  { href: '/tasks', label: '任务', icon: ClipboardList },
  { href: '/inventory', label: '背包', icon: Backpack },
  { href: '/family', label: '家族', icon: Users },
  { href: '/profile', label: '我的', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <>
      {/* 移动端：底部导航栏 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-garden-100 shadow-[0_-4px_20px_-4px_rgba(34,197,94,0.15)] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="px-1">
          <div className="grid grid-cols-7 gap-0.5 py-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    'flex flex-col items-center justify-center py-2 rounded-xl transition-all min-h-[48px]',
                    active
                      ? 'text-garden-600 bg-garden-50 scale-105'
                      : 'text-slate-500 hover:text-garden-500 hover:bg-garden-50/50'
                  )}
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.5 : 2}
                    className={active ? 'drop-shadow-sm' : ''}
                  />
                  <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* 桌面端：左侧边栏 */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-56 z-30 bg-white/90 backdrop-blur-lg border-r border-garden-100 flex-col py-4 safe-top">
        <div className="px-3 lg:px-5 mb-6 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-garden-400 to-garden-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg">🌷</span>
          </div>
          <span className="hidden lg:block font-bold text-slate-800 text-sm">花园 Garden</span>
        </div>
        <div className="flex-1 flex flex-col gap-1 px-2 lg:px-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                  active
                    ? 'text-garden-600 bg-garden-50 font-medium'
                    : 'text-slate-500 hover:text-garden-500 hover:bg-garden-50/50'
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 2}
                  className="flex-shrink-0"
                />
                <span className="hidden lg:block text-sm">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
