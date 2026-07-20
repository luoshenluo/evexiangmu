import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronUp, Check, Trash2, Edit3, ArrowLeft, Save, Plus,
  Ship, Coins, FileText, Tag, TrendingUp, Gem, Rocket, Boxes, ChevronRight,
  Search, Shield, Swords, Anchor, Factory, Crosshair,
} from 'lucide-react';
import type { IManufactureProject, IProjectMaterials, IMaterialItem } from '@/data/materials';
import { PRESET_MINERALS, PRESET_SHIP_MATERIALS, PRESET_BUILD_MATERIALS } from '@/data/materials';
import { formatNumber } from '@/lib/utils';
import { loadAdminProjects, addAdminProject, updateAdminProject, deleteAdminProject } from '@/lib/admin-projects';
import { emptyMaterials } from '@/components/shared/emptyMaterials';

const CATEGORY_CONFIG: Record<string, { icon: typeof Ship; color: string }> = {
  '护卫舰级': { icon: Shield, color: 'text-[#22C55E]' },
  '驱逐舰级': { icon: Swords, color: 'text-[#F59E0B]' },
  '巡洋舰级': { icon: Crosshair, color: 'text-[#06B6D4]' },
  '战巡舰级': { icon: Anchor, color: 'text-[#A78BFA]' },
  '战列舰级': { icon: Ship, color: 'text-[#EF4444]' },
  '工业舰':   { icon: Factory, color: 'text-[#FB923C]' },
};
const DEFAULT_CAT_CONFIG = { icon: Ship, color: 'text-[#888888]' };

interface ProjectSectionProps {
  onImportCost: (project: IManufactureProject) => void;
  onImportMaterials: (materials: { minerals: IMaterialItem[]; shipMaterials: IMaterialItem[]; buildMaterials: IMaterialItem[] }) => void;
  onSwitchToCalc: () => void;
  onSwitchToMinerals: () => void;
  currentMinerals: IMaterialItem[];
  currentShipMaterials: IMaterialItem[];
  currentBuildMaterials: IMaterialItem[];
}

type ViewMode = 'detail' | 'create' | 'edit';

