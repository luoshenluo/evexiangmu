import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Trash2,
  Edit3,
  ArrowLeft,
  Save,
  Ship,
  Coins,
  FileText,
  Tag,
  TrendingUp,
  Gem,
  Rocket,
  Boxes,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type {
  IManufactureProject,
  IProjectMaterials,
  IMaterialItem,
} from '@/data/materials';
import {
  MANUFACTURE_PROJECTS,
  PRESET_MINERALS,
  PRESET_SHIP_MATERIALS,
  PRESET_BUILD_MATERIALS,
} from '@/data/materials';
import { formatNumber } from '@/lib/utils';
import { loadAdminProjects, addAdminProject, updateAdminProject, deleteAdminProject } from '@/lib/admin-projects';

interface ProjectSectionProps {
  onImportCost: (project: IManufactureProject) => void;
  onImportMaterials: (materials: {
    minerals: IMaterialItem[];
    shipMaterials: IMaterialItem[];
    buildMaterials: IMaterialItem[];
  }) => void;
  onSwitchToCalc: () => void;
  onSwitchToMinerals: () => void;
  currentMinerals: IMaterialItem[];
  currentShipMaterials: IMaterialItem[];
  currentBuildMaterials: IMaterialItem[];
}

type ViewMode = 'detail' | 'create' | 'edit';

/** 创建空的材料数量数组 */
function emptyMaterials(): IProjectMaterials {
  return {
    minerals: new Array(PRESET_MINERALS.length).fill(0),
    shipMaterials: new Array(PRESET_SHIP_MATERIALS.length).fill(0),
    buildMaterials: new Array(PRESET_BUILD_MATERIALS.length).fill(0),
  };
}

