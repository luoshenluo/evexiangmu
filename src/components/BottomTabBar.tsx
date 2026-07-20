import { Calculator, Gem, Rocket, Boxes, Ship, Store, Trophy, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabKey = 'calc' | 'project' | 'minerals' | 'ship' | 'build' | 'market' | 'skills' | 'corp';

interface BottomTabBarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; Icon: typeof Calculator }[] = [
  { key: 'calc', label: '成本计算', Icon: Calculator },
  { key: 'project', label: '制造项目', Icon: Ship },
  { key: 'minerals', label: '矿物录入', Icon: Gem },
  { key: 'ship', label: '船材录入', Icon: Rocket },
  { key: 'build', label: '建材录入', Icon: Boxes },
  { key: 'market', label: '市场', Icon: Store },
  { key: 'skills', label: '技能', Icon: Trophy },
  { key: 'corp', label: '军团', Icon: Building2 },
];

export default function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_-2px_12px_rgba(0_0_0_0.3)] md:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-0.5">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors duration-200',
                isActive ? 'text-[#7C3AED]' : 'text-[#888888] hover:text-[#CCCCCC]',
              )}
            >
              <Icon className={cn('h-4 w-4', isActive && 'drop-shadow-[0_0_6px_rgba(124_58_237_0.5)]')} />
              <span className="text-[9px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}