import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<MaterialType>('minerals');
  const [items, setItems] = useState<MaterialPriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchItems = useCallback(async (type: MaterialType) => {
    setLoading(true);
    const data = await loadMaterialPrices(type);
    setItems(data);
    setLoading(false);
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
    await saveMaterialPrices(items);
    alert('保存成功');
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
    await addMaterialPrice(newItem);
    setItems([...items, newItem]);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMaterialPrice(deleteId);
    setItems((prev) => prev.filter((item) => item.id !== deleteId));
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/projects')}>
            <i className="fa-solid fa-arrow-left text-sm" />
          </Button>
          <h1 className="text-base font-semibold">材料管理</h1>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* 类型切换 */}
        <div className="flex gap-2">
          {TYPE_OPTIONS.map((type) => (
            <Button
              key={type}
              variant={activeType === type ? 'default' : 'outline'}
              className={`flex-1 ${
                activeType === type
                  ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-0'
                  : 'border-white/10 bg-white/5 text-white/70'
              }`}
              onClick={() => setActiveType(type)}
            >
              {TYPE_LABELS[type]}
            </Button>
          ))}
        </div>

        {/* 材料列表 */}
        <Card className="bg-[#111] border-white/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white/80">
                {TYPE_LABELS[activeType]}列表 ({items.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  onClick={handleAdd}
                >
                  <i className="fa-solid fa-plus mr-1 text-xs" />
                  添加
                </Button>
                <Button
                  size="sm"
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                  onClick={handleSave}
                >
                  <i className="fa-solid fa-save mr-1 text-xs" />
                  保存
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="py-8 text-center text-white/40">加载中...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-white/40">暂无数据</div>
            ) : (
              <>
                {/* 表头 */}
                <div className="grid grid-cols-12 gap-2 px-2 text-xs text-white/50">
                  <div className="col-span-4">名称</div>
                  <div className="col-span-3">单价</div>
                  <div className="col-span-3">数量</div>
                  <div className="col-span-2 text-right">操作</div>
                </div>
                {/* 数据行 */}
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center rounded-lg border border-white/5 bg-white/5 p-2"
                  >
                    <div className="col-span-4">
                      <Input
                        value={item.name}
                        onChange={(e) => handleNameChange(item.id, e.target.value)}
                        className="h-8 bg-transparent border-white/10 text-sm text-white"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={item.price || ''}
                        onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        placeholder="0"
                        className="h-8 bg-transparent border-white/10 text-sm text-white"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        placeholder="0"
                        className="h-8 bg-transparent border-white/10 text-sm text-white"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <i className="fa-solid fa-trash mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#1a1a1a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              确定要删除这个材料吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-white hover:bg-white/10">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
