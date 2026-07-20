import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Edit3, Trash2, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { IManufactureProject } from '@/data/materials';
import { loadAdminProjects, deleteAdminProject } from '@/lib/admin-projects';
import { formatNumber } from '@/lib/utils';

export default function AdminProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<IManufactureProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<IManufactureProject | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try { const data = await loadAdminProjects(); setProjects(data); } catch (err) { console.error(err); toast.error('加载项目列表失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [location.pathname, fetchProjects]);

  const filtered = useMemo(() => {
    if (!keyword.trim()) return projects;
    const kw = keyword.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(kw) || (p.category || '').toLowerCase().includes(kw));
  }, [projects, keyword]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteAdminProject(deleteTarget.id); await fetchProjects(); toast.success('项目已删除'); } catch (err) { console.error(err); toast.error('删除失败，请检查网络'); } finally { setDeleteTarget(null); }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-white">制造项目管理</h2><p className="mt-0.5 text-sm text-[#A0A0A0]">管理公共制造项目数据，所有用户可见</p></div>
        <button onClick={() => navigate('/admin/projects/new')} className="flex items-center justify-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98]"><Plus className="h-4 w-4" />新增项目</button>
      </div>
      <div className="mb-4 relative w-full md:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" />
        <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索项目名称或分类..." className="w-full rounded-md border border-[#444444] bg-[#2C2C2C] pl-9 pr-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] hidden md:block">
        {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" /><span className="ml-2 text-sm text-[#A0A0A0]">加载中...</span></div> : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#3A3A3A] text-left text-[11px] font-medium uppercase tracking-wider text-[#888888]"><th className="px-4 py-3">项目名称</th><th className="px-4 py-3">分类</th><th className="px-4 py-3 text-right">材料(亿)</th><th className="px-4 py-3 text-right">蓝图(亿)</th><th className="px-4 py-3 text-right">制造费(亿)</th><th className="px-4 py-3 text-right">收购价(亿)</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center"><div className="flex flex-col items-center gap-2 text-[#888888]"><Package className="h-8 w-8 opacity-50" /><span className="text-sm">暂无匹配的项目</span></div></td></tr> : filtered.map((project) => (
                  <tr key={project.id} className="border-b border-[#3A3A3A]/50 last:border-b-0 transition-colors hover:bg-[#3A3A3A]/30">
                    <td className="px-4 py-3"><div className="font-medium text-white">{project.name}</div></td>
                    <td className="px-4 py-3"><span className="rounded-md bg-[#7C3AED]/15 px-2 py-0.5 text-xs text-[#A78BFA]">{project.category}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">{formatNumber(project.materialCost150)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">{formatNumber(project.blueprintPrice)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">{formatNumber(project.fixedManufactureFee)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#22C55E]">{formatNumber(project.buyOrderPrice)}</td>
                    <td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><button onClick={() => navigate('/admin/projects/' + project.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#A0A0A0] transition-colors hover:bg-[#7C3AED]/15 hover:text-[#A78BFA]" title="编辑"><Edit3 className="h-3.5 w-3.5" /></button><button onClick={() => setDeleteTarget(project)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#A0A0A0] transition-colors hover:bg-[#DC2626]/15 hover:text-[#EF4444]" title="删除"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-[#888]"><Package className="h-8 w-8 opacity-50" /><span className="text-sm">暂无匹配的项目</span></div>
        ) : filtered.map((project) => (
          <div key={project.id} className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-white truncate">{project.name}</span>
                <span className="shrink-0 rounded-md bg-[#7C3AED]/15 px-2 py-0.5 text-[10px] text-[#A78BFA]">{project.category}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => navigate('/admin/projects/' + project.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#A0A0A0] transition-colors hover:bg-[#7C3AED]/15 hover:text-[#A78BFA]"><Edit3 className="h-3.5 w-3.5" /></button>
                <button onClick={() => setDeleteTarget(project)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#A0A0A0] transition-colors hover:bg-[#DC2626]/15 hover:text-[#EF4444]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="rounded bg-[#1a1a1a] px-1.5 py-1"><div className="text-[9px] text-[#666]">材料</div><div className="text-xs text-white tabular-nums">{formatNumber(project.materialCost150)}</div></div>
              <div className="rounded bg-[#1a1a1a] px-1.5 py-1"><div className="text-[9px] text-[#666]">蓝图</div><div className="text-xs text-white tabular-nums">{formatNumber(project.blueprintPrice)}</div></div>
              <div className="rounded bg-[#1a1a1a] px-1.5 py-1"><div className="text-[9px] text-[#666]">制造费</div><div className="text-xs text-white tabular-nums">{formatNumber(project.fixedManufactureFee)}</div></div>
              <div className="rounded bg-[#1a1a1a] px-1.5 py-1"><div className="text-[9px] text-[#666]">收购价</div><div className="text-xs text-[#22C55E] tabular-nums">{formatNumber(project.buyOrderPrice)}</div></div>
            </div>
          </div>
        ))}
      </div>}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white">确认删除</h3>
            <p className="mt-2 text-sm text-[#A0A0A0]">确定要删除「{deleteTarget.name}」吗？删除后所有用户将不再可见此项目。</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-lg border border-[#444444] bg-[#1E1E1E] py-2.5 text-sm text-white transition-colors hover:bg-[#363636]">取消</button>
              <button onClick={handleDelete} className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#B91C1C]">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}