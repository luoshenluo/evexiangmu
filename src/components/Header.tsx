import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#3A3A3A] bg-[#1E1E1E]/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="hidden md:flex md:items-center md:gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-[10px] font-bold text-white">E</div>
          <span className="text-xs text-[#666666]">EVE Tools</span>
        </div>
        <div className="md:hidden w-8" />
        <h1 className="text-base md:text-lg font-semibold text-white tracking-wide">EVE 造船成本计算器</h1>
        <button onClick={() => navigate('/admin')} className="flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-md text-[#666666] transition-colors hover:text-[#A78BFA]" aria-label="管理后台" title="管理后台">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}