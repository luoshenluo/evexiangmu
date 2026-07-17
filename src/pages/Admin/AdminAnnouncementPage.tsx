import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getAnnouncement, saveAnnouncement, type Announcement } from '@/lib/admin-projects';

export default function AdminAnnouncementPage() {
  const [title, setTitle] = useState('提示');
  const [content, setContent] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAnnouncement();
      if (data) {
        setTitle(data.title || '提示');
        setContent(data.content || '');
        setEnabled(data.enabled !== false);
      }
    } catch (err) {
      console.error('[AdminAnnouncementPage] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const announcement: Announcement = { title: title.trim() || '提示', content: content.trim(), enabled, updated_at: new Date().toISOString() };
      await saveAnnouncement(announcement);
      toast.success('公告已保存');
    } catch (err) {
      console.error('[AdminAnnouncementPage] save error:', err);
      toast.error('保存失败');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" /></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-[#A78BFA]" />
          <h2 className="text-lg font-semibold text-white">公告管理</h2>
        </div>
        <p className="mt-1 text-sm text-[#A0A0A0]">设置用户打开网站时显示的公告弹窗内容</p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] px-4 py-3">
          <div>
            <div className="text-sm font-medium text-white">启用公告</div>
            <div className="text-xs text-[#888] mt-0.5">关闭后用户打开网站不会弹出公告</div>
          </div>
          <button onClick={() => setEnabled(!enabled)} className={'relative h-6 w-11 rounded-full transition-colors ' + (enabled ? 'bg-[#7C3AED]' : 'bg-[#444]')}>
            <span className={'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ' + (enabled ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
        </div>
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-2">
          <label className="text-xs font-medium text-[#A0A0A0]">公告标题</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：提示、公告、通知等" className="w-full rounded-md border border-[#444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30" />
        </div>
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-2">
          <label className="text-xs font-medium text-[#A0A0A0]">公告内容</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="输入公告内容，支持多行文本" rows={6} className="w-full rounded-md border border-[#444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 resize-none" />
          <p className="text-[11px] text-[#666]">提示：换行会自动保留显示</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] py-3 text-sm font-medium text-white transition-all hover:bg-[#6D28D9] disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? '保存中...' : '保存公告'}
        </button>
      </div>
    </div>
  );
}