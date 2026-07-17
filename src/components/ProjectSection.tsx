import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Download,
  Trash2,
  Edit3,
  Check,
  X,
  Import,
  FolderKanban,
  Box,
  Pickaxe,
  Ship,
  Building2,
} from 'lucide-react';
import { formatNumber, sumMaterials } from '@/lib/utils';
import {
  loadAdminProjects,
  saveAdminProjects,
  addAdminProject,
  deleteAdminProject,
} from '@/lib/admin-projects';
import type { IMaterialItem, IManufactureProject, ICalcParams } from '@/data/materials';

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
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 编辑态表单
  const [editForm, setEditForm] = useState<Partial<IManufactureProject>>({});

  // 加载项目
  useEffect(() => {
    loadAdminProjects().then((data) => {
      setProjects(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    });
  }, []);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId),
    [projects, selectedId],
  );

  const filtered = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [projects, search],
  );

  const handleImportProject = (project: IManufactureProject) => {
    onImportCost(project);
    onSwitchToCalc();
    toast.success(`已导入「${project.name}」的成本参数`);
  };

  const handleImportAllMaterials = (project: IManufactureProject) => {
    const minerals = project.minerals.map((m) => ({ ...m, price: 0, quantity: 0 }));
    const shipMaterials = project.shipMaterials.map((m) => ({ ...m, price: 0, quantity: 0 }));
    const buildMaterials = project.buildMaterials.map((m) => ({ ...m, price: 0, quantity: 0 }));
    onImportMaterials({ minerals, shipMaterials, buildMaterials });
    onSwitchToMinerals();
    toast.success(`已导入「${project.name}」的材料清单`);
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteAdminProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) {
        const remaining = projects.filter((p) => p.id !== id);
        setSelectedId(remaining.length > 0 ? remaining[0].id : '');
      }
      toast.success('项目已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const handleEditProject = (project: IManufactureProject) => {
    setEditingId(project.id);
    setNewProject(false);
    setEditForm({
      name: project.name,
      materialCost150: project.materialCost150,
      blueprintPrice: project.blueprintPrice,
      fixedManufactureFee: project.fixedManufactureFee,
      buyOrderPrice: project.buyOrderPrice,
      marketSellPrice: project.marketSellPrice,
      minerals: project.minerals.map((m) => ({ ...m })),
      shipMaterials: project.shipMaterials.map((m) => ({ ...m })),
      buildMaterials: project.buildMaterials.map((m) => ({ ...m })),
    });
  };

  const handleAddNew = () => {
    setNewProject(true);
    setEditingId(null);
    setEditForm({
      name: '',
      materialCost150: 0,
      blueprintPrice: 0,
      fixedManufactureFee: 0,
      buyOrderPrice: 0,
      marketSellPrice: 0,
      minerals: [],
      shipMaterials: [],
      buildMaterials: [],
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name?.trim()) {
      toast.error('请输入项目名称');
      return;
    }

    try {
      if (newProject) {
        const created = await addAdminProject(editForm as IManufactureProject);
        setProjects((prev) => [...prev, created]);
        setSelectedId(created.id);
        toast.success('项目已创建');
      } else if (editingId) {
        const idx = projects.findIndex((p) => p.id === editingId);
        if (idx >= 0) {
          const updated = { ...projects[idx], ...editForm, updated_at: new Date().toISOString() };
          const updatedList = projects.map((p, i) => (i === idx ? updated : p));
          await saveAdminProjects(updatedList);
          setProjects(updatedList);
          toast.success('项目已更新');
        }
      }
      setEditingId(null);
      setNewProject(false);
    } catch {
      toast.error('保存失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewProject(false);
    setEditForm({});
  };

  // 更新材料的辅助函数
  const updateMaterialInForm = (
    category: 'minerals' | 'shipMaterials' | 'buildMaterials',
    index: number,
    field: 'name' | 'quantity' | 'price',
    value: string | number,
  ) => {
    setEditForm((prev) => {
      const list = [...(prev[category] || [])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, [category]: list };
    });
  };

  const toggleExpandMaterials = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* 选择项目区域 */}
      <div className="px-4 pt-4 space-y-3">
        {/* 搜索和新增 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
            <input
              type="text"
              placeholder="搜索项目..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#444444] bg-[#2C2C2C] py-2 pl-9 pr-3 text-sm text-white placeholder-[#666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
            />
          </div>
          <button
            onClick={handleAddNew}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-2 text-xs font-medium text-white transition-all hover:bg-[#6D28D9] active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">新建项目</span>
          </button>
        </div>

        {/* 项目列表 */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-[#666]">
            <FolderKanban className="h-10 w-10 mb-2" />
            <p className="text-sm">暂无项目</p>
            {search && <p className="text-xs mt-1">没有匹配的项目，试试其他关键词</p>}
          </div>
        )}

        {filtered.map((project) => (
          <div
            key={project.id}
            className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] overflow-hidden shadow-[0_2px_8px_rgba(0_0_0_0.2)]"
          >
            {/* 项目头部 - 点击选择 */}
            <button
              onClick={() => setSelectedId(project.id)}
              className={cn(
                'flex w-full items-center justify-between px-4 py-3 transition-colors',
                selectedId === project.id
                  ? 'border-l-2 border-[#7C3AED] bg-[#7C3AED]/10'
                  : 'hover:bg-[#363636]',
              )}
            >
              <div className="text-left min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{project.name}</span>
                  {selectedId === project.id && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#7C3AED]" />
                  )}
                </div>
                <div className="text-xs text-[#888] mt-0.5">
                  总材料数：{(project.minerals?.length || 0) + (project.shipMaterials?.length || 0) + (project.buildMaterials?.length || 0)} 种
                </div>
              </div>
            </button>

            {/* 选中项目的操作栏 */}
            {selectedId === project.id && (
              <div className="border-t border-[#3A3A3A] px-4 py-3 space-y-3">
                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleImportProject(project)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#7C3AED] py-2 text-xs font-medium text-white transition-all hover:bg-[#6D28D9] active:scale-[0.98]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导入总成本
                  </button>
                  <button
                    onClick={() => handleImportAllMaterials(project)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#444444] bg-[#363636] py-2 text-xs font-medium text-white transition-all hover:bg-[#444] active:scale-[0.98]"
                  >
                    <Import className="h-3.5 w-3.5" />
                    导入材料
                  </button>
                </div>

                {/* 编辑/删除按钮 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditProject(project)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#444444] bg-[#2C2C2C] py-1.5 text-xs text-[#888] transition-all hover:border-[#666] hover:text-white active:scale-[0.98]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    编辑
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`确定删除项目「${project.name}」？`)) {
                        handleDeleteProject(project.id);
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EF4444]/30 bg-transparent py-1.5 text-xs text-[#EF4444] transition-all hover:bg-[#EF4444]/10 active:scale-[0.98]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>

                {/* 材料明细折叠 */}
                <div className="border-t border-[#3A3A3A]/50 pt-2">
                  <button
                    onClick={() => toggleExpandMaterials(project.id)}
                    className="flex items-center gap-1 text-xs text-[#666] hover:text-white transition-colors"
                  >
                    <Box className="h-3 w-3" />
                    {expandedId === project.id ? '收起' : '展开'}材料明细
                    <span className="ml-auto text-[10px]">
                      {project.minerals?.length || 0}矿物 / {project.shipMaterials?.length || 0}船材 / {project.buildMaterials?.length || 0}建材
                    </span>
                  </button>
                  {expandedId === project.id && (
                    <div className="mt-2 space-y-3">
                      {renderMaterialCategory('矿物', Pickaxe, project.minerals)}
                      {renderMaterialCategory('船材', Ship, project.shipMaterials)}
                      {renderMaterialCategory('建材', Building2, project.buildMaterials)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 编辑/新建弹窗 */}
      {(editingId || newProject) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3A3A3A] px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {newProject ? '新建项目' : '编辑项目'}
              </h3>
              <button
                onClick={handleCancelEdit}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#888] hover:bg-[#3A3A3A] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* 项目名称 */}
              <div>
                <label className="text-xs text-[#A0A0A0] mb-1 block">项目名称</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="输入项目名称"
                  className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
                />
              </div>

              {/* 参数 */}
              <div className="rounded-lg bg-[#1E1E1E] border border-[#3A3A3A] p-3 space-y-2">
                <h3 className="text-xs font-semibold text-white">项目参数</h3>
                {([
                  { key: 'materialCost150' as const, label: '150%效率市价材料成本', unit: '亿ISK' },
                  { key: 'blueprintPrice' as const, label: '蓝图参考价', unit: '亿ISK' },
                  { key: 'fixedManufactureFee' as const, label: '固定制造费', unit: '亿ISK' },
                  { key: 'buyOrderPrice' as const, label: '买单价', unit: '亿ISK' },
                  { key: 'marketSellPrice' as const, label: '市场卖价', unit: '亿ISK' },
                ]).map(({ key, label, unit }) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-[11px] text-[#888] flex-1 truncate">{label}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editForm[key] ?? ''}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setEditForm((prev) => ({ ...prev, [key]: v }));
                      }}
                      className="w-24 rounded-md border border-[#444444] bg-[#1E1E1E] px-2 py-1.5 text-right text-sm text-white outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 tabular-nums"
                    />
                    <span className="text-[10px] text-[#666] w-8 text-right">{unit}</span>
                  </div>
                ))}
              </div>

              {/* 保存/取消按钮 */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancelEdit}
                  className="flex flex-1 items-center justify-center rounded-lg border border-[#444] bg-transparent py-2 text-xs text-[#888] transition-all hover:border-[#666] hover:text-white"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex flex-1 items-center justify-center rounded-lg bg-[#7C3AED] py-2 text-xs font-medium text-white transition-all hover:bg-[#6D28D9] active:scale-[0.98]"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 渲染材料分类列表 */
function renderMaterialCategory(
  label: string,
  Icon: React.ComponentType<{ className?: string }>,
  items?: IMaterialItem[],
) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-[#888] mb-1">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
        <span className="ml-auto">{(items || []).length} 种</span>
      </div>
      <div className="space-y-1">
        {(items || []).slice(0, 5).map((m, i) => (
          <div key={i} className="flex justify-between text-[11px] text-[#666] pl-3">
            <span>{m.name}</span>
            <span>{(m.price || 0).toLocaleString()} ISK × {m.quantity || 0}</span>
          </div>
        ))}
        {(items || []).length > 5 && (
          <div className="text-[10px] text-[#555] pl-3">...还有 {(items || []).length - 5} 种材料</div>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
