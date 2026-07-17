import { useEffect, useState, useCallback } from 'react';
import { Gem, Ship, Factory, Download, Loader2 } from 'lucide-react';
import { loadMarketData, type MarketDataItem } from '@/lib/admin-projects';
import { toast } from 'sonner';

const CATEGORIES = [
  {
    key: 'minerals' as const,
    label: '矿物',
    sublabel: '8 项基础矿物',
    icon: Gem,
    color: '#22d3ee',
  },
  {
    key: 'ship_materials' as const,
    label: '船材',
    sublabel: '17 项舰船材料',
    icon: Ship,
    color: '#a78bfa',
  },
  {
    key: 'build_materials' as const,
    label: '建材',
    sublabel: '11 项建筑材料',
    icon: Factory,
    color: '#fbbf24',
  },
];

type CategoryKey = (typeof CATEGORIES)[number]['key'];

interface MarketPageProps {
  onImport?: (category: CategoryKey, items: MarketDataItem[]) => void;
}

export default function MarketPage({ onImport }: MarketPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('minerals');
  const [items, setItems] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async (type: CategoryKey) => {
    setLoading(true);
    try {
      const data = await loadMarketData(type);
      setItems(data);
    } catch (err) {
      console.error('Failed to load market data:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems(selectedCategory);
  }, [selectedCategory, loadItems]);

  const handleImport = () => {
    const validItems = items.filter((item) => (item.sell_price || 0) > 0);
    if (validItems.length === 0) {
      toast.info('当前分类没有可导入的市场价格');
      return;
    }
    if (onImport) {
      onImport(selectedCategory, validItems);
    }
  };

  const currentCategory = CATEGORIES.find((c) => c.key === selectedCategory) || CATEGORIES[0];
  const CatIcon = currentCategory.icon;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">市场数据</h2>
            <p className="text-sm text-[#888] mt-1">查看市场出售与收购信息（仅后台可编辑）</p>
          </div>
          <button
            onClick={handleImport}
            disabled={loading || items.length === 0}
            className="flex items-center gap-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white px-4 py-2.5 text-sm font-medium shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            导入单价
          </button>
        </div>

        {/* 分类切换卡片 */}
        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = cat.key === selectedCategory;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`relative rounded-2xl border p-4 text-left transition-all duration-300 ${
                  isActive ? 'shadow-lg scale-[1.02]' : 'hover:scale-[1.01]'
                }`}
                style={{
                  background: isActive ? `linear-gradient(135deg, ${cat.color}15, transparent)` : 'rgba(26,26,26,0.8)',
                  borderColor: isActive ? `${cat.color}60` : '#2C2C2C',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: isActive ? `${cat.color}20` : 'rgba(44,44,44,0.8)',
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: isActive ? cat.color : '#666' }} />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-[#A0A0A0]'}`}>
                      {cat.label}
                    </div>
                    <div className="text-[11px] text-[#666] mt-0.5">{cat.sublabel}</div>
                  </div>
                </div>
                {isActive && (
                  <div
                    className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* 数据展示 */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#666] gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#666]">
            <CatIcon className="h-10 w-10 opacity-30" />
            <span className="mt-2 text-sm">暂无市场数据</span>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#2C2C2C] bg-[#1a1a1a]/80 backdrop-blur-sm p-4"
              >
                {/* 材料名称 */}
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#2C2C2C]/60">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${currentCategory.color}15` }}
                  >
                    <CatIcon className="h-4 w-4" style={{ color: currentCategory.color }} />
                  </div>
                  <span className="text-sm font-semibold text-white">{item.name}</span>
                </div>

                {/* 两栏布局: 出售 + 收购 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 市场出售 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-400" />
                      <span className="text-xs font-medium text-green-400">市场出售</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">价格(ISK)</label>
                        <input
                          type="text"
                          value={item.sell_price || ''}
                          readOnly
                          placeholder="0"
                          className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-2 text-sm text-green-400 text-center cursor-not-allowed opacity-70 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">数量</label>
                        <input
                          type="text"
                          value={item.sell_quantity || ''}
                          readOnly
                          placeholder="0"
                          className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-2 text-sm text-white text-center cursor-not-allowed opacity-70 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">地点</label>
                        <input
                          type="text"
                          value={item.sell_location || ''}
                          readOnly
                          placeholder="-"
                          className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-2 text-sm text-white text-center cursor-not-allowed opacity-70 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 收购订单 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-400" />
                      <span className="text-xs font-medium text-blue-400">收购订单</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">价格(ISK)</label>
                        <input
                          type="text"
                          value={item.buy_price || ''}
                          readOnly
                          placeholder="0"
                          className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-2 text-sm text-blue-400 text-center cursor-not-allowed opacity-70 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">数量</label>
                        <input
                          type="text"
                          value={item.buy_quantity || ''}
                          readOnly
                          placeholder="0"
                          className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-2 text-sm text-white text-center cursor-not-allowed opacity-70 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">地点</label>
                        <input
                          type="text"
                          value={item.buy_location || ''}
                          readOnly
                          placeholder="-"
                          className="h-9 w-full rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-2 text-sm text-white text-center cursor-not-allowed opacity-70 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 底部提示 */}
        <div className="flex items-center justify-center gap-6 text-xs text-[#555] pt-2">
          <span className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
            绿色 = 出售价格
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            蓝色 = 收购价格
          </span>
        </div>
      </div>
    </div>
  );
}