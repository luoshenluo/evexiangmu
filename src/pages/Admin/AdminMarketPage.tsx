import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Gem, Ship, Factory, Save, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { loadMarketData, saveMarketData, type MarketDataItem } from '@/lib/admin-projects';

const TABS = [
  { key: 'minerals' as const, label: '矿物', icon: Gem, color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
  { key: 'ship_materials' as const, label: '船材', icon: Ship, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  { key: 'build_materials' as const, label: '建材', icon: Factory, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
];

type TabKey = (typeof TABS)[number]['key'];

const inputCls = 'h-7 w-full rounded-md border border-[#333] bg-[#0a0a0a] px-2 py-1 text-sm text-center text-white placeholder-[#666] outline-none focus:border-[#7C3AED] transition-colors';
const inputClsGreen = inputCls + ' text-green-400';
const inputClsBlue = inputCls + ' text-blue-400';

export default function AdminMarketPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('minerals');
  const [items, setItems] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async (type: TabKey) => {
    setLoading(true); setDirty(false);
    try { const data = await loadMarketData(type); setItems(data); } catch (err) { console.error(err); toast.error('加载市场数据失败'); setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(activeTab); }, [activeTab, loadItems]);

  const handleChange = (id: string, field: keyof MarketDataItem, value: string | number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await saveMarketData(items); setDirty(false); toast.success('保存成功'); } catch (err) { console.error(err); toast.error('保存失败，请检查网络'); } finally { setSaving(false); }
  };

  const currentTab = TABS.find(t => t.key === activeTab) || TABS[0];
  const TabIcon = currentTab.icon;

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="text-[#888] flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> 加载中...</div></div>;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 className="text-xl font-bold text-white">市场数据管理</h2><p className="text-xs text-[#888] mt-0.5">管理矿物、船材、建材的市场出售和收购数据</p></div>
        <button onClick={handleSave} disabled={!dirty || saving} className={'flex items-center gap-2 self-start sm:self-auto rounded-lg px-4 py-2 text-sm font-medium transition-all ' + (dirty ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white' : 'bg-[#2C2C2C] text-[#666] cursor-not-allowed')}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? '保存中...' : dirty ? '保存更改' : '已保存'}
        </button>
      </div>

      <div className="flex gap-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all" style={{ backgroundColor: activeTab === tab.key ? tab.bg : 'transparent', borderColor: activeTab === tab.key ? tab.color + '40' : 'transparent', border: '1px solid', color: activeTab === tab.key ? 'white' : '#888' }}>
              <Icon className="h-4 w-4" style={{ color: activeTab === tab.key ? tab.color : '#666' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-[#2C2C2C]">
        <table className="w-full">
          <thead>
            <tr className="bg-[#151515]"><th className="px-4 py-3 text-left text-xs font-medium text-[#888] w-28">材料名称</th><th className="px-2 py-3 text-center text-xs font-medium text-green-400" colSpan={3}><TrendingUp className="inline h-3.5 w-3.5 mr-1" />市场出售</th><th className="px-2 py-3 text-center text-xs font-medium text-blue-400" colSpan={3}><TrendingDown className="inline h-3.5 w-3.5 mr-1" />收购订单</th></tr>
            <tr className="bg-[#111] border-b border-[#2C2C2C]"><th className="px-4 py-2"></th><th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">价格</th><th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">数量</th><th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">地点</th><th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">价格</th><th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">数量</th><th className="px-2 py-2 text-center text-[10px] font-medium text-[#666]">地点</th></tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className={'border-b border-[#2C2C2C]/50 transition-colors hover:bg-[#222] ' + (index % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#151515]')}>
                <td className="px-4 py-2.5"><span className="text-sm font-medium text-white">{item.name}</span></td>
                <td className="px-2 py-2"><input type="number" value={item.sell_price || ''} onChange={e => handleChange(item.id, 'sell_price', parseFloat(e.target.value) || 0)} className={inputClsGreen} /></td>
                <td className="px-2 py-2"><input type="number" value={item.sell_quantity || ''} onChange={e => handleChange(item.id, 'sell_quantity', parseFloat(e.target.value) || 0)} className={inputCls} /></td>
                <td className="px-2 py-2"><input value={item.sell_location || ''} onChange={e => handleChange(item.id, 'sell_location', e.target.value)} className={inputCls} /></td>
                <td className="px-2 py-2"><input type="number" value={item.buy_price || ''} onChange={e => handleChange(item.id, 'buy_price', parseFloat(e.target.value) || 0)} className={inputClsBlue} /></td>
                <td className="px-2 py-2"><input type="number" value={item.buy_quantity || ''} onChange={e => handleChange(item.id, 'buy_quantity', parseFloat(e.target.value) || 0)} className={inputCls} /></td>
                <td className="px-2 py-2"><input value={item.buy_location || ''} onChange={e => handleChange(item.id, 'buy_location', e.target.value)} className={inputCls} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#666]">暂无数据</div>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3 space-y-3">
            <div className="flex items-center gap-2">
              <TabIcon className="h-4 w-4 shrink-0" style={{ color: currentTab.color }} />
              <span className="text-sm font-medium text-white">{item.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#111] p-2 space-y-1.5">
                <span className="text-[10px] text-green-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" />市场出售</span>
                <div className="grid grid-cols-3 gap-1">
                  <div><span className="text-[9px] text-[#666]">价格</span><input type="number" value={item.sell_price || ''} onChange={e => handleChange(item.id, 'sell_price', parseFloat(e.target.value) || 0)} className={inputClsGreen + ' h-6 text-xs'} /></div>
                  <div><span className="text-[9px] text-[#666]">数量</span><input type="number" value={item.sell_quantity || ''} onChange={e => handleChange(item.id, 'sell_quantity', parseFloat(e.target.value) || 0)} className={inputCls + ' h-6 text-xs'} /></div>
                  <div><span className="text-[9px] text-[#666]">地点</span><input value={item.sell_location || ''} onChange={e => handleChange(item.id, 'sell_location', e.target.value)} className={inputCls + ' h-6 text-xs'} /></div>
                </div>
              </div>
              <div className="rounded-lg bg-[#111] p-2 space-y-1.5">
                <span className="text-[10px] text-blue-400 flex items-center gap-1"><TrendingDown className="h-3 w-3" />收购订单</span>
                <div className="grid grid-cols-3 gap-1">
                  <div><span className="text-[9px] text-[#666]">价格</span><input type="number" value={item.buy_price || ''} onChange={e => handleChange(item.id, 'buy_price', parseFloat(e.target.value) || 0)} className={inputClsBlue + ' h-6 text-xs'} /></div>
                  <div><span className="text-[9px] text-[#666]">数量</span><input type="number" value={item.buy_quantity || ''} onChange={e => handleChange(item.id, 'buy_quantity', parseFloat(e.target.value) || 0)} className={inputCls + ' h-6 text-xs'} /></div>
                  <div><span className="text-[9px] text-[#666]">地点</span><input value={item.buy_location || ''} onChange={e => handleChange(item.id, 'buy_location', e.target.value)} className={inputCls + ' h-6 text-xs'} /></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}