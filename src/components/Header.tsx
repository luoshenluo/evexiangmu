import { useState, useEffect } from 'react';
import { Settings, Users, Calculator, Ship, Gem, Rocket, Boxes, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getOnlineCount } from '@/lib/admin-projects';
import type { TabKey } from '@/components/BottomTabBar';
import { cn } from '@/lib/utils';

const DESKTOP_TABS: { key: TabKey; label: string; Icon: typeof Calculator }[] = [
  { key: 'calc', label: '成本计算', Icon: Calculator },
  { key: 'project', label: '制造项目', Icon: Ship },
  { key: 'minerals', label: '矿物', Icon: Gem },
  { key: 'ship', label: '船材', Icon: Rocket },
  { key: 'build', label: '建材', Icon: Boxes },
  { key: 'market', label: '市场', Icon: Store },
];

interface HeaderProps {
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const navigate = useNavigate();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const count = await getOnlineCount();
        setOnlineCount(count);
      } catch { /* ignore */ }
    };
    fetchOnline();
    const timer = setInterval(fetchOnline, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#3A3A3A] bg-[#1E1E1E]/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4">
        {activeTab !== undefined && onTabChange ? (
          <nav className="hidden md:flex items-center gap-1">
            {DESKTOP_TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTab === key
                    ? 'bg-[#7C3AED]/15 text-[#A78BFA]'
                    : 'text-[#A0A0A0] hover:bg-[#3A3A3A]/50 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </nav>
        ) : (
          <div className="w-20" />
        )}
        <h1 className="text-base font-semibold text-white tracking-wide md:hidden">EVE 造船成本计算器</h1>
        <div className="flex items-center gap-2">
          {onlineCount > 0 && (
            <div className="hidden sm:flex items-center gap-1 rounded-full bg-[#22C55E]/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[11px] font-medium text-[#22C55E] tabular-nums">{onlineCount}</span>
              <Users className="h-3.5 w-3.5 text-[#22C55E]" />
            </div>
          )}
          {onlineCount > 0 && (
            <div className="flex sm:hidden items-center gap-0.5 rounded-full bg-[#22C55E]/10 px-1.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[10px] font-medium text-[#22C55E] tabular-nums">{onlineCount}</span>
            </div>
          )}
          <button
            onClick={() => navigate('/admin')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#666666] transition-colors hover:text-[#A78BFA]"
            aria-label="管理后台"
            title="管理后台"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