function MaterialGroup({ title, icon: Icon, items, quantities, onChange, color }: {
  title: string; icon: typeof Gem; items: { name: string }[]; quantities: number[]; onChange?: (index: number, value: number) => void; defaultOpen?: boolean; color: string;
}) {
  const [open, setOpen] = useState(false);
  const isEditable = !!onChange;
  const getQty = (idx: number): number => (quantities[idx] ?? 0);

  return (
    <div className="rounded-lg border border-[#3A3A3A] bg-[#1E1E1E]/60 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[#3A3A3A]/30">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-medium text-white">{title}</span>
          <span className="text-[11px] text-[#888888]">({items.length}项)</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-[#888888]" /> : <ChevronDown className="h-4 w-4 text-[#888888]" />}
      </button>
      {open && (
        <div className="border-t border-[#3A3A3A] max-h-64 overflow-y-auto">
          {items.map((item, idx) => (
            <div key={item.name} className="flex items-center justify-between px-3 py-2 border-b border-[#3A3A3A]/50 last:border-b-0">
              <span className="text-xs text-[#A0A0A0] truncate flex-1">{item.name}</span>
              {isEditable ? (
                <input type="text" inputMode="numeric" value={getQty(idx) === 0 ? '' : String(getQty(idx))}
                  onChange={(e) => { const raw = e.target.value; if (raw !== '' && !/^\d*$/.test(raw)) return; onChange?.(idx, raw === '' ? 0 : parseInt(raw, 10) || 0); }}
                  placeholder="0"
                  className="w-24 rounded-md border border-[#444444] bg-[#2C2C2C] px-2 py-1 text-right text-xs text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums" />
              ) : (
                <span className="text-xs font-medium text-white tabular-nums">{getQty(idx).toLocaleString()}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">个</span></span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectSection({ onImportCost, onImportMaterials, onSwitchToCalc, onSwitchToMinerals, currentMinerals, currentShipMaterials, currentBuildMaterials }: ProjectSectionProps) {
  const [projects, setProjects] = useState<IManufactureProject[]>([]);
  const [, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAdminProjects();
      setProjects(data);
      if (data.length > 0 && !selectedIdRef.current) setSelectedId(data[0].id);
    } catch (err) { console.error('[ProjectSection] fetchProjects error:', err); toast.error('加载项目失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, []);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBlueprint, setFormBlueprint] = useState(0);
  const [formFixedFee, setFormFixedFee] = useState(0);
  const [formBuyPrice, setFormBuyPrice] = useState(0);
  const [formSellPrice, setFormSellPrice] = useState(0);
  const [formMaterials, setFormMaterials] = useState<IProjectMaterials>(emptyMaterials());

  const selected = useMemo(() => projects.find((p) => p.id === selectedId) ?? projects[0], [projects, selectedId]);

  const handleAddNew = () => {
    setFormName(''); setFormCategory(''); setFormBlueprint(0); setFormFixedFee(0);
    setFormBuyPrice(0); setFormSellPrice(0); setFormMaterials(emptyMaterials());
    setViewMode('create');
  };

  const handleEdit = () => {
    if (!selected) return;
    setFormName(selected.name); setFormCategory(selected.category);
    setFormBlueprint(selected.blueprintPrice); setFormFixedFee(selected.fixedManufactureFee);
    setFormBuyPrice(selected.buyOrderPrice); setFormSellPrice(selected.marketSellPrice);
    setFormMaterials(selected.materials ?? emptyMaterials());
    setViewMode('edit');
  };

  const handleBackToDetail = () => setViewMode('detail');

  const calcMaterialCost = (mats: IProjectMaterials) => {
    let total = 0;
    mats.minerals.forEach((q, i) => { total += ((currentMinerals[i]?.price ?? 0) * q) / 100000000; });
    mats.shipMaterials.forEach((q, i) => { total += ((currentShipMaterials[i]?.price ?? 0) * q) / 100000000; });
    mats.buildMaterials.forEach((q, i) => { total += ((currentBuildMaterials[i]?.price ?? 0) * q) / 100000000; });
    return total;
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('请输入项目名称'); return; }
    setSaving(true);
    try {
      const materialCost = calcMaterialCost(formMaterials);
      if (viewMode === 'create') {
        const newProject = await addAdminProject({ name: formName.trim(), category: formCategory.trim() || '自定义', materialCost150: materialCost, blueprintPrice: formBlueprint, fixedManufactureFee: formFixedFee, buyOrderPrice: formBuyPrice, marketSellPrice: formSellPrice, materials: formMaterials });
        setProjects((prev) => [...prev, newProject]);
        setSelectedId(newProject.id);
        toast.success('项目已保存');
      } else if (selected) {
        const updates: Partial<IManufactureProject> = { name: formName.trim(), category: formCategory.trim() || '自定义', materialCost150: materialCost, blueprintPrice: formBlueprint, fixedManufactureFee: formFixedFee, buyOrderPrice: formBuyPrice, marketSellPrice: formSellPrice, materials: formMaterials };
        await updateAdminProject(selected.id, updates);
        setProjects((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...updates } : p)));
        toast.success('项目已更新');
      }
      setViewMode('detail');
    } catch (err) { console.error('[ProjectSection] save error:', err); toast.error('保存失败，请检查网络'); }
    finally { setSaving(false); }
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
    } catch (err) { console.error('[ProjectSection] delete error:', err); toast.error('删除失败，请检查网络'); }
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
    if (!mats) { toast.error('该项目没有材料明细数据'); return; }
    onImportMaterials({
      minerals: PRESET_MINERALS.map((m, i) => ({ ...m, price: currentMinerals[i]?.price ?? 0, quantity: mats.minerals[i] ?? 0 })),
      shipMaterials: PRESET_SHIP_MATERIALS.map((m, i) => ({ ...m, price: currentShipMaterials[i]?.price ?? 0, quantity: mats.shipMaterials[i] ?? 0 })),
      buildMaterials: PRESET_BUILD_MATERIALS.map((m, i) => ({ ...m, price: currentBuildMaterials[i]?.price ?? 0, quantity: mats.buildMaterials[i] ?? 0 })),
    });
    toast.success(`已导入「${selected.name}」材料数量到录入页`);
    setTimeout(() => onSwitchToMinerals(), 300);
  };

  if (viewMode !== 'detail') {
    return (
      <div className="h-full overflow-y-auto pb-24">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <button onClick={handleBackToDetail} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] text-white transition-colors hover:border-[#555555]"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex-1"><h2 className="text-lg font-semibold text-white">{viewMode === 'create' ? '新建项目' : '编辑项目'}</h2></div>
          {viewMode === 'edit' && (
            <button onClick={() => setShowDeleteConfirm(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#7F1D1D] bg-[#7F1D1D]/20 text-[#EF4444] transition-colors hover:bg-[#7F1D1D]/40"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
        <div className="px-4 pt-2">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">基本信息</h3>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">项目名称</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="输入舰船/项目名称" className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30" />
            </div>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">分类标签（可选）</label>
              <input type="text" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="如：护卫舰级、驱逐舰级" className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30" />
            </div>
          </div>
        </div>
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">材料数量明细</h3>
            <p className="text-[11px] text-[#888888] -mt-1">填入各项材料数量，保存时自动按当前单价计算150%材料成本</p>
            <MaterialGroup title="矿物明细" icon={Gem} color="text-[#F59E0B]" items={PRESET_MINERALS} quantities={formMaterials.minerals} onChange={(idx, val) => setFormMaterials((prev) => { const next = [...prev.minerals]; next[idx] = val; return { ...prev, minerals: next }; })} />
            <MaterialGroup title="船材明细" icon={Rocket} color="text-[#06B6D4]" items={PRESET_SHIP_MATERIALS} quantities={formMaterials.shipMaterials} onChange={(idx, val) => setFormMaterials((prev) => { const next = [...prev.shipMaterials]; next[idx] = val; return { ...prev, shipMaterials: next }; })} />
            <MaterialGroup title="建材明细" icon={Boxes} color="text-[#22C55E]" items={PRESET_BUILD_MATERIALS} quantities={formMaterials.buildMaterials} onChange={(idx, val) => setFormMaterials((prev) => { const next = [...prev.buildMaterials]; next[idx] = val; return { ...prev, buildMaterials: next }; })} />
          </div>
        </div>
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">其他参数</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '蓝图参考价（亿）', value: formBlueprint, set: setFormBlueprint },
                { label: '固定制造费（亿）', value: formFixedFee, set: setFormFixedFee },
                { label: '收购参考价（亿）', value: formBuyPrice, set: setFormBuyPrice },
                { label: '挂单参考价（亿）', value: formSellPrice, set: setFormSellPrice },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs text-[#A0A0A0] mb-1 block">{f.label}</label>
                  <input type="text" inputMode="decimal" value={f.value === 0 ? '' : String(f.value)}
                    onChange={(e) => { const v = e.target.value; if (v !== '' && !/^\d*\.?\d*$/.test(v)) return; f.set(v === '' ? 0 : parseFloat(v) || 0); }}
                    placeholder="0" className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-4 pt-5">
          <button onClick={handleSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-60">
            <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />{saving ? '保存中...' : '保存项目'}
          </button>
        </div>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
            <div className="w-full max-w-sm rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-white">确认删除</h3>
              <p className="mt-2 text-sm text-[#A0A0A0]">确定要删除「{selected?.name}」吗？删除后无法恢复。</p>
              <div className="mt-5 flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-lg border border-[#444444] bg-[#1E1E1E] py-2.5 text-sm text-white transition-colors hover:bg-[#363636]">取消</button>
                <button onClick={handleDelete} className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C]">删除</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const categories = useMemo(() => {
    const map = new Map<string, IManufactureProject[]>();
    projects.forEach((p) => { const cat = p.category || '其他'; if (!map.has(cat)) map.set(cat, []); map.get(cat)!.push(p); });
    return map;
  }, [projects]);
  const categoryNames = useMemo(() => [...categories.keys()], [categories]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => { if (categoryNames.length > 0 && !categoryNames.includes(activeCat)) setActiveCat(categoryNames[0]); }, [categoryNames, activeCat]);

  const currentCatProjects = useMemo(() => {
    let list = categories.get(activeCat) ?? [];
    if (searchText.trim()) { const kw = searchText.trim().toLowerCase(); list = list.filter((p) => p.name.toLowerCase().includes(kw)); }
    return list;
  }, [categories, activeCat, searchText]);

  const handleCategoryChange = (cat: string) => {
    setActiveCat(cat);
    const list = categories.get(cat);
    if (list && list.length > 0) setSelectedId(list[0].id);
    setViewMode('detail');
  };

  // 手机端选中后切换视图，避免上下滚动
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const handleMobileSelect = (project: IManufactureProject) => {
    setSelectedId(project.id);
    setViewMode('detail');
    setMobileShowDetail(true);
  };

  if (mobileShowDetail && selected) {
    return (
      <div className="h-full overflow-y-auto pb-24">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <button onClick={() => setMobileShowDetail(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] text-white transition-colors hover:border-[#555555] md:hidden"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{selected.name}</h2>
            <p className="text-xs text-[#A0A0A0]">{selected.category}</p>
          </div>
          <button onClick={handleEdit} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] text-white transition-colors hover:border-[#555555] md:hidden"><Edit3 className="h-4 w-4" /></button>
        </div>
        <div className="px-4 pt-1">
          <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_2px_8px_rgba(0_0_0_0.2)] overflow-hidden">
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                  <div className="flex items-center gap-2"><Coins className="h-4 w-4 text-[#F59E0B]" /><span className="text-xs text-[#A0A0A0]">材料成本</span></div>
                  <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(selected.materialCost150)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#06B6D4]" /><span className="text-xs text-[#A0A0A0]">蓝图价</span></div>
                  <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(selected.blueprintPrice)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                  <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-[#EC4899]" /><span className="text-xs text-[#A0A0A0]">制造费</span></div>
                  <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(selected.fixedManufactureFee)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                  <div className="text-[11px] text-[#888888] mb-1">收购单参考价</div>
                  <div className="text-sm font-semibold text-[#22C55E] tabular-nums">{formatNumber(selected.buyOrderPrice)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></div>
                </div>
                <div className="rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                  <div className="text-[11px] text-[#888888] mb-1">挂单参考价</div>
                  <div className="text-sm font-semibold text-[#F59E0B] tabular-nums">{formatNumber(selected.marketSellPrice)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {selected.materials && (
          <div className="px-4 pt-4">
            <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">材料数量明细</h3>
              <MaterialGroup title="矿物明细" icon={Gem} color="text-[#F59E0B]" items={PRESET_MINERALS} quantities={selected.materials.minerals} />
              <MaterialGroup title="船材明细" icon={Rocket} color="text-[#06B6D4]" items={PRESET_SHIP_MATERIALS} quantities={selected.materials.shipMaterials} />
              <MaterialGroup title="建材明细" icon={Boxes} color="text-[#22C55E]" items={PRESET_BUILD_MATERIALS} quantities={selected.materials.buildMaterials} />
            </div>
          </div>
        )}
        <div className="px-4 pt-5 space-y-3">
          <button onClick={handleImportCost} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98]"><TrendingUp className="h-4 w-4" />导入总成本到计算页<ChevronRight className="h-4 w-4" /></button>
          <button onClick={handleImportMaterials} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#7C3AED]/50 bg-[#7C3AED]/10 px-4 py-3.5 text-sm font-semibold text-[#A78BFA] transition-all hover:bg-[#7C3AED]/20 active:scale-[0.98]"><Boxes className="h-4 w-4" />导入材料明细到录入页<ChevronRight className="h-4 w-4" /></button>
          <p className="text-center text-[11px] text-[#888888]">导入材料明细会保留你已设置的单价，自动填入数量并联动计算</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      <div className="w-full md:w-80 lg:w-96 md:border-r md:border-[#3A3A3A] md:flex-shrink-0 md:overflow-y-auto pb-24 md:pb-0">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-white">制造项目</h2>
          <p className="mt-1 text-sm text-[#A0A0A0]">选择舰船项目，一键导入材料成本或材料明细</p>
        </div>
        <div className="px-4 pt-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categoryNames.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat] ?? DEFAULT_CAT_CONFIG;
              const Icon = cfg.icon;
              const count = categories.get(cat)?.length ?? 0;
              const isActive = cat === activeCat;
              return (
                <button key={cat} onClick={() => handleCategoryChange(cat)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${isActive ? 'border-[#7C3AED] bg-[#7C3AED]/15 ' + cfg.color : 'border-[#3A3A3A] bg-[#2C2C2C] text-[#888888] hover:border-[#555555] hover:text-white'}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span>{cat}</span>
                  <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-[#666666]'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 pt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
            <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={`在${activeCat || '全部'}中搜索...`}
              className="w-full rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] py-2.5 pl-9 pr-3 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30" />
          </div>
          <button onClick={handleAddNew} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#7C3AED]/50 bg-[#7C3AED]/10 px-3 py-2.5 text-xs font-medium text-[#A78BFA] transition-all hover:bg-[#7C3AED]/20"><Plus className="h-4 w-4" />新建</button>
        </div>
        <div className="px-4 pt-3 space-y-2">
          {currentCatProjects.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#666666]">{searchText ? '没有匹配的项目' : '该分类暂无项目'}</div>
          ) : (
            currentCatProjects.map((project) => {
              const isSelected = project.id === selectedId;
              return (
                <button key={project.id} onClick={() => handleMobileSelect(project)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${isSelected ? 'border-[#7C3AED] bg-[#7C3AED]/10 shadow-[0_0_12px_rgba(124_58_237_0.15)]' : 'border-[#3A3A3A] bg-[#2C2C2C] hover:border-[#555555] active:scale-[0.99]'}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E1E1E] border border-[#3A3A3A]"><Ship className="h-5 w-5 text-[#A78BFA]" /></div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-[#E0E0E0]'}`}>{project.name}</div>
                    <div className="text-[11px] text-[#888888] mt-0.5">制造费 {formatNumber(project.fixedManufactureFee)} 亿{project.materials && <span className="ml-2">矿{project.materials.minerals?.reduce((a, b) => a + b, 0) || 0} 船{project.materials.shipMaterials?.reduce((a, b) => a + b, 0) || 0}</span>}</div>
                  </div>
                  {isSelected && <Check className="h-5 w-5 shrink-0 text-[#A78BFA]" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="hidden md:flex md:flex-1 overflow-y-auto md:pb-0">
        {selected ? (
          <>
            <div className="px-4 pt-4">
              <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_2px_8px_rgba(0_0_0_0.2)] overflow-hidden">
                <div className="border-b border-[#3A3A3A] px-4 py-4 bg-gradient-to-r from-[#7C3AED]/10 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#7C3AED]/20 text-[#A78BFA]"><Ship className="h-6 w-6" /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-white truncate">{selected.name}</h3>
                      <p className="text-xs text-[#A0A0A0]">{selected.category}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                      <div className="flex items-center gap-2"><Coins className="h-4 w-4 text-[#F59E0B]" /><span className="text-xs text-[#A0A0A0]">材料成本</span></div>
                      <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(selected.materialCost150)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                      <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#06B6D4]" /><span className="text-xs text-[#A0A0A0]">蓝图价</span></div>
                      <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(selected.blueprintPrice)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                      <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-[#EC4899]" /><span className="text-xs text-[#A0A0A0]">制造费</span></div>
                      <span className="text-sm font-semibold text-white tabular-nums">{formatNumber(selected.fixedManufactureFee)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                      <div className="text-[11px] text-[#888888] mb-1">收购单参考价</div>
                      <div className="text-sm font-semibold text-[#22C55E] tabular-nums">{formatNumber(selected.buyOrderPrice)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></div>
                    </div>
                    <div className="rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-3 py-2.5">
                      <div className="text-[11px] text-[#888888] mb-1">挂单参考价</div>
                      <div className="text-sm font-semibold text-[#F59E0B] tabular-nums">{formatNumber(selected.marketSellPrice)}<span className="ml-0.5 text-[10px] font-normal text-[#888888]">亿</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {selected.materials && (
              <div className="px-4 pt-4">
                <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-white">材料数量明细</h3>
                  <MaterialGroup title="矿物明细" icon={Gem} color="text-[#F59E0B]" items={PRESET_MINERALS} quantities={selected.materials.minerals} />
                  <MaterialGroup title="船材明细" icon={Rocket} color="text-[#06B6D4]" items={PRESET_SHIP_MATERIALS} quantities={selected.materials.shipMaterials} />
                  <MaterialGroup title="建材明细" icon={Boxes} color="text-[#22C55E]" items={PRESET_BUILD_MATERIALS} quantities={selected.materials.buildMaterials} />
                </div>
              </div>
            )}
            <div className="px-4 pt-5 space-y-3">
              <button onClick={handleImportCost} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98]"><TrendingUp className="h-4 w-4" />导入总成本到计算页<ChevronRight className="h-4 w-4" /></button>
              <button onClick={handleImportMaterials} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#7C3AED]/50 bg-[#7C3AED]/10 px-4 py-3.5 text-sm font-semibold text-[#A78BFA] transition-all hover:bg-[#7C3AED]/20 active:scale-[0.98]"><Boxes className="h-4 w-4" />导入材料明细到录入页<ChevronRight className="h-4 w-4" /></button>
              <p className="text-center text-[11px] text-[#888888]">导入材料明细会保留你已设置的单价，自动填入数量并联动计算</p>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[#666]">
            <div className="text-center"><Ship className="mx-auto h-12 w-12 opacity-30" /><p className="mt-2 text-sm">请从左侧选择一个项目</p></div>
          </div>
        )}
      </div>

      {showDeleteConfirm && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white">确认删除</h3>
            <p className="mt-2 text-sm text-[#A0A0A0]">确定要删除「{selected.name}」吗？删除后无法恢复。</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-lg border border-[#444444] bg-[#1E1E1E] py-2.5 text-sm text-white transition-colors hover:bg-[#363636]">取消</button>
              <button onClick={handleDelete} className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C]">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
