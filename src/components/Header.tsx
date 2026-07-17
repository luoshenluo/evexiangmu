import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getOnlineCount } from '@/lib/admin-projects';

export default function Header() {
  const navigate = useNavigate();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const count = await getOnlineCount();
        setOnlineCount(count);
      } catch {}
    };
    fetchOnline();
    const timer = setInterval(fetchOnline, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#3A3A3A] bg-[#1E1E1E]/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4">
        {/* 桌面端 在线人数 */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-[#3A3A3A] bg-[#2C2C2C] px-2.5 py-1">
            <div className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-xs text-[#A0A0A0]">
              在线 <span className="font-medium text-[#22C55E]">{onlineCount}</span>
            </span>
          </div>
        </div>
        {/* 移动端占位 */}
        <div className="md:hidden w-8" />
        <h1 className="text-base md:text-lg font-semibold text-white tracking-wide">
          EVE 造船成本计算器
        </h1>
        <button
          onClick={() => navigate('/admin')}
          className="flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-md text-[#666666] transition-colors hover:text-[#A78BFA]"
          aria-label="管理后台"
          title="管理后台"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
