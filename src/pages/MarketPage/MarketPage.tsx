function lsGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const navigate = useNavigate();
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
      // 读取三个录入页的数据
      const mineralsData: InputMaterial[] = JSON.parse(
        lsGetItem(STORAGE_KEYS.minerals) || '[]',
      );
      const shipData: InputMaterial[] = JSON.parse(
        lsGetItem(STORAGE_KEYS.shipMaterials) || '[]',
      );
      const buildData: InputMaterial[] = JSON.parse(
        lsGetItem(STORAGE_KEYS.buildMaterials) || '[]',
      );

      // 根据当前分类选择数据源
      const sourceData =
        selectedCategory === 'minerals'
          ? mineralsData
          : selectedCategory === 'ship_materials'
            ? shipData
            : buildData;

      // 更新市场数据（只导入有出售价格的数据）
      let importedCount = 0;
      const updatedItems = items.map(item => {
        const source = sourceData.find(s => s.name === item.name);
        if (source && source.price > 0) {
          importedCount++;
          return {
            ...item,
            sell_price: source.price,
            sell_quantity: source.quantity,
          };
        }
        return item;
      });

      // 保存到 Supabase
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
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">市场数据</h2>
          <p className="text-sm text-muted-foreground mt-1">
            查看矿物、船材、建材的市场出售和收购信息
          </p>
        </div>
        <Button
          onClick={handleImportFromInputs}
          disabled={importing}
          className="bg-[#7C3AED] hover:bg-[#6D28D9]"
        >
          <i className="fa-solid fa-download mr-2" />
          {importing ? '导入中...' : '一键导入录入数据'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedCategory === cat.key
                ? 'bg-[#7C3AED] text-white'
                : 'bg-[#2C2C2C] text-[#A0A0A0] hover:bg-[#3A3A3A]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 材料列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {CATEGORIES.find(c => c.key === selectedCategory)?.label}列表 ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedItem?.id === item.id
                      ? 'bg-[#7C3AED]/20 text-[#A78BFA]'
                      : 'hover:bg-[#2C2C2C] text-[#E0E0E0]'
                  }`}
                >
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-[#888888] mt-0.5">
                    出售: {item.sell_price || 0} | 收购: {item.buy_price || 0}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 详细信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedItem ? selectedItem.name : '请选择材料'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedItem ? (
              <div className="space-y-4">
                {/* 出售信息 */}
                <div className="rounded-lg bg-[#2C2C2C] p-4">
                  <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-arrow-trend-up" />
                    市场出售
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-[#A0A0A0]">价格</span>
                      <span className="text-sm font-medium">{selectedItem.sell_price || 0} 亿 ISK</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[#A0A0A0]">数量</span>
                      <span className="text-sm font-medium">{selectedItem.sell_quantity || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[#A0A0A0]">地址</span>
                      <span className="text-sm font-medium">{selectedItem.sell_location || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* 收购信息 */}
                <div className="rounded-lg bg-[#2C2C2C] p-4">
                  <h3 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-arrow-trend-down" />
                    收购订单
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-[#A0A0A0]">价格</span>
                      <span className="text-sm font-medium">{selectedItem.buy_price || 0} 亿 ISK</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[#A0A0A0]">数量</span>
                      <span className="text-sm font-medium">{selectedItem.buy_quantity || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[#A0A0A0]">地址</span>
                      <span className="text-sm font-medium">{selectedItem.buy_location || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-[#888888]">
                请从左侧列表选择材料查看详情
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
