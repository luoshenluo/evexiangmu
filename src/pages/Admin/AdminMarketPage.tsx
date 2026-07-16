import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadMarketData,
  saveMarketData,
  type MarketDataItem,
} from '@/lib/admin-projects';

const TABS = [
  { key: 'minerals', label: '矿物', icon: 'fa-gem', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
  { key: 'ship_materials', label: '船材', icon: 'fa-ship', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  { key: 'build_materials', label: '建材', icon: 'fa-building', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AdminMarketPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('minerals');
  const [items, setItems] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadItems(activeTab);
  }, [activeTab]);

  const loadItems = async (type: TabKey) => {
    setLoading(true);
    setDirty(false);
    try {
      const data = await loadMarketData(type);
      setItems(data);
    } catch (err) {
      console.error('Failed to load market data:', err);
      setItems([]);
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
    setSaving(true);
    try {
      await saveMarketData(items);
      setDirty(false);
    } catch (err) {
      console.error('Failed to save market data:', err);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const currentTab = TABS.find(t => t.key === activeTab)!;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#888] flex items-center gap-2">
          <i className="fa-solid fa-circle-notch fa-spin" />
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">市场数据管理</h2>
          <p className="text-xs text-[#888] mt-0.5">
            管理矿物、船材、建材的市场出售和收购数据
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`gap-2 self-start sm:self-auto transition-all ${
            dirty
              ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
              : 'bg-[#2C2C2C] text-[#666] cursor-not-allowed'
          }`}
        >
          <i className={`fa-solid fa-save ${saving ? 'fa-spin' : ''}`} />
          {saving ? '保存中...' : dirty ? '保存更改' : '已保存'}
        </Button>
      </div>

      {/* 分类切换标签 */}
      <div className="flex gap-2">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border ${
              activeTab === tab.key
                ? 'border-[#3A3A3A] text-white'
                : 'border-transparent text-[#888] hover:text-[#ccc] hover:bg-[#222]'
            }`}
            style={{
              backgroundColor: activeTab === tab.key ? tab.bg : 'transparent',
              borderColor: activeTab === tab.key ? `${tab.color}40` : undefined,
            }}
          >
            <i
              className={`fa-solid ${tab.icon}`}
              style={{ color: activeTab === tab.key ? tab.color : '#666' }}
            />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 当前分类标题 */}
      <div className="flex items-center gap-2">
        <i className={`fa-solid ${currentTab.icon}`} style={{ color: currentTab.color }} />
        <span className="text-sm font-medium text-white">{currentTab.label}</span>
        <span className="text-xs text-[#666]">({items.length} 项)</span>
      </div>

      {/* PC端: 表格布局 */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-[#2C2C2C]">
        <table className="w-full">
          <thead>
            <tr className="bg-[#151515]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#888] w-28">材料名称</th>
              <th className="px-2 py-3 text-center text-xs font-medium text-green-400" colSpan={3}>
                <i className="fa-solid fa-arrow-trend-up mr-1" />
                市场出售
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-blue-400" colSpan={3}>
                <i className="fa-solid fa-arrow-trend-down mr-1" />
                收购订单
              </th>
            </tr>
            <tr className="bg-[#111] border-b border-[#2C2C2C]">
              <th className="px-4 py-2"></th>
              <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">价格(ISK)</th>
              <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">数量</th>
              <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">地点</th>
              <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">价格(ISK)</th>
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
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    value={item.sell_price || ''}
                    onChange={e => handleChange(item.id, 'sell_price', parseFloat(e.target.value) || 0)}
                    className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-green-400 text-center px-1"
                    step="0.01"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    value={item.sell_quantity || ''}
                    onChange={e => handleChange(item.id, 'sell_quantity', parseFloat(e.target.value) || 0)}
                    className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-white text-center px-1"
                    step="0.01"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={item.sell_location || ''}
                    onChange={e => handleChange(item.id, 'sell_location', e.target.value)}
                    className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-white text-center px-1"
                    placeholder="-"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    value={item.buy_price || ''}
                    onChange={e => handleChange(item.id, 'buy_price', parseFloat(e.target.value) || 0)}
                    className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-blue-400 text-center px-1"
                    step="0.01"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    value={item.buy_quantity || ''}
                    onChange={e => handleChange(item.id, 'buy_quantity', parseFloat(e.target.value) || 0)}
                    className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-white text-center px-1"
                    step="0.01"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={item.buy_location || ''}
                    onChange={e => handleChange(item.id, 'buy_location', e.target.value)}
                    className="h-7 bg-[#0a0a0a] border-[#333] text-sm text-white text-center px-1"
                    placeholder="-"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端: 卡片布局 */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3 space-y-3"
          >
            {/* 材料名称 */}
            <div className="flex items-center gap-2 pb-2 border-b border-[#2C2C2C]">
              <i className={`fa-solid ${currentTab.icon}`} style={{ color: currentTab.color }} />
              <span className="text-sm font-semibold text-white">{item.name}</span>
            </div>

            {/* 市场出售 */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                <i className="fa-solid fa-arrow-trend-up" />
                市场出售
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[#666] block mb-1">价格(ISK)</label>
                  <Input
                    type="number"
                    value={item.sell_price || ''}
                    onChange={e => handleChange(item.id, 'sell_price', parseFloat(e.target.value) || 0)}
                    className="h-8 bg-[#0a0a0a] border-[#333] text-sm text-green-400 text-center"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#666] block mb-1">数量</label>
                  <Input
                    type="number"
                    value={item.sell_quantity || ''}
                    onChange={e => handleChange(item.id, 'sell_quantity', parseFloat(e.target.value) || 0)}
                    className="h-8 bg-[#0a0a0a] border-[#333] text-sm text-white text-center"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#666] block mb-1">地点</label>
                  <Input
                    value={item.sell_location || ''}
                    onChange={e => handleChange(item.id, 'sell_location', e.target.value)}
                    className="h-8 bg-[#0a0a0a] border-[#333] text-sm text-white text-center"
                    placeholder="-"
                  />
                </div>
              </div>
            </div>

            {/* 收购订单 */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
                <i className="fa-solid fa-arrow-trend-down" />
                收购订单
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[#666] block mb-1">价格(ISK)</label>
                  <Input
                    type="number"
                    value={item.buy_price || ''}
                    onChange={e => handleChange(item.id, 'buy_price', parseFloat(e.target.value) || 0)}
                    className="h-8 bg-[#0a0a0a] border-[#333] text-sm text-blue-400 text-center"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#666] block mb-1">数量</label>
                  <Input
                    type="number"
                    value={item.buy_quantity || ''}
                    onChange={e => handleChange(item.id, 'buy_quantity', parseFloat(e.target.value) || 0)}
                    className="h-8 bg-[#0a0a0a] border-[#333] text-sm text-white text-center"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#666] block mb-1">地点</label>
                  <Input
                    value={item.buy_location || ''}
                    onChange={e => handleChange(item.id, 'buy_location', e.target.value)}
                    className="h-8 bg-[#0a0a0a] border-[#333] text-sm text-white text-center"
                    placeholder="-"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {items.length === 0 && (
        <div className="text-center py-12 text-[#666]">
          <i className="fa-solid fa-inbox text-3xl mb-3 opacity-50" />
          <p className="text-sm">暂无数据</p>
        </div>
      )}
    </div>
  );
}

export default AdminMarketPage;
