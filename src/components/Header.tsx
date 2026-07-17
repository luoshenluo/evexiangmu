import { useState, useEffect } from 'react';
import { Settings, Users } from 'lucide-react';
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
      } catch { /* ignore */ }
    };
    fetchOnline();
    const timer = setInterval(fetchOnline, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#3A3A3A] bg-[#1E1E1E]/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="w-20 flex items-center gap-1.5">
          {onlineCount > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-[#22C55E]/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[11px] font-medium text-[#22C55E] tabular-nums">{onlineCount}</span>
              <Users className="h-3 w-3 text-[#22C55E]" />
            </div>
          )}
        </div>
        <h1 className="text-base font-semibold text-white tracking-wide">
          EVE 造船成本计算器
        </h1>
        <button
          onClick={() => navigate('/admin')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#666666] transition-colors hover:text-[#A78BFA]"
          aria-label="管理后台"
          title="管理后台"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}