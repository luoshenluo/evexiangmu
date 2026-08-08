'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber, formatDateTime } from '@/lib/utils'
import { Users, Plus, Shield, Trophy, LogOut, Coins, LogIn, Search, X, Crown, Edit, Settings, UserCheck, UserX, ChevronUp, Gift, AlertTriangle } from 'lucide-react'
import { FAMILY_LEVEL_EXP, FAMILY_MAX_LEVEL } from '@/lib/game-data'

type MemberRole = 'owner' | 'admin' | 'member'

const LEVEL_THOLDS: number[] = Array.isArray(FAMILY_LEVEL_EXP) ? FAMILY_LEVEL_EXP : [0, 100, 300, 700, 1500, 3000, 6000, 12000, 24000, 50000]

export default function FamilyPage() {
  const { user, updateUser, showToast } = useAppStore()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [searchName, setSearchName] = useState('')
  const [formName, setFormName] = useState('')
  const [formAnnouncement, setFormAnnouncement] = useState('')
  const [formAvatar, setFormAvatar] = useState('🏰')
  const [loading, setLoading] = useState(false)
  const [family, setFamily] = useState<any>(null)
  const [familyList, setFamilyList] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [editName, setEditName] = useState('')
  const [editAnnouncement, setEditAnnouncement] = useState('')
  const [editAvatar, setEditAvatar] = useState('🏰')
  const [tab, setTab] = useState<'info' | 'members' | 'game' | 'list'>('info')
  const [contribAmount, setContribAmount] = useState(10)
  const [familyTasks, setFamilyTasks] = useState<any[]>([])
  const [myContribution, setMyContribution] = useState(0)

  const AVATAR_OPTIONS = ['🏰', '🌸', '🌻', '🌹', '🌺', '🌼', '🌿', '🍀', '🌳', '🌴', '🎋', '🎍', '⛩️', '🏡', '🌈', '⭐']

  const refresh = async () => {
    if (!user) return
    try {
      if (user.familyId) {
        try {
          const res = await apiFetch('/api/family?action=detail')
          if (res.success && res.data) { setFamily(res.data) }
          else {
            setFamily(null)
            try { const uRes = await apiFetch('/api/user/me'); if (uRes.success && uRes.data) { updateUser({ ...uRes.data, familyId: null }) } else { updateUser({ familyId: null } as any) } } catch { updateUser({ familyId: null } as any) }
            if (res.error && res.error !== '你还未加入家族') { showToast(`家族状态异常：${res.error}，已刷新`, 'info') }
          }
          try { const tRes = await apiFetch('/api/family?action=tasks'); if (tRes.success) setFamilyTasks(tRes.data || []) } catch {}
        } catch (detailErr: any) { setFamily(null); updateUser({ familyId: null } as any) }
      }
      try { const lRes = await apiFetch(`/api/family?action=list&kw=${encodeURIComponent(searchName)}`); if (lRes.success) setFamilyList(lRes.data || []); else setFamilyList([]) } catch { setFamilyList([]) }
    } catch (e: any) { setFamily(null); setFamilyList([]) }
  }

  useEffect(() => { refresh() }, [user, refreshKey, searchName])

  const create = async () => {
    if (!formName.trim()) return showToast('请输入家族名称', 'error')
    if (!user || user.coins < 1000) return showToast('创建家族需要 1000 金币', 'error')
    setLoading(true)
    try {
      const res = await apiFetch('/api/family', { method: 'POST', body: JSON.stringify({ mode: 'create', name: formName, announcement: formAnnouncement, avatar: formAvatar }) })
      if (res.success) { if (res.data?.user) updateUser(res.data.user); if (res.data?.family) setFamily(res.data.family); showToast('🎉 家族创建成功！', 'success'); setShowCreate(false); setRefreshKey((k) => k + 1) }
      else showToast(res.error || '创建失败', 'error')
    } finally { setLoading(false) }
  }

  const join = async (familyId: string) => {
    if (!user) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/family', { method: 'POST', body: JSON.stringify({ mode: 'join', familyId }) })
      if (res.success) { showToast('加入成功！', 'success'); const uRes = await apiFetch('/api/user/me'); if (uRes.success) updateUser(uRes.data); setShowJoin(false); setRefreshKey((k) => k + 1) }
      else showToast(res.error || '加入失败', 'error')
    } finally { setLoading(false) }
  }

  const leave = async () => {
    if (!confirm(family?.ownerId === user?.id ? '你是族长，退出将自动转让给副族长/成员；若只剩你一人，家族将解散。确定？' : '确定退出家族？')) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/family', { method: 'POST', body: JSON.stringify({ mode: 'leave' }) })
      if (res.success) { showToast('已退出家族', 'info'); const uRes = await apiFetch('/api/user/me'); if (uRes.success) updateUser(uRes.data); else updateUser({ familyId: null } as any); setFamily(null); setRefreshKey((k) => k + 1) }
      else {
        if (res.error === '家族不存在' || res.error === '你未加入任何家族' || res.error === '家族已解散') { updateUser({ familyId: null } as any); setFamily(null); showToast('家族状态已刷新', 'info') }
        else showToast(res.error || '操作失败', 'error')
      }
    } catch (e: any) { updateUser({ familyId: null } as any); setFamily(null); showToast('网络异常，已强制退出家族', 'error'); setRefreshKey((k) => k + 1) }
    finally { setLoading(false) }
  }

  const setRole = async (targetUserId: string, role: MemberRole) => {
    if (!confirm(`确定修改此成员的角色为「${role === 'owner' ? '族长' : role === 'admin' ? '管理员' : '成员'}」？`)) return
    setLoading(true)
    try { const res = await apiFetch('/api/family', { method: 'POST', body: JSON.stringify({ mode: 'set-role', targetUserId, role }) }); if (res.success) { showToast('修改成功', 'success'); setRefreshKey((k) => k + 1) } else showToast(res.error || '修改失败', 'error') }
    finally { setLoading(false) }
  }

  const kick = async (targetUserId: string) => {
    if (!confirm('确定踢出此成员？')) return
    setLoading(true)
    try { const res = await apiFetch('/api/family', { method: 'POST', body: JSON.stringify({ mode: 'kick', targetUserId }) }); if (res.success) { showToast('已踢出成员', 'info'); setRefreshKey((k) => k + 1) } else showToast(res.error || '失败', 'error') }
    finally { setLoading(false) }
  }

  const saveEdit = async () => {
    setLoading(true)
    try { const res = await apiFetch('/api/family', { method: 'POST', body: JSON.stringify({ mode: 'update-info', name: editName, announcement: editAnnouncement, avatar: editAvatar }) }); if (res.success) { showToast('已保存', 'success'); setShowEdit(false); setRefreshKey((k) => k + 1) } else showToast(res.error || '保存失败', 'error') }
    finally { setLoading(false) }
  }

  const openEdit = () => { setEditName(family?.name || ''); setEditAnnouncement(family?.announcement || ''); setEditAvatar(family?.avatar || '🏰'); setShowEdit(true) }

  const expToNext = family ? (() => {
    const lv = Math.min(Math.max(1, family.level | 0), FAMILY_MAX_LEVEL)
    const len = LEVEL_THOLDS.length
    if (lv >= FAMILY_MAX_LEVEL || family.exp >= LEVEL_THOLDS[len - 1]) { return { have: 0, need: 0, percent: 100, maxed: true } }
    const curStart = LEVEL_THOLDS[Math.min(lv - 1, len - 1)] || 0
    const nextStart = LEVEL_THOLDS[Math.min(lv, len - 1)] || curStart
    const have = Math.max(0, family.exp - curStart)
    const need = Math.max(1, nextStart - curStart)
    return { have, need, percent: Math.max(0, Math.min(100, (have / need) * 100)), maxed: false }
  })() : null

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 text-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
        <div className="card p-10"><div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center"><Users size={40} className="text-blue-500" /></div><h2 className="font-bold text-lg mb-1 text-slate-800">请先登录</h2><p className="text-sm text-slate-500 mb-5">登录后使用家族功能</p></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      <div className="card p-4 mb-4"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-200"><Users size={24} className="text-white" /></div><div className="flex-1"><h1 className="text-xl font-bold text-slate-800">家族</h1><p className="text-xs text-slate-500">和伙伴们一起经营花园</p></div>{!user?.familyId && <div className="flex gap-2"><button onClick={() => setShowJoin(true)} className="btn-secondary py-2 px-3 text-xs"><LogIn size={14} /> 加入</button><button onClick={() => setShowCreate(true)} className="btn-primary py-2 px-3 text-xs flex items-center gap-1"><Plus size={14} /> 创建</button></div>}</div></div>
      {!user?.familyId && (<div className="space-y-3"><div className="card p-10 text-center"><div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center"><Users size={40} className="text-blue-500" /></div><h2 className="text-lg font-bold text-slate-800 mb-1">还没有加入家族</h2><p className="text-sm text-slate-500 mb-5">创建家族需要 1000 金币，或申请加入其他家族</p><div className="flex justify-center gap-3"><button onClick={() => setShowJoin(true)} className="btn-secondary">加入家族</button><button onClick={() => setShowCreate(true)} className="btn-primary">创建家族 (1000💰)</button></div><div className="grid grid-cols-3 gap-3 mt-10">{[{ icon: <Shield size={24} />, title: '专属频道', desc: '内部聊天' }, { icon: <Trophy size={24} />, title: '家族升级', desc: '成员越多经验越快' }, { icon: <Crown size={24} />, title: '最多百人', desc: '10级家族' }].map((item, idx) => <div key={idx} className="p-3 rounded-xl bg-slate-50"><div className="text-garden-500 mb-2 flex justify-center">{item.icon}</div><div className="text-sm font-bold text-slate-700">{item.title}</div><div className="text-[11px] text-slate-500">{item.desc}</div></div>)}</div></div><div className="card p-4"><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800 text-sm">🔥 热门家族</h3><div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="pl-7 pr-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs w-40 outline-none" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="搜索家族..." /></div></div>{familyList.length === 0 ? <div className="text-center py-6 text-sm text-slate-400">暂无家族，快来创建第一个吧！</div> : <div className="space-y-2">{familyList.map((f) => <div key={f.id} className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50 flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-2xl flex-shrink-0">{f.avatar}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-bold text-slate-800 truncate">{f.name}</span><span className="chip text-[10px] bg-indigo-100 text-indigo-700">Lv.{f.level}</span></div><div className="text-[11px] text-slate-500 mt-0.5 truncate">族长：{f.ownerName || ' - '}{' · '}{f.memberCount}/{f.maxMembers} 人</div></div><button onClick={() => join(f.id)} disabled={loading || f.memberCount >= f.maxMembers} className="px-3 py-1.5 rounded-lg text-xs bg-garden-500 text-white hover:bg-garden-600 disabled:opacity-50">{f.memberCount >= f.maxMembers ? '已满' : '加入'}</button></div>)}</div>}</div></div>)}
      {user?.familyId && !family && <div className="card p-8 text-center"><div className="text-slate-400 text-sm">正在加载家族信息...</div></div>}
      {user?.familyId && family && (<div className="space-y-4"><div className="card p-5 relative overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 text-white"><div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" /><div className="absolute -bottom-16 -left-6 w-32 h-32 rounded-full bg-white/5" /><div className="relative flex items-start gap-4"><div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur border-2 border-white/40 flex items-center justify-center text-4xl shadow-lg">{family.avatar || '🏰'}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><h2 className="text-2xl font-bold truncate">{family.name}</h2><span className="chip bg-white text-blue-700 text-[10px]">Lv.{family.level}</span>{family.myRole === 'owner' && <span className="chip bg-amber-200 text-amber-800 text-[10px]">族长</span>}{family.myRole === 'admin' && <span className="chip bg-white/30 text-white text-[10px]">管理员</span>}</div><div className="text-xs opacity-80 mt-1">族长：{family.ownerName} · {family.members?.length || 0}/{family.maxMembers} 人</div>{expToNext && !expToNext.maxed && <div className="mt-3"><div className="flex justify-between text-[11px] opacity-80 mb-1"><span>家族经验</span><span>{formatNumber(expToNext.have)} / {formatNumber(expToNext.need)}</span></div><div className="w-full h-2 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full transition-all" style={{ width: `${expToNext.percent}%` }} /></div></div>}{expToNext && expToNext.maxed && <div className="mt-3 text-[11px] opacity-80 flex items-center gap-1"><Crown size={12} /> 家族已达到最高 Lv.{FAMILY_MAX_LEVEL}</div>}</div>{family.myRole === 'owner' && <button onClick={openEdit} className="p-2 hover:bg-white/20 rounded-xl"><Edit size={18} /></button>}</div>{family.announcement && <div className="relative mt-4 p-3 rounded-xl bg-white/15 backdrop-blur-sm text-xs"><div className="flex items-start gap-2"><Shield size={14} className="flex-shrink-0 mt-0.5" /><div className="flex-1">家族公告：{family.announcement}</div></div></div>}</div><div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">{([{ k: 'info', label: '总览' }, { k: 'game', label: '家族玩法' }, { k: 'members', label: `成员 (${family.members?.length || 0})` }, { k: 'list', label: '家族榜' }] as const).map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={classNames('py-2 rounded-lg text-xs font-medium', tab === t.k ? 'bg-white text-garden-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{t.label}</button>)}</div>{tab === 'info' && <div className="grid grid-cols-2 gap-3">{[{ label: '家族等级', value: `Lv.${family.level}`, color: 'from-indigo-500 to-purple-600', icon: <Trophy size={18} /> }, { label: '成员数量', value: `${family.members?.length || 0}/${family.maxMembers}`, color: 'from-green-500 to-emerald-600', icon: <Users size={18} /> }, { label: '家族经验', value: formatNumber(family.exp), color: 'from-amber-500 to-orange-600', icon: <ChevronUp size={18} /> }, { label: '创建时间', value: formatDateTime(family.createdAt).slice(0, 10), color: 'from-rose-500 to-pink-600', icon: <Gift size={18} /> }].map((it, i) => <div key={i} className="card p-4"><div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${it.color} flex items-center justify-center text-white mb-2`}>{it.icon}</div><div className="text-[11px] text-slate-500">{it.label}</div><div className="text-lg font-bold text-slate-800">{it.value}</div></div>)}<button onClick={leave} disabled={loading} className="col-span-2 card py-3 text-red-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50"><LogOut size={16} /> 退出家族</button></div>}{tab === 'game' && <div className="space-y-4"><div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200"><div className="flex items-center gap-2 mb-2"><Coins size={16} className="text-amber-600" /><h3 className="font-bold text-slate-800 text-sm">家族许愿池</h3></div><div className="text-xs text-slate-600 mb-3">向家族贡献金币，换取家族经验；贡献最多的成员每周可获得额外奖励。</div><div className="flex items-center gap-2 mb-3"><span className="text-xs text-slate-600">贡献：</span>{[5, 10, 50, 100, 500].map(n => <button key={n} onClick={() => setContribAmount(n)} className={classNames('px-2 py-1 rounded-lg text-xs font-bold', contribAmount === n ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 border border-amber-200')}>{n} 💰</button>)}</div><button onClick={async () => { if (!user) return; if (user.coins < contribAmount) { showToast('金币不足', 'error'); return }; try { const r = await apiFetch('/api/family', { method: 'POST', body: JSON.stringify({ mode: 'contribute', amount: contribAmount }) }); if (r.success) { showToast(`贡献 ${contribAmount} 金币成功，获得 ${Math.floor(contribAmount / 10)} 家族经验`, 'success'); updateUser(r.data?.user); setRefreshKey(k => k + 1) } else showToast(r.error || '贡献失败', 'error') } catch (e: any) { showToast(e.message || '出错', 'error') } }} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow hover:shadow-md transition-all">贡献 {contribAmount} 金币</button></div><div className="card p-4"><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Trophy size={16} className="text-purple-500" /> 家族集体任务</h3><span className="text-[11px] text-slate-500">所有成员共同完成</span></div>{familyTasks.length === 0 ? <div className="text-center text-slate-400 text-sm py-6">加载中...</div> : <div className="space-y-2">{familyTasks.map((t: any) => { const percent = Math.min(100, (t.progress / t.target) * 100); const claimed = t.claimedBy?.includes(user?.id); return <div key={t.id} className="p-3 rounded-xl bg-slate-50"><div className="flex items-start justify-between gap-2 mb-2"><div className="flex-1"><div className="font-bold text-sm text-slate-800">{t.title}</div><div className="text-[11px] text-slate-500 mt-0.5">{t.desc}</div></div><div className="text-right flex-shrink-0"><div className="text-[10px] text-slate-500">奖励</div><div className="text-xs font-bold text-amber-600">{t.rewardCoins} 💰</div></div></div><div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2"><div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full" style={{ width: `${percent}%` }} /></div><div className="flex items-center justify-between"><span className="text-[11px] text-slate-500">{formatNumber(t.progress)} / {formatNumber(t.target)}{t.progress >= t.target && <span className="ml-1 text-emerald-600 font-bold">已达成！</span>}</span>{t.progress >= t.target && <button disabled={claimed} onClick={async () => { try { const r = await apiFetch('/api/family', { method: 'POST', body: JSON.stringify({ mode: 'claim-task', taskId: t.id }) }); if (r.success) { showToast(`领取奖励 +${t.rewardCoins} 金币`, 'success'); updateUser(r.data?.user); setRefreshKey(k => k + 1) } else showToast(r.error || '领取失败', 'error') } catch (e: any) { showToast(e.message || '出错', 'error') } }} className={classNames('px-3 py-1 rounded-lg text-xs font-bold', claimed ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600')}>{claimed ? '已领取' : '领取奖励'}</button>}</div></div> })}</div>}</div><div className="card p-4"><h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2"><Gift size={16} className="text-pink-500" /> 我的贡献</h3><div className="flex items-center gap-3"><div className="flex-1 p-3 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50"><div className="text-[11px] text-slate-500">累计贡献</div><div className="text-xl font-bold text-rose-600">{formatNumber((family.members?.find((m: any) => m.userId === user?.id)?.contribution) || 0)}</div></div><div className="flex-1 p-3 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50"><div className="text-[11px] text-slate-500">家族等级</div><div className="text-xl font-bold text-blue-600">Lv.{family.level}</div></div></div></div></div>}{tab === 'members' && family.members?.length > 0 && <div className="space-y-2">{family.members.map((m: any) => <div key={m.userId} className="card p-3 flex items-center gap-3"><div className="relative"><div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-2xl">{m.avatar}</div><span className={classNames('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', m.online ? 'bg-green-500' : 'bg-slate-300')} /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 flex-wrap"><span className="font-bold text-slate-800 truncate">{m.nickname}</span>{m.role === 'owner' && <span className="chip text-[9px] bg-amber-100 text-amber-700">族长</span>}{m.role === 'admin' && <span className="chip text-[9px] bg-blue-100 text-blue-700">管理员</span>}<span className="chip text-[9px] bg-slate-100 text-slate-600">贡献 {m.contribution || 0}</span></div><div className="text-[11px] text-slate-500 mt-0.5">{m.online ? <span className="text-green-600">● 在线</span> : `离线 · ${formatDateTime(m.lastLogin).slice(5, 16)}`}{' · '}花园 {m.plotsUnlocked} 块 · 💰 {formatNumber(m.coins)}</div></div>{family.myRole === 'owner' && m.userId !== family.ownerId && <div className="flex gap-1"><select value={m.role} onChange={(e) => setRole(m.userId, e.target.value as MemberRole)} disabled={loading} className="rounded-lg border border-slate-200 text-xs py-1 px-2"><option value="member">成员</option><option value="admin">管理员</option><option value="owner">转让族长</option></select><button onClick={() => kick(m.userId)} disabled={loading} className="px-2 py-1 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100" title="踢出"><UserX size={14} /></button></div>}{family.myRole === 'admin' && m.role === 'member' && <button onClick={() => kick(m.userId)} disabled={loading} className="px-2 py-1 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100" title="踢出"><UserX size={14} /></button>}</div>)}</div>}{tab === 'list' && <div className="space-y-2">{familyList.length === 0 && <div className="card p-6 text-center text-sm text-slate-400">暂无家族</div>}{familyList.map((f, idx) => <div key={f.id} className={classNames('card p-3 flex items-center gap-3', f.id === family.id && 'ring-2 ring-garden-400')}><div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">#{idx + 1}</div><div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-2xl flex-shrink-0">{f.avatar}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-bold text-slate-800 truncate">{f.name}</span><span className="chip text-[10px] bg-indigo-100 text-indigo-700">Lv.{f.level}</span>{f.id === family.id && <span className="chip text-[10px] bg-garden-100 text-garden-700">我的家族</span>}</div><div className="text-[11px] text-slate-500 mt-0.5 truncate">{f.ownerName} · {f.memberCount}/{f.maxMembers}人 · 经验 {formatNumber(f.exp)}</div></div></div>)}</div>}</div>)}
      {showCreate && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}><div className="card w-full max-w-md p-5 slide-up" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg text-slate-800">创建家族</h2><button onClick={() => setShowCreate(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button></div><div className="space-y-3"><div><label className="block text-sm font-medium mb-1 text-slate-700">家族图标</label><div className="grid grid-cols-8 gap-1.5">{AVATAR_OPTIONS.map((a) => <button key={a} onClick={() => setFormAvatar(a)} className={classNames('w-10 h-10 rounded-xl text-2xl flex items-center justify-center border transition-all', formAvatar === a ? 'border-garden-500 bg-garden-50 scale-105' : 'border-slate-200 hover:bg-slate-50')}>{a}</button>)}</div></div><div><label className="block text-sm font-medium mb-1 text-slate-700">家族名称（唯一，2-10字）</label><input className="input" value={formName} maxLength={10} onChange={(e) => setFormName(e.target.value)} placeholder="请输入家族名称" /></div><div><label className="block text-sm font-medium mb-1 text-slate-700">家族公告</label><textarea className="input min-h-[80px] resize-none" value={formAnnouncement} maxLength={100} onChange={(e) => setFormAnnouncement(e.target.value)} placeholder="家族介绍..." /></div><div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center justify-between"><span>创建费用</span><span className="font-bold flex items-center gap-1"><Coins size={14} /> 1000</span></div><button onClick={create} disabled={loading} className="btn-primary w-full py-2.5">{loading ? '创建中...' : '创建家族'}</button></div></div></div>}
      {showJoin && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowJoin(false)}><div className="card w-full max-w-md p-5 slide-up max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg text-slate-800">加入家族</h2><button onClick={() => setShowJoin(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button></div><div className="space-y-3"><div><label className="block text-sm font-medium mb-1 text-slate-700">搜索家族</label><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-10" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="输入家族名称" /></div></div><div className="space-y-2 max-h-80 overflow-y-auto">{familyList.length === 0 && <div className="text-center py-8 text-sm text-slate-400">暂无匹配的家族</div>}{familyList.map((f) => <div key={f.id} className="p-3 rounded-xl border border-slate-100 flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-2xl flex-shrink-0">{f.avatar}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-bold text-slate-800 truncate">{f.name}</span><span className="chip text-[10px] bg-indigo-100 text-indigo-700">Lv.{f.level}</span></div><div className="text-[11px] text-slate-500 mt-0.5">{f.ownerName} · {f.memberCount}/{f.maxMembers}</div></div><button onClick={() => join(f.id)} disabled={loading || f.memberCount >= f.maxMembers} className="px-3 py-1.5 rounded-lg text-xs bg-garden-500 text-white hover:bg-garden-600 disabled:opacity-50">{f.memberCount >= f.maxMembers ? '已满' : '加入'}</button></div>)}</div></div></div></div>}
      {showEdit && family && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEdit(false)}><div className="card w-full max-w-md p-5 slide-up" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Settings size={18} /> 家族设置</h2><button onClick={() => setShowEdit(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button></div><div className="space-y-3"><div><label className="block text-sm font-medium mb-1 text-slate-700">家族图标</label><div className="grid grid-cols-8 gap-1.5">{AVATAR_OPTIONS.map((a) => <button key={a} onClick={() => setEditAvatar(a)} className={classNames('w-10 h-10 rounded-xl text-2xl flex items-center justify-center border transition-all', editAvatar === a ? 'border-garden-500 bg-garden-50 scale-105' : 'border-slate-200 hover:bg-slate-50')}>{a}</button>)}</div></div><div><label className="block text-sm font-medium mb-1 text-slate-700">家族名称</label><input className="input" value={editName} maxLength={10} onChange={(e) => setEditName(e.target.value)} /></div><div><label className="block text-sm font-medium mb-1 text-slate-700">家族公告</label><textarea className="input min-h-[80px] resize-none" value={editAnnouncement} maxLength={100} onChange={(e) => setEditAnnouncement(e.target.value)} /></div><div className="flex gap-2 pt-1"><button onClick={() => setShowEdit(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600">取消</button><button onClick={saveEdit} disabled={loading} className="flex-1 btn-primary py-2.5">{loading ? '保存中...' : '保存'}</button></div></div></div></div>}
    </div>
  )
}
