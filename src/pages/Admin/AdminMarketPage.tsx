import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  loadMarketData,
  saveMarketData,
  type MarketDataItem,
} from '@/lib/admin-projects';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'minerals', label: '矿物' },
  { key: 'ship_materials', label: '船材' },
  { key: 'build_materials', label: '建材' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AdminMarketPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('minerals');
  const [items, setItems] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadItems(activeTab);
  }, [activeTab]);

  const loadItems = async (type: TabKey) => {
    setLoading(true);
    try {
      const data = await loadMarketData(type);
      setItems(data);
    } catch (err) {
      console.error('Failed to load market data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (id: string, field: keyof MarketDataItem, value: string | number) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await saveMarketData(items);
      setDirty(false);
      alert('保存成功');
    } catch (err) {
      console.error('Failed to save market data:', err);
      alert('保存失败');
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="text-[#A0A0A0]">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">市场数据管理</h2>
          <p className="text-sm text-[#A0A0A0] mt-1">
            管理矿物、船材、建材的市场出售和收购数据
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty}
          className="gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white hidden md:flex"
        >
          <Save className="h-4 w-4" />
          保存
        </Button>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden md:grid md:grid-cols-3 gap-2">
        {TABS.map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'w-full',
              activeTab === tab.key
                ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-0'
                : 'border-[#3A3A3A] text-[#A0A0A0] hover:bg-[#3A3A3A]'
            )}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Mobile Scrollable Tabs */}
      <ScrollArea className="md:hidden">
        <div className="flex gap-2 pb-2">
          {TABS.map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'shrink-0',
                activeTab === tab.key
                  ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-0'
                  : 'border-[#3A3A3A] text-[#A0A0A0] hover:bg-[#3A3A3A]'
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Desktop Table */}
      <Card className="bg-[#2C2C2C] border-[#3A3A3A] hidden md:block">
        <CardHeader>
          <CardTitle className="text-white">
            {TABS.find(t => t.key === activeTab)?.label}市场数据 ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[#3A3A3A]">
                <TableHead className="w-[130px] text-[#A0A0A0]">名称</TableHead>
                <TableHead className="text-[#A0A0A0]">出售价格</TableHead>
                <TableHead className="text-[#A0A0A0] hidden lg:table-cell">出售数量</TableHead>
                <TableHead className="text-[#A0A0A0]">出售地址</TableHead>
                <TableHead className="text-[#A0A0A0]">收购价格</TableHead>
                <TableHead className="text-[#A0A0A0] hidden lg:table-cell">收购数量</TableHead>
                <TableHead className="text-[#A0A0A0]">收购地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id} className="border-[#3A3A3A]">
                  <TableCell className="font-medium text-white">{item.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.sell_price || ''}
                      onChange={e => handleChange(item.id, 'sell_price', parseFloat(e.target.value) || 0)}
                      className="h-7 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Input
                      type="number"
                      value={item.sell_quantity || ''}
                      onChange={e => handleChange(item.id, 'sell_quantity', parseFloat(e.target.value) || 0)}
                      className="h-7 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.sell_location || ''}
                      onChange={e => handleChange(item.id, 'sell_location', e.target.value)}
                      className="h-7 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      placeholder="地址"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.buy_price || ''}
                      onChange={e => handleChange(item.id, 'buy_price', parseFloat(e.target.value) || 0)}
                      className="h-7 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Input
                      type="number"
                      value={item.buy_quantity || ''}
                      onChange={e => handleChange(item.id, 'buy_quantity', parseFloat(e.target.value) || 0)}
                      className="h-7 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.buy_location || ''}
                      onChange={e => handleChange(item.id, 'buy_location', e.target.value)}
                      className="h-7 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      placeholder="地址"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 pb-20">
        {items.map(item => (
          <Card key={item.id} className="bg-[#2C2C2C] border-[#3A3A3A]">
            <CardContent className="pt-4 space-y-3">
              {/* Name */}
              <div className="text-base font-medium text-white">{item.name}</div>

              {/* Sell row */}
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1.5">出售</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Input
                      type="number"
                      value={item.sell_price || ''}
                      onChange={e => handleChange(item.id, 'sell_price', parseFloat(e.target.value) || 0)}
                      className="h-11 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      step="0.01"
                      placeholder="价格"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={item.sell_quantity || ''}
                      onChange={e => handleChange(item.id, 'sell_quantity', parseFloat(e.target.value) || 0)}
                      className="h-11 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      step="0.01"
                      placeholder="数量"
                    />
                  </div>
                  <div>
                    <Input
                      value={item.sell_location || ''}
                      onChange={e => handleChange(item.id, 'sell_location', e.target.value)}
                      className="h-11 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      placeholder="地址"
                    />
                  </div>
                </div>
              </div>

              {/* Buy row */}
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1.5">收购</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Input
                      type="number"
                      value={item.buy_price || ''}
                      onChange={e => handleChange(item.id, 'buy_price', parseFloat(e.target.value) || 0)}
                      className="h-11 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      step="0.01"
                      placeholder="价格"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={item.buy_quantity || ''}
                      onChange={e => handleChange(item.id, 'buy_quantity', parseFloat(e.target.value) || 0)}
                      className="h-11 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      step="0.01"
                      placeholder="数量"
                    />
                  </div>
                  <div>
                    <Input
                      value={item.buy_location || ''}
                      onChange={e => handleChange(item.id, 'buy_location', e.target.value)}
                      className="h-11 bg-[#1E1E1E] border-[#3A3A3A] text-white text-sm"
                      placeholder="地址"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mobile Fixed Bottom Save Button */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-[#3A3A3A] bg-[#2C2C2C] p-3 md:hidden">
        <Button
          onClick={handleSave}
          disabled={!dirty}
          className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white h-12 gap-2 text-base"
        >
          <Save className="h-5 w-5" />
          保存
        </Button>
      </div>
    </div>
  );
}

export default AdminMarketPage;
