import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadMarketData, type MarketDataItem } from '@/lib/admin-projects';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

const CATEGORIES = [
  {
    key: 'minerals',
    label: '矿物',
    sublabel: '8 项基础矿物',
    icon: 'fa-gem',
    color: '#22d3ee',
    border: 'border-cyan-500/20',
    activeBorder: 'border-cyan-400/50',
    shadow: 'shadow-cyan-500/10',
  },
  {
    key: 'ship_materials',
    label: '船材',
    sublabel: '17 项舰船材料',
    icon: 'fa-ship',
    color: '#a78bfa',
    border: 'border-violet-500/20',
    activeBorder: 'border-violet-400/50',
    shadow: 'shadow-violet-500/10',
  },
  {
    key: 'build_materials',
    label: '建材',
    sublabel: '11 项建筑材料',
    icon: 'fa-building',
    color: '#fbbf24',
    border: 'border-amber-500/20',
    activeBorder: 'border-amber-400/50',
    shadow: 'shadow-amber-500/10',
  },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

interface MarketPageProps {
  onImport?: (category: CategoryKey, items: MarketDataItem[]) => void;
}

export default function MarketPage({ onImport }: MarketPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('minerals');
  const [items, setItems] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems(selectedCategory);
  }, [selectedCategory]);

  const loadItems = async (category: CategoryKey) => {
    setLoading(true);
    try {
      const data = await loadMarketData(category);
      setItems(data);
    } catch (err) {
      console.error('Failed to load market data:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    // 只导入有数据的项（sell_price > 0 或 sell_quantity > 0）
    const validItems = items.filter((item) => (item.sell_price || 0) > 0);
    if (validItems.length === 0) {
      toast.info('当前分类没有可导入的市场价格');
      return;
    }
    if (onImport) {
      onImport(selectedCategory, validItems);
    }
  };

  const currentCategory = CATEGORIES.find((c) => c.key === selectedCategory)!;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">市场数据</h2>
            <p className="text-sm text-[#888] mt-1">查看市场出售与收购信息（仅后台可编辑）</p>
          </div>
          <Button
            onClick={handleImport}
            disabled={loading || items.length === 0}
            className="gap-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg shadow-purple-500/20 transition-all"
          >
            <Download className="h-4 w-4" />
            导入到录入
          </Button>
        </div>

        {/* 分类切换卡片 - Figma风格 */}
        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`relative rounded-2xl border p-4 text-left transition-all duration-300 ${
                selectedCategory === cat.key
                  ? `${cat.activeBorder} ${cat.shadow} shadow-lg scale-[1.02]`
                  : `${cat.border} hover:scale-[1.01]`
              }`}
              style={{
                background: selectedCategory === cat.key
                  ? `linear-gradient(135deg, ${cat.color}15, transparent)`
                  : 'rgba(26,26,26,0.8)',
                borderColor: selectedCategory === cat.key ? `${cat.color}60` : undefined,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: selectedCategory === cat.key ? `${cat.color}20` : 'rgba(44,44,44,0.8)',
                  }}
                >
                  <i
                    className={`fa-solid ${cat.icon} text-lg`}
                    style={{ color: selectedCategory === cat.key ? cat.color : '#666' }}
                  />
                </div>
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      selectedCategory === cat.key ? 'text-white' : 'text-[#A0A0A0]'
                    }`}
                  >
                    {cat.label}
                  </div>
                  <div className="text-[11px] text-[#666] mt-0.5">{cat.sublabel}</div>
                </div>
              </div>
              {selectedCategory === cat.key && (
                <div
                  className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
              )}
            </button>
          ))}
        </div>

        {/* 数据展示 - Figma风格卡片（只读） */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#666]">
            <i className="fa-solid fa-circle-notch fa-spin mr-2 text-lg" />
            加载中...
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
                    <i
                      className={`fa-solid ${currentCategory.icon} text-sm`}
                      style={{ color: currentCategory.color }}
                    />
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
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">价格(亿)</label>
                        <Input
                          type="number"
                          value={item.sell_price || ''}
                          readOnly
                          placeholder="0"
                          className="h-9 bg-[#0f0f0f] border-[#2a2a2a] text-sm text-green-400 text-center rounded-xl cursor-not-allowed opacity-70"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">数量</label>
                        <Input
                          type="number"
                          value={item.sell_quantity || ''}
                          readOnly
                          placeholder="0"
                          className="h-9 bg-[#0f0f0f] border-[#2a2a2a] text-sm text-white text-center rounded-xl cursor-not-allowed opacity-70"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">地点</label>
                        <Input
                          value={item.sell_location || ''}
                          readOnly
                          placeholder="-"
                          className="h-9 bg-[#0f0f0f] border-[#2a2a2a] text-sm text-white text-center rounded-xl cursor-not-allowed opacity-70"
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
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">价格(亿)</label>
                        <Input
                          type="number"
                          value={item.buy_price || ''}
                          readOnly
                          placeholder="0"
                          className="h-9 bg-[#0f0f0f] border-[#2a2a2a] text-sm text-blue-400 text-center rounded-xl cursor-not-allowed opacity-70"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">数量</label>
                        <Input
                          type="number"
                          value={item.buy_quantity || ''}
                          readOnly
                          placeholder="0"
                          className="h-9 bg-[#0f0f0f] border-[#2a2a2a] text-sm text-white text-center rounded-xl cursor-not-allowed opacity-70"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1.5 font-medium">地点</label>
                        <Input
                          value={item.buy_location || ''}
                          readOnly
                          placeholder="-"
                          className="h-9 bg-[#0f0f0f] border-[#2a2a2a] text-sm text-white text-center rounded-xl cursor-not-allowed opacity-70"
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
