import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import {
  loadMaterialPrices,
  saveMaterialPrices,
  addMaterialPrice,
  deleteMaterialPrice,
  type MaterialPriceItem,
  type MaterialType,
} from '@/lib/admin-projects';

const TYPE_LABELS: Record<MaterialType, string> = {
  minerals: '矿物',
  ship_materials: '船材',
  build_materials: '建材',
};

const TYPE_OPTIONS: MaterialType[] = ['minerals', 'ship_materials', 'build_materials'];

export default function AdminMaterialsPage() {
  const [activeType, setActiveType] = useState<MaterialType>('minerals');
  const [items, setItems] = useState<MaterialPriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchItems = useCallback(async (type: MaterialType) => {
    setLoading(true);
    try {
      const data = await loadMaterialPrices(type);
      setItems(data);
    } catch (err) {
      console.error('[AdminMaterialsPage] fetchItems error:', err);
      toast.error('加载材料列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(activeType);
  }, [activeType, fetchItems]);

  const handlePriceChange = (id: string, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, price: Number(value) || 0 } : item
      )
    );
  };

  const handleQuantityChange = (id: string, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Number(value) || 0 } : item
      )
    );
  };

  const handleNameChange = (id: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: value } : item))
    );
  };

  const handleSave = async () => {
    try {
      await saveMaterialPrices(items);
      toast.success('保存成功');
    } catch (err) {
      console.error('[AdminMaterialsPage] save error:', err);
      toast.error('保存失败，请检查网络');
    }
  };

  const handleAdd = async () => {
    const newItem: MaterialPriceItem = {
      id: `${activeType}_${Date.now()}`,
      type: activeType,
      name: '新材料',
      price: 0,
      quantity: 0,
      sortOrder: items.length,
    };
    try {
      await addMaterialPrice(newItem);
      setItems([...items, newItem]);
    } catch (err) {
      console.error('[AdminMaterialsPage] add error:', err);
      toast.error('添加失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMaterialPrice(deleteId);
      setItems((prev) => prev.filter((item) => item.id !== deleteId));
      toast.success('材料已删除');
    } catch (err) {
      console.error('[AdminMaterialsPage] delete error:', err);
      toast.error('删除失败，请检查网络');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2 className="text-lg font-semibold text-white">材料管理</h2>
        <p className="mt-0.5 text-sm text-[#A0A0A0]">管理材料价格数据，所有用户可见</p>
      </div>

      {/* 类型切换 */}
      <div className="flex gap-2">
        {TYPE_OPTIONS.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all border ${
              activeType === type
                ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-0'
                : 'border-[#3A3A3A] bg-[#2C2C2C] text-[#A0A0A0] hover:bg-[#363636]'
            }`}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* 列表卡片 */}
      <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] overflow-hidden">
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3A3A3A]">
          <span className="text-sm text-[#A0A0A0]">{TYPE_LABELS[activeType]}列表 ({items.length})</span>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 rounded-lg border border-[#444] bg-[#1E1E1E] px-3 py-1.5 text-xs text-white hover:bg-[#363636] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> 添加
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6D28D9] transition-colors"
            >
              <Save className="h-3.5 w-3.5" /> 保存
            </button>
          </div>
        </div>

        <div className="divide-y divide-[#3A3A3A]/50 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-[#888]">
              <Loader2 className="h-5 w-5 animate-spin" /> 加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-[#666] text-sm">暂无数据</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 p-3 hover:bg-[#3A3A3A]/20 transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => handleNameChange(item.id, e.target.value)}
                    className="flex-1 rounded-md border border-[#444] bg-[#1E1E1E] px-2 py-1.5 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED]"
                    placeholder="名称"
                  />
                  <input
                    type="number"
                    value={item.price || ''}
                    onChange={(e) => handlePriceChange(item.id, e.target.value)}
                    className="w-28 rounded-md border border-[#444] bg-[#1E1E1E] px-2 py-1.5 text-sm text-right text-white placeholder-[#666] outline-none focus:border-[#7C3AED]"
                    placeholder="单价"
                  />
                  <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    className="w-28 rounded-md border border-[#444] bg-[#1E1E1E] px-2 py-1.5 text-sm text-right text-white placeholder-[#666] outline-none focus:border-[#7C3AED]"
                    placeholder="数量"
                  />
                  <button
                    onClick={() => setDeleteId(item.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#888] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white">确认删除</h3>
            <p className="mt-2 text-sm text-[#A0A0A0]">确定要删除这个材料吗？此操作不可撤销。</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-[#444] bg-[#1E1E1E] py-2.5 text-sm text-white hover:bg-[#363636]"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}