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
import {
  loadMarketData,
  saveMarketData,
  type MarketDataItem,
} from '@/lib/admin-projects';

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
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">市场数据管理</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理矿物、船材、建材的市场出售和收购数据
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty} className="gap-2">
          <i className="fa-solid fa-save" />
          保存
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TABS.map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.key)}
            className="w-full"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {TABS.find(t => t.key === activeTab)?.label}市场数据 ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">名称</TableHead>
                <TableHead>出售价格</TableHead>
                <TableHead>出售数量</TableHead>
                <TableHead>出售地址</TableHead>
                <TableHead>收购价格</TableHead>
                <TableHead>收购数量</TableHead>
                <TableHead>收购地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.sell_price || ''}
                      onChange={e => handleChange(item.id, 'sell_price', parseFloat(e.target.value) || 0)}
                      className="h-7"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.sell_quantity || ''}
                      onChange={e => handleChange(item.id, 'sell_quantity', parseFloat(e.target.value) || 0)}
                      className="h-7"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.sell_location || ''}
                      onChange={e => handleChange(item.id, 'sell_location', e.target.value)}
                      className="h-7"
                      placeholder="地址"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.buy_price || ''}
                      onChange={e => handleChange(item.id, 'buy_price', parseFloat(e.target.value) || 0)}
                      className="h-7"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.buy_quantity || ''}
                      onChange={e => handleChange(item.id, 'buy_quantity', parseFloat(e.target.value) || 0)}
                      className="h-7"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.buy_location || ''}
                      onChange={e => handleChange(item.id, 'buy_location', e.target.value)}
                      className="h-7"
                      placeholder="地址"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminMarketPage;
