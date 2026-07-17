import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Gem,
  Rocket,
  Boxes,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PRESET_MINERALS,
  PRESET_SHIP_MATERIALS,
  PRESET_BUILD_MATERIALS,
  type IProjectMaterials,
  type IManufactureProject,
} from '@/data/materials';
import {
  findAdminProject,
  addAdminProject,
  updateAdminProject,
} from '@/lib/admin-projects';
import { emptyMaterials } from '@/components/shared/emptyMaterials';

/** 可折叠材料数量编辑组 */
function MaterialGroup({
  title,
  icon: Icon,
  color,
  items,
  values,
  onChange,
}: {
  title: string;
  icon: typeof Gem;
  color: string;
  items: { name: string }[];
  values: number[];
  onChange: (idx: number, val: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[#3A3A3A] bg-[#1E1E1E]/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[#3A3A3A]/30"
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-medium text-white">{title}</span>
          <span className="text-[11px] text-[#888888]">({items.length}项)</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[#888888]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#888888]" />
        )}
      </button>
      {open && (
        <div className="border-t border-[#3A3A3A] max-h-72 overflow-y-auto">
          {items.map((item, idx) => (
            <div
              key={item.name}
              className="flex items-center justify-between px-3 py-2 border-b border-[#3A3A3A]/50 last:border-b-0"
            >
              <span className="text-xs text-[#A0A0A0] truncate flex-1">{item.name}</span>
              <input
                type="text"
                inputMode="numeric"
                value={(values[idx] ?? 0) === 0 ? '' : String(values[idx] ?? 0)}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw !== '' && !/^\d*$/.test(raw)) return;
                  onChange(idx, raw === '' ? 0 : parseInt(raw, 10) || 0);
                }}
                placeholder="0"
                className="w-28 rounded-md border border-[#444444] bg-[#2C2C2C] px-2 py-1 text-right text-xs text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminProjectEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new';

  // 加载项目数据（异步）
  const [existing, setExisting] = useState<IManufactureProject | null>(null);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew || !id) {
      setLoading(false);
      return;
    }
    findAdminProject(id).then((proj) => {
      setExisting(proj);
      if (proj) {
        setName(proj.name);
        setCategory(proj.category);
        setBlueprintPrice(proj.blueprintPrice);
        setFixedFee(proj.fixedManufactureFee);
        setBuyPrice(proj.buyOrderPrice);
        setSellPrice(proj.marketSellPrice);
        setMaterials(proj.materials ?? emptyMaterials());
      }
      setLoading(false);
    });
  }, [isNew, id]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [blueprintPrice, setBlueprintPrice] = useState(0);
  const [fixedFee, setFixedFee] = useState(0);
  const [buyPrice, setBuyPrice] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [materials, setMaterials] = useState<IProjectMaterials>(emptyMaterials());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入项目名称');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await addAdminProject({
          name: name.trim(),
          category: category.trim() || '自定义',
          materialCost150: existing?.materialCost150 ?? 0,
          blueprintPrice,
          fixedManufactureFee: fixedFee,
          buyOrderPrice: buyPrice,
          marketSellPrice: sellPrice,
          materials,
        });
        toast.success('项目已创建');
      } else if (id) {
        await updateAdminProject(id, {
          name: name.trim(),
          category: category.trim() || '自定义',
          blueprintPrice,
          fixedManufactureFee: fixedFee,
          buyOrderPrice: buyPrice,
          marketSellPrice: sellPrice,
          materials,
        });
        toast.success('项目已更新');
      }
      navigate('/admin/projects');
    } catch (err) {
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" />
        <span className="ml-2 text-sm text-[#A0A0A0]">加载项目数据...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-20">
      {/* 顶部返回栏 */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/projects')}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] text-white transition-colors hover:border-[#555555]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-white">
            {isNew ? '新增项目' : '编辑项目'}
          </h2>
        </div>
      </div>

      <div className="space-y-5 max-w-2xl">
        {/* 基本信息 */}
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">基本信息</h3>
          <div>
            <label className="text-xs text-[#A0A0A0] mb-1 block">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入舰船/项目名称"
              className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
            />
          </div>
          <div>
            <label className="text-xs text-[#A0A0A0] mb-1 block">分类标签</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="如：护卫舰级、驱逐舰级"
              className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
            />
          </div>
        </div>

        {/* 材料数量明细 */}
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">材料数量明细</h3>
          <p className="text-[11px] text-[#888888] -mt-1">
            填入各项材料数量
          </p>
          <MaterialGroup
            title="矿物明细"
            icon={Gem}
            color="text-[#F59E0B]"
            items={PRESET_MINERALS}
            values={materials.minerals}
            onChange={(idx, val) => {
              setMaterials((prev) => {
                const next = [...prev.minerals];
                next[idx] = val;
                return { ...prev, minerals: next };
              });
            }}
          />
          <MaterialGroup
            title="船材明细"
            icon={Rocket}
            color="text-[#06B6D4]"
            items={PRESET_SHIP_MATERIALS}
            values={materials.shipMaterials}
            onChange={(idx, val) => {
              setMaterials((prev) => {
                const next = [...prev.shipMaterials];
                next[idx] = val;
                return { ...prev, shipMaterials: next };
              });
            }}
          />
          <MaterialGroup
            title="建材明细"
            icon={Boxes}
            color="text-[#22C55E]"
            items={PRESET_BUILD_MATERIALS}
            values={materials.buildMaterials}
            onChange={(idx, val) => {
              setMaterials((prev) => {
                const next = [...prev.buildMaterials];
                next[idx] = val;
                return { ...prev, buildMaterials: next };
              });
            }}
          />
        </div>

        {/* 价格参数 */}
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">价格参数</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">蓝图参考价（亿）</label>
              <input
                type="text"
                inputMode="decimal"
                value={blueprintPrice === 0 ? '' : String(blueprintPrice)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                  setBlueprintPrice(v === '' ? 0 : parseFloat(v) || 0);
                }}
                placeholder="0"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">固定制造费（亿）</label>
              <input
                type="text"
                inputMode="decimal"
                value={fixedFee === 0 ? '' : String(fixedFee)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                  setFixedFee(v === '' ? 0 : parseFloat(v) || 0);
                }}
                placeholder="0"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">收购参考价（亿）</label>
              <input
                type="text"
                inputMode="decimal"
                value={buyPrice === 0 ? '' : String(buyPrice)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                  setBuyPrice(v === '' ? 0 : parseFloat(v) || 0);
                }}
                placeholder="0"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">挂单参考价（亿）</label>
              <input
                type="text"
                inputMode="decimal"
                value={sellPrice === 0 ? '' : String(sellPrice)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                  setSellPrice(v === '' ? 0 : parseFloat(v) || 0);
                }}
                placeholder="0"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? '保存中...' : '保存项目'}
        </button>
      </div>
    </div>
  );
}
