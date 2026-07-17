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
  deleteMaterialPrice,
  type MaterialPriceItem,
  type MaterialType,
} from '@/lib/admin-projects';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';

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
    try {
      const data = await loadMaterialPrices(type);
      setItems(data);
    } catch (error) {
      console.error('Failed to load materials:', error);
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
      alert('保存成功');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('保存失败');
    }
  };

  const handleAdd = () => {
    const newItem: MaterialPriceItem = {
      id: `${activeType}_${Date.now()}`,
      type: activeType,
      name: '新材料',
      price: 0,
      quantity: 0,
      sortOrder: items.length,
    };
    setItems([...items, newItem]);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMaterialPrice(deleteId);
      setItems((prev) => prev.filter((item) => item.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-[#1E1E1E] text-white pb-24">
      <header className="sticky top-0 z-40 border-b border-[#3A3A3A] bg-[#1E1E1E]/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/projects')}>
            <ArrowLeft className="h-4 w-4" />
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
                  : 'border-[#3A3A3A] bg-[#2C2C2C] text-white/70'
              }`}
              onClick={() => setActiveType(type)}
            >
              {TYPE_LABELS[type]}
            </Button>
          ))}
        </div>

        {/* 材料列表 */}
        <Card className="bg-[#2C2C2C] border-[#3A3A3A]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white/80">
                {TYPE_LABELS[activeType]}列表 ({items.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#3A3A3A] bg-[#2C2C2C] text-white/80 hover:bg-[#3A3A3A]"
                  onClick={handleAdd}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  添加
                </Button>
                <Button
                  size="sm"
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                  onClick={handleSave}
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
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
                    className="grid grid-cols-12 gap-2 items-center rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] p-2"
                  >
                    <div className="col-span-4">
                      <Input
                        value={item.name}
                        onChange={(e) => handleNameChange(item.id, e.target.value)}
                        className="h-11 bg-transparent border-[#3A3A3A] text-sm text-white"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={item.price || ''}
                        onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        placeholder="0"
                        className="h-11 bg-transparent border-[#3A3A3A] text-sm text-white"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        placeholder="0"
                        className="h-11 bg-transparent border-[#3A3A3A] text-sm text-white"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
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
        <AlertDialogContent className="bg-[#2C2C2C] border-[#3A3A3A]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A0A0A0]">
              确定要删除这个材料吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#3A3A3A] bg-transparent text-white hover:bg-[#3A3A3A]">
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
