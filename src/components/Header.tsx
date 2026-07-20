import { useState, useEffect, useRef } from 'react';
import { Settings, Users, Calculator, Ship, Gem, Rocket, Boxes, Store, Trophy, Building2, LogIn, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getOnlineCount } from '@/lib/admin-projects';
import { getCurrentUser, clearCurrentUser } from '@/lib/user-service';
import type { TabKey } from '@/components/BottomTabBar';
import { cn } from '@/lib/utils';

const DESKTOP_TABS: { key: TabKey; label: string; Icon: typeof Calculator }[] = [
  { key: 'calc', label: '成本计算', Icon: Calculator },
  { key: 'project', label: '制造项目', Icon: Ship },
  { key: 'minerals', label: '矿物', Icon: Gem },
  { key: 'ship', label: '船材', Icon: Rocket },
  { key: 'build', label: '建材', Icon: Boxes },
  { key: 'market', label: '市场', Icon: Store },
  { key: 'skills', label: '技能', Icon: Trophy },
  { key: 'corp', label: '军团', Icon: Building2 },
];

interface HeaderProps {
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const navigate = useNavigate();
  const [onlineCount, setOnlineCount] = useState(0);
  const [user, setUser] = useState(getCurrentUser());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // 监听 sessionStorage 变化（支持多 Tab 同步）
  useEffect(() => {
    const handleStorageChange = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener('storage', handleStorageChange);
    // 自定义事件，用于同页面内登录/退出后同步
    window.addEventListener('user-login-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-login-changed', handleStorageChange);
    };
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearCurrentUser();
    setUser(null);
    setDropdownOpen(false);
    window.dispatchEvent(new Event('user-login-changed'));
  };

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

          {/* 用户头像 / 登录按钮 */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 rounded-full bg-[#7C3AED]/20 px-2.5 py-1.5 transition-colors hover:bg-[#7C3AED]/30"
                aria-label="用户菜单"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C3AED] text-[11px] font-bold text-white">
                  {user.username.slice(0, 2)}
                </div>
                <ChevronDown className={`h-3 w-3 text-[#A78BFA] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-36 overflow-hidden rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] shadow-xl">
                  <div className="border-b border-[#3A3A3A] px-3 py-2">
                    <p className="text-xs font-medium text-white truncate">{user.username}</p>
                    <p className="text-[10px] text-[#666666]">已登录</p>
                  </div>
                  <button
                    onClick={() => { navigate('/user/profile'); setDropdownOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#A0A0A0] transition-colors hover:bg-[#3A3A3A] hover:text-white"
                  >
                    <Users className="h-3.5 w-3.5" />
                    个人中心
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-[#3A3A3A]"
                  >
                    <LogIn className="h-3.5 w-3.5 rotate-180" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/user/login')}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7C3AED]/15 px-3 text-xs font-medium text-[#A78BFA] transition-colors hover:bg-[#7C3AED]/25"
            >
              <LogIn className="h-3.5 w-3.5" />
              登录
            </button>
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