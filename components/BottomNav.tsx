'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingBag, ClipboardList, Backpack, User, Beaker } from 'lucide-react'
import { classNames } from '@/lib/utils'

const navItems = [
  { href: '/garden', label: '花园', icon: Home },
  { href: '/market', label: '市场', icon: ShoppingBag },
  { href: '/workshop', label: '工坊', icon: Beaker },
  { href: '/tasks', label: '任务', icon: ClipboardList },
  { href: '/inventory', label: '背包', icon: Backpack },
  { href: '/profile', label: '我的', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-garden-100 shadow-[0_-4px_20px_-4px_rgba(34,197,94,0.15)]">
      <div className="max-w-2xl mx-auto px-1">
        <div className="grid grid-cols-6 gap-0.5 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  'flex flex-col items-center justify-center py-1.5 rounded-xl transition-all',
                  active
                    ? 'text-garden-600 bg-garden-50 scale-105'
                    : 'text-slate-500 hover:text-garden-500 hover:bg-garden-50/50'
                )}
              >
                <Icon
                  size={20}
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
  )
}