/** 可折叠的材料明细区块 */
function MaterialGroup({
  title,
  icon: Icon,
  items,
  quantities,
  onChange,
  color,
}: {
  title: string;
  icon: typeof Gem;
  items: { name: string }[];
  quantities: number[];
  onChange?: (index: number, value: number) => void;
  defaultOpen?: boolean;
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const isEditable = !!onChange;

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
        <div className="border-t border-[#3A3A3A] max-h-64 overflow-y-auto">
          {items.map((item, idx) => (
            <div
              key={item.name}
              className="flex items-center justify-between px-3 py-2 border-b border-[#3A3A3A]/50 last:border-b-0"
            >
              <span className="text-xs text-[#A0A0A0] truncate flex-1">{item.name}</span>
              {isEditable ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantities[idx] === 0 ? '' : String(quantities[idx])}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw !== '' && !/^\d*$/.test(raw)) return;
                    onChange?.(idx, raw === '' ? 0 : parseInt(raw, 10) || 0);
                  }}
                  placeholder="0"
                  className="w-24 rounded-md border border-[#444444] bg-[#2C2C2C] px-2 py-1 text-right text-xs text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums"
                />
              ) : (
                <span className="text-xs font-medium text-white tabular-nums">
                  {quantities[idx].toLocaleString()}
                  <span className="ml-0.5 text-[10px] font-normal text-[#888888]">个</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectSection({
  onImportCost,
  onImportMaterials,
  onSwitchToCalc,
  onSwitchToMinerals,
  currentMinerals,
  currentShipMaterials,
  currentBuildMaterials,
}: ProjectSectionProps) {
  const [projects, setProjects] = useState<IManufactureProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 从 Supabase 云端加载项目
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const data = await loadAdminProjects();
    setProjects(data);
    if (data.length > 0 && !selectedId) {
      setSelectedId(data[0].id);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    fetchProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 新建/编辑表单状态
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBlueprint, setFormBlueprint] = useState(0);
  const [formFixedFee, setFormFixedFee] = useState(0);
  const [formBuyPrice, setFormBuyPrice] = useState(0);
  const [formSellPrice, setFormSellPrice] = useState(0);
  const [formMaterials, setFormMaterials] = useState<IProjectMaterials>(emptyMaterials());

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? projects[0],
    [projects, selectedId],
  );



  const handleSelect = (project: IManufactureProject) => {
    setSelectedId(project.id);
    setIsOpen(false);
    setViewMode('detail');
  };

  const handleAddNew = () => {
    setIsOpen(false);
    setFormName('');
    setFormCategory('');
    setFormBlueprint(0);
    setFormFixedFee(0);
    setFormBuyPrice(0);
    setFormSellPrice(0);
    setFormMaterials(emptyMaterials());
    setViewMode('create');
  };

  const handleEdit = () => {
    if (!selected) return;
    setFormName(selected.name);
    setFormCategory(selected.category);
    setFormBlueprint(selected.blueprintPrice);
    setFormFixedFee(selected.fixedManufactureFee);
    setFormBuyPrice(selected.buyOrderPrice);
    setFormSellPrice(selected.marketSellPrice);
    setFormMaterials(selected.materials ?? emptyMaterials());
    setViewMode('edit');
  };

  const handleBackToDetail = () => {
    setViewMode('detail');
  };

  // 计算材料总成本（使用当前录入页的单价 × 数量 ÷ 1亿）
  const calcMaterialCost = (mats: IProjectMaterials) => {
    let total = 0;
    mats.minerals.forEach((q, i) => {
      const price = currentMinerals[i]?.price || 0;
      total += (price * q) / 100000000;
    });
    mats.shipMaterials.forEach((q, i) => {
      const price = currentShipMaterials[i]?.price || 0;
      total += (price * q) / 100000000;
    });
    mats.buildMaterials.forEach((q, i) => {
      const price = currentBuildMaterials[i]?.price || 0;
      total += (price * q) / 100000000;
    });
    return total;
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('请输入项目名称');
      return;
    }
    setSaving(true);

    try {
      const materialCost = calcMaterialCost(formMaterials);

      if (viewMode === 'create') {
        const newProject = await addAdminProject({
          name: formName.trim(),
          category: formCategory.trim() || '自定义',
          materialCost150: materialCost,
          blueprintPrice: formBlueprint,
          fixedManufactureFee: formFixedFee,
          buyOrderPrice: formBuyPrice,
          marketSellPrice: formSellPrice,
          materials: formMaterials,
        });
        setProjects((prev) => [...prev, newProject]);
        setSelectedId(newProject.id);
        toast.success('项目已保存');
      } else if (selected) {
        const updates: Partial<IManufactureProject> = {
          name: formName.trim(),
          category: formCategory.trim() || '自定义',
          materialCost150: materialCost,
          blueprintPrice: formBlueprint,
          fixedManufactureFee: formFixedFee,
          buyOrderPrice: formBuyPrice,
          marketSellPrice: formSellPrice,
          materials: formMaterials,
        };
        await updateAdminProject(selected.id, updates);
        setProjects((prev) =>
          prev.map((p) => (p.id === selected.id ? { ...p, ...updates } : p)),
        );
        toast.success('项目已更新');
      }
      setViewMode('detail');
    } catch (err) {
      console.error('[ProjectSection] save error:', err);
      toast.error('保存失败，请检查网络');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deleteAdminProject(selected.id);
      const remaining = projects.filter((p) => p.id !== selected.id);
      setProjects(remaining);
      setSelectedId(remaining[0]?.id ?? '');
      setShowDeleteConfirm(false);
      setViewMode('detail');
      toast.success('项目已删除');
    } catch (err) {
      console.error('[ProjectSection] delete error:', err);
      toast.error('删除失败，请检查网络');
    }
  };

  const handleImportCost = () => {
    if (!selected) return;
    onImportCost(selected);
    toast.success(`已导入「${selected.name}」成本数据`);
    setTimeout(() => onSwitchToCalc(), 300);
  };

  const handleImportMaterials = () => {
    if (!selected) return;
    const mats = selected.materials;
    if (!mats) {
      toast.error('该项目没有材料明细数据');
      return;
    }
    const newMinerals = PRESET_MINERALS.map((m, i) => ({
      ...m,
      price: currentMinerals[i]?.price || 0,
      quantity: mats.minerals[i] || 0,
    }));
    const newShipMaterials = PRESET_SHIP_MATERIALS.map((m, i) => ({
      ...m,
      price: currentShipMaterials[i]?.price || 0,
      quantity: mats.shipMaterials[i] || 0,
    }));
    const newBuildMaterials = PRESET_BUILD_MATERIALS.map((m, i) => ({
      ...m,
      price: currentBuildMaterials[i]?.price || 0,
      quantity: mats.buildMaterials[i] || 0,
    }));
    onImportMaterials({
      minerals: newMinerals,
      shipMaterials: newShipMaterials,
      buildMaterials: newBuildMaterials,
    });
    toast.success(`已导入「${selected.name}」材料数量到录入页`);
    setTimeout(() => onSwitchToMinerals(), 300);
  };

  // ========== 新建/编辑视图 ==========
  if (viewMode !== 'detail') {
    return (
      <div className="h-full overflow-y-auto pb-24">
        {/* 顶部返回栏 */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <button
            onClick={handleBackToDetail}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] text-white transition-colors hover:border-[#555555]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              {viewMode === 'create' ? '新建项目' : '编辑项目'}
            </h2>
          </div>
          {viewMode === 'edit' && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#7F1D1D] bg-[#7F1D1D]/20 text-[#EF4444] transition-colors hover:bg-[#7F1D1D]/40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 基本信息 */}
        <div className="px-4 pt-2">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">基本信息</h3>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">项目名称</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="输入舰船/项目名称"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
              />
            </div>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">分类标签（可选）</label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="如：护卫舰级、驱逐舰级"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
              />
            </div>
          </div>
        </div>

        {/* 材料明细 */}
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">材料数量明细</h3>
            <p className="text-[11px] text-[#888888] -mt-1">
              填入各项材料数量，保存时自动按当前单价计算150%材料成本
            </p>
            <MaterialGroup
              title="矿物明细"
              icon={Gem}
              color="text-[#F59E0B]"
              items={PRESET_MINERALS}
              quantities={formMaterials.minerals}
              onChange={(idx, val) =>
                setFormMaterials((prev) => {
                  const next = [...prev.minerals];
                  next[idx] = val;
                  return { ...prev, minerals: next };
                })
              }
            />
            <MaterialGroup
              title="船材明细"
              icon={Rocket}
              color="text-[#06B6D4]"
              items={PRESET_SHIP_MATERIALS}
              quantities={formMaterials.shipMaterials}
              onChange={(idx, val) =>
                setFormMaterials((prev) => {
                  const next = [...prev.shipMaterials];
                  next[idx] = val;
                  return { ...prev, shipMaterials: next };
                })
              }
            />
            <MaterialGroup
              title="建材明细"
              icon={Boxes}
              color="text-[#22C55E]"
              items={PRESET_BUILD_MATERIALS}
              quantities={formMaterials.buildMaterials}
              onChange={(idx, val) =>
                setFormMaterials((prev) => {
                  const next = [...prev.buildMaterials];
                  next[idx] = val;
                  return { ...prev, buildMaterials: next };
                })
              }
            />
          </div>
        </div>

        {/* 其他参数 */}
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">其他参数</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#A0A0A0] mb-1 block">蓝图参考价（亿）</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formBlueprint === 0 ? '' : String(formBlueprint)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                    setFormBlueprint(v === '' ? 0 : parseFloat(v) || 0);
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
                  value={formFixedFee === 0 ? '' : String(formFixedFee)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                    setFormFixedFee(v === '' ? 0 : parseFloat(v) || 0);
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
                  value={formBuyPrice === 0 ? '' : String(formBuyPrice)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                    setFormBuyPrice(v === '' ? 0 : parseFloat(v) || 0);
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
                  value={formSellPrice === 0 ? '' : String(formSellPrice)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                    setFormSellPrice(v === '' ? 0 : parseFloat(v) || 0);
                  }}
                  placeholder="0"
                  className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="px-4 pt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-60"
          >
            <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
            {saving ? '保存中...' : '保存项目'}
          </button>
        </div>

        {/* 删除确认弹层 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
            <div className="w-full max-w-sm rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-white">确认删除</h3>
              <p className="mt-2 text-sm text-[#A0A0A0]">
                确定要删除「{selected?.name}」吗？删除后无法恢复。
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-lg border border-[#444444] bg-[#1E1E1E] py-2.5 text-sm text-white transition-colors hover:bg-[#363636]"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C]"
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

  // ========== 详情视图 ==========
  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* 页面标题 */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-lg font-semibold text-white">制造项目</h2>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          选择舰船项目，一键导入材料成本或材料明细
        </p>
      </div>

      {/* 下拉选择器 */}
      <div className="px-4 pt-2">
        <div className="relative">
          <div
            onClick={() => setIsOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] px-4 py-3.5 text-left shadow-[0_2px_8px_rgba(0_0_0_0.2)] transition-all hover:border-[#555555] cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7C3AED]/15 text-[#A78BFA]">
                <Ship className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {selected?.name ?? '请选择项目'}
                </div>
                <div className="text-[11px] text-[#888888]">{selected?.category}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit();
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#444444] bg-[#1E1E1E] text-[#A0A0A0] transition-colors hover:border-[#7C3AED] hover:text-[#A78BFA]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
              {selected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#444444] bg-[#1E1E1E] text-[#A0A0A0] transition-colors hover:border-[#DC2626] hover:text-[#EF4444]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {isOpen ? (
                <ChevronUp className="h-5 w-5 shrink-0 text-[#888888]" />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-[#888888]" />
              )}
            </div>
          </div>

          {/* 下拉列表 */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_8px_24px_rgba(0_0_0_0.4)]">
              {projects.map((project) => {
                const isSelected = project.id === selectedId;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelect(project)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-[#3A3A3A]/50 last:border-b-0 ${
                      isSelected
                        ? 'bg-[#7C3AED]/15 text-white'
                        : 'text-[#A0A0A0] hover:bg-[#3A3A3A]/50 hover:text-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{project.name}</div>
                      <div className="text-[11px] text-[#888888]">{project.category}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[#A78BFA]" />}
                  </button>
                );
              })}

              {/* 添加新项目 */}
              <button
                onClick={handleAddNew}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[#A78BFA] transition-colors border-t border-[#3A3A3A] hover:bg-[#7C3AED]/10"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">添加新项目</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 项目详情卡片 */}
      {selected && (
        <div className="px-4 pt-5">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_2px_8px_rgba(0_0_0_0.2)] overflow-hidden">
            {/* 卡片头部 */}
            <div className="border-b border-[#3A3A3A] px-4 py-4 bg-gradient-to-r from-[#7C3AED]/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#7C3AED]/20 text-[#A78BFA]">
                  <Ship className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-white truncate">{selected.name}</h3>
                  <p className="text-xs text-[#A0A0A0]">{selected.category}</p>
                </div>
              </div>
            </div>

            {/* 详情列表 */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[#F59E0B]" />
                  <span className="text-sm text-[#A0A0A0]">150%效率材料成本</span>
                </div>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {formatNumber(selected.materialCost150)}
                  <span className="ml-1 text-[11px] font-normal text-[#888888]">亿ISK</span>
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#06B6D4]" />
                  <span className="text-sm text-[#A0A0A0]">蓝图市场参考价</span>
                </div>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {formatNumber(selected.blueprintPrice)}
                  <span className="ml-1 text-[11px] font-normal text-[#888888]">亿ISK</span>
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#EC4899]" />
                  <span className="text-sm text-[#A0A0A0]">固定制造费</span>
                </div>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {formatNumber(selected.fixedManufactureFee)}
                  <span className="ml-1 text-[11px] font-normal text-[#888888]">亿ISK</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                  <div className="text-[11px] text-[#888888] mb-1">收购单参考价</div>
                  <div className="text-sm font-semibold text-[#22C55E] tabular-nums">
                    {formatNumber(selected.buyOrderPrice)}
                    <span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span>
                  </div>
                </div>
                <div className="rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                  <div className="text-[11px] text-[#888888] mb-1">挂单参考价</div>
                  <div className="text-sm font-semibold text-[#F59E0B] tabular-nums">
                    {formatNumber(selected.marketSellPrice)}
                    <span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 材料明细预览 */}
      {selected?.materials && (
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">材料数量明细</h3>
            <MaterialGroup
              title="矿物明细"
              icon={Gem}
              color="text-[#F59E0B]"
              items={PRESET_MINERALS}
              quantities={selected.materials.minerals}
            />
            <MaterialGroup
              title="船材明细"
              icon={Rocket}
              color="text-[#06B6D4]"
              items={PRESET_SHIP_MATERIALS}
              quantities={selected.materials.shipMaterials}
            />
            <MaterialGroup
              title="建材明细"
              icon={Boxes}
              color="text-[#22C55E]"
              items={PRESET_BUILD_MATERIALS}
              quantities={selected.materials.buildMaterials}
            />
          </div>
        </div>
      )}

      {/* 导入按钮 */}
      {selected && (
        <div className="px-4 pt-5 space-y-3">
          <button
            onClick={handleImportCost}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98]"
          >
            <TrendingUp className="h-4 w-4" />
            导入总成本到计算页
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            onClick={handleImportMaterials}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#7C3AED]/50 bg-[#7C3AED]/10 px-4 py-3.5 text-sm font-semibold text-[#A78BFA] transition-all hover:bg-[#7C3AED]/20 active:scale-[0.98]"
          >
            <Boxes className="h-4 w-4" />
            导入材料明细到录入页
            <ChevronRight className="h-4 w-4" />
          </button>

          <p className="text-center text-[11px] text-[#888888]">
            导入材料明细会保留你已设置的单价，自动填入数量并联动计算
          </p>
        </div>
      )}

      {/* 删除确认弹层 */}
      {showDeleteConfirm && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white">确认删除</h3>
            <p className="mt-2 text-sm text-[#A0A0A0]">
              确定要删除「{selected.name}」吗？删除后无法恢复。
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-[#444444] bg-[#1E1E1E] py-2.5 text-sm text-white transition-colors hover:bg-[#363636]"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C]"
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
