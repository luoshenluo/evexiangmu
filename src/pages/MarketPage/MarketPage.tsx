import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadMarketData, saveMarketData, type MarketDataItem } from '@/lib/admin-projects';

const CATEGORIES = [
  { key: 'minerals', label: '矿物', icon: 'fa-gem', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { key: 'ship_materials', label: '船材', icon: 'fa-ship', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { key: 'build_materials', label: '建材', icon: 'fa-building', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

export default function MarketPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('minerals');
  const [items, setItems] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<string>('');

  useEffect(() => {
    loadItems(selectedCategory);
  }, [selectedCategory]);

  const loadItems = async (category: CategoryKey) => {
    setLoading(true);
    try {
      const data = await loadMarketData(category);
      // 如果没有数据，初始化空数据
      if (data.length === 0) {
        const emptyItems = getEmptyItems(category);
        setItems(emptyItems);
      } else {
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to load market data:', err);
      setItems(getEmptyItems(category));
    } finally {
      setLoading(false);
    }
  };

  const getEmptyItems = (category: CategoryKey): MarketDataItem[] => {
    const names: Record<CategoryKey, string[]> = {
      minerals: ['三钛合金', '类晶体胶矿', '类银超金属', '同位聚合体', '超新星诺克石', '晶状石英核岩', '超噬矿', '莫尔石'],
      ship_materials: ['光泽合金', '光彩合金', '闪光合金', '浓缩合金', '精密合金', '杂色复合物', '纤维复合物', '透光复合物', '多样复合物', '光滑复合物', '晶体复合物', '黑暗复合物', '基础金属', '重金属', '贵金属', '反应金属', '有毒金属'],
      build_materials: ['活性气体', '稀有气体', '工业纤维', '超张力塑料', '聚芳酰胺', '冷却剂', '凝缩液', '建筑模块', '纳米体', '硅结构铸材', '灵巧单元建筑模块'],
    };
    return names[category].map((name, i) => ({
      id: `${category}_${i}`,
      type: category,
      name,
      sell_price: 0,
      sell_quantity: 0,
      sell_location: '',
      buy_price: 0,
      buy_quantity: 0,
      buy_location: '',
    }));
  };

  const handleUpdate = (id: string, field: keyof MarketDataItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMarketData(items);
      setLastSaveTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to save market data:', err);
    } finally {
      setSaving(false);
    }
  };

  const currentCategory = CATEGORIES.find((c) => c.key === selectedCategory)!;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">市场数据</h2>
          <p className="text-sm text-muted-foreground mt-1">
            查看和编辑矿物、船材、建材的市场出售与收购信息
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSaveTime && (
            <span className="text-xs text-muted-foreground">上次保存: {lastSaveTime}</span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#7C3AED] hover:bg-[#6D28D9]"
          >
            <i className={`fa-solid fa-save mr-2 ${saving ? 'fa-spin' : ''}`} />
            {saving ? '保存中...' : '保存更改'}
          </Button>
        </div>
      </div>

      {/* 分类切换卡片 */}
      <div className="grid grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`relative rounded-xl border p-4 text-left transition-all duration-200 ${
              selectedCategory === cat.key
                ? `${cat.bg} ${cat.border} ring-1 ring-${cat.color.split('-')[1]}-500/30`
                : 'border-[#2C2C2C] bg-[#1a1a1a] hover:bg-[#222] hover:border-[#3A3A3A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  selectedCategory === cat.key ? cat.bg : 'bg-[#2C2C2C]'
                }`}
              >
                <i className={`fa-solid ${cat.icon} ${selectedCategory === cat.key ? cat.color : 'text-[#666]'}`} />
              </div>
              <div>
                <div
                  className={`text-sm font-semibold ${
                    selectedCategory === cat.key ? 'text-white' : 'text-[#A0A0A0]'
                  }`}
                >
                  {cat.label}
                </div>
                <div className="text-xs text-[#666]">
                  {cat.key === 'minerals' ? '8 项' : cat.key === 'ship_materials' ? '17 项' : '11 项'}
                </div>
              </div>
            </div>
            {selectedCategory === cat.key && (
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${cat.bg.replace('/10', '')}`} />
            )}
          </button>
        ))}
      </div>

      {/* 数据表格 */}
      <Card className="border-[#2C2C2C] bg-[#1a1a1a]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <i className={`fa-solid ${currentCategory.icon} ${currentCategory.color}`} />
              {currentCategory.label}市场数据
              <span className="text-xs text-[#666] font-normal">({items.length} 项)</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-[#666]">
              <i className="fa-solid fa-circle-notch fa-spin mr-2" />
              加载中...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2C2C2C] bg-[#111]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#888] w-32">材料名称</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-green-400" colSpan={3}>
                      <i className="fa-solid fa-arrow-trend-up mr-1" />
                      市场出售
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-400" colSpan={3}>
                      <i className="fa-solid fa-arrow-trend-down mr-1" />
                      收购订单
                    </th>
                  </tr>
                  <tr className="border-b border-[#2C2C2C] bg-[#111]/50">
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-[#666]"></th>
                    <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">价格(亿)</th>
                    <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">数量</th>
                    <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">地点</th>
                    <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">价格(亿)</th>
                    <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">数量</th>
                    <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">地点</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`border-b border-[#2C2C2C]/50 transition-colors hover:bg-[#222] ${
                        index % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#151515]'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <span className="text-sm font-medium text-white">{item.name}</span>
                      </td>
                      {/* 出售 */}
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          value={item.sell_price || ''}
                          onChange={(e) => handleUpdate(item.id, 'sell_price', Number(e.target.value) || 0)}
                          placeholder="0"
                          className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-green-400 text-center px-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          value={item.sell_quantity || ''}
                          onChange={(e) => handleUpdate(item.id, 'sell_quantity', Number(e.target.value) || 0)}
                          placeholder="0"
                          className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-white text-center px-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={item.sell_location || ''}
                          onChange={(e) => handleUpdate(item.id, 'sell_location', e.target.value)}
                          placeholder="-"
                          className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-white text-center px-1"
                        />
                      </td>
                      {/* 收购 */}
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          value={item.buy_price || ''}
                          onChange={(e) => handleUpdate(item.id, 'buy_price', Number(e.target.value) || 0)}
                          placeholder="0"
                          className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-blue-400 text-center px-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          value={item.buy_quantity || ''}
                          onChange={(e) => handleUpdate(item.id, 'buy_quantity', Number(e.target.value) || 0)}
                          placeholder="0"
                          className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-white text-center px-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={item.buy_location || ''}
                          onChange={(e) => handleUpdate(item.id, 'buy_location', e.target.value)}
                          placeholder="-"
                          className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-white text-center px-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 底部提示 */}
      <div className="flex items-center justify-between text-xs text-[#666]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-circle text-green-500 text-[6px]" />
            绿色 = 出售价格
          </span>
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-circle text-blue-500 text-[6px]" />
            蓝色 = 收购价格
          </span>
        </div>
        <span>数据会自动保存到云端和本地</span>
      </div>
    </div>
  );
}
