function lsGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { loadMarketData, saveMarketData, type MarketDataItem } from '@/lib/admin-projects';

const CATEGORIES = [
  { key: 'minerals', label: '矿物' },
  { key: 'ship_materials', label: '船材' },
  { key: 'build_materials', label: '建材' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

const STORAGE_KEYS = {
  minerals: 'eve_minerals_v3',
  shipMaterials: 'eve_ship_materials_v3',
  buildMaterials: 'eve_build_materials_v3',
};

interface InputMaterial {
  name: string;
  price: number;
  quantity: number;
}

export default function MarketPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('minerals');
  const [items, setItems] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MarketDataItem | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadItems(selectedCategory);
  }, [selectedCategory]);

  const loadItems = async (category: CategoryKey) => {
    setLoading(true);
    setSelectedItem(null);
    try {
      const data = await loadMarketData(category);
      setItems(data);
    } catch (err) {
      console.error('Failed to load market data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 一键导入：从三个录入页读取数据，更新市场数据
  const handleImportFromInputs = async () => {
    setImporting(true);
    try {
      const mineralsData: InputMaterial[] = JSON.parse(
        lsGetItem(STORAGE_KEYS.minerals) || '[]',
      );
      const shipData: InputMaterial[] = JSON.parse(
        lsGetItem(STORAGE_KEYS.shipMaterials) || '[]',
      );
      const buildData: InputMaterial[] = JSON.parse(
        lsGetItem(STORAGE_KEYS.buildMaterials) || '[]',
      );
      const sourceData =
        selectedCategory === 'minerals'
          ? mineralsData
          : selectedCategory === 'ship_materials'
            ? shipData
            : buildData;
      let importedCount = 0;
      const updatedItems = items.map(item => {
        const source = sourceData.find(s => s.name === item.name);
        if (source && source.price > 0) {
          importedCount++;
          return { ...item, sell_price: source.price, sell_quantity: source.quantity };
        }
        return item;
      });
      await saveMarketData(updatedItems);
      setItems(updatedItems);
      alert(`已导入 ${importedCount} 条数据到${CATEGORIES.find(c => c.key === selectedCategory)?.label}市场`);
    } catch (err) {
      console.error('Failed to import data:', err);
      alert('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#7C3AED] mr-2" />
        <span className="text-[#A0A0A0]">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-white">市场数据</h2>
          <p className="text-xs md:text-sm text-[#A0A0A0] mt-0.5 md:mt-1">
            查看矿物、船材、建材的市场出售和收购信息
          </p>
        </div>
        <Button
          onClick={handleImportFromInputs}
          disabled={importing}
          size="sm"
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white h-11 md:h-auto w-full sm:w-auto"
        >
          <Download className="h-4 w-4 mr-1.5" />
          {importing ? '导入中...' : '一键导入录入数据'}
        </Button>
      </div>

      <div className="flex gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`flex-1 sm:flex-initial rounded-lg px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium transition-colors ${
              selectedCategory === cat.key
                ? 'bg-[#7C3AED] text-white'
                : 'bg-[#2C2C2C] text-[#A0A0A0] hover:bg-[#3A3A3A]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <Card className="bg-[#2C2C2C] border-[#3A3A3A]">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-sm md:text-base text-white">
              {CATEGORIES.find(c => c.key === selectedCategory)?.label}列表 ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5 max-h-[300px] md:max-h-[500px] overflow-y-auto">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left px-3 py-2.5 md:py-2 rounded-lg transition-colors text-sm ${
                    selectedItem?.id === item.id
                      ? 'bg-[#7C3AED]/20 text-[#A78BFA]'
                      : 'hover:bg-[#3A3A3A]/50 text-[#E0E0E0]'
                  }`}
                >
                  <div className="text-sm md:text-base font-medium">{item.name}</div>
                  <div className="text-[10px] md:text-xs text-[#888888] mt-0.5">
                    出售: {item.sell_price || 0} | 收购: {item.buy_price || 0}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2C2C2C] border-[#3A3A3A]">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-sm md:text-base text-white">
              {selectedItem ? selectedItem.name : '请选择材料'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedItem ? (
              <div className="space-y-3 md:space-y-4">
                <div className="rounded-lg bg-[#1E1E1E] p-3 md:p-4">
                  <h3 className="text-xs md:text-sm font-medium text-[#22C55E] mb-2 md:mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    市场出售
                  </h3>
                  <div className="space-y-1.5 md:space-y-2">
                    <div className="flex justify-between"><span className="text-[11px] md:text-sm text-[#A0A0A0]">价格</span><span className="text-[11px] md:text-sm font-medium text-white">{selectedItem.sell_price || 0} 亿 ISK</span></div>
                    <div className="flex justify-between"><span className="text-[11px] md:text-sm text-[#A0A0A0]">数量</span><span className="text-[11px] md:text-sm font-medium text-white">{selectedItem.sell_quantity || 0}</span></div>
                    <div className="flex justify-between"><span className="text-[11px] md:text-sm text-[#A0A0A0]">地址</span><span className="text-[11px] md:text-sm font-medium text-white">{selectedItem.sell_location || '-'}</span></div>
                  </div>
                </div>
                <div className="rounded-lg bg-[#1E1E1E] p-3 md:p-4">
                  <h3 className="text-xs md:text-sm font-medium text-[#3B82F6] mb-2 md:mb-3 flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    收购订单
                  </h3>
                  <div className="space-y-1.5 md:space-y-2">
                    <div className="flex justify-between"><span className="text-[11px] md:text-sm text-[#A0A0A0]">价格</span><span className="text-[11px] md:text-sm font-medium text-white">{selectedItem.buy_price || 0} 亿 ISK</span></div>
                    <div className="flex justify-between"><span className="text-[11px] md:text-sm text-[#A0A0A0]">数量</span><span className="text-[11px] md:text-sm font-medium text-white">{selectedItem.buy_quantity || 0}</span></div>
                    <div className="flex justify-between"><span className="text-[11px] md:text-sm text-[#A0A0A0]">地址</span><span className="text-[11px] md:text-sm font-medium text-white">{selectedItem.buy_location || '-'}</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-32 md:h-48 items-center justify-center text-[#888888] text-sm">
                请从列表选择材料查看详情
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
