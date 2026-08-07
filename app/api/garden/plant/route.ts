import { NextRequest } from 'next/server'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'
import { updateUser, getFlowerTypeBySeedId, updateTaskProgress } from '@/lib/server-store'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    let body: any
    try { body = await req.json() } catch { return jsonResponse(false,null,'请求格式错误',400) }
    const { plotId, seedRefId } = body || {}
    if (!plotId || !seedRefId) return jsonResponse(false,null,'缺少参数',400)
    const plots = [...(user.plots || [])]
    const plot = plots.find(p => p && p.id === plotId)
    if (!plot || !plot.unlocked || plot.flower) return jsonResponse(false,null,'地块不可用',400)
    const inv = [...(user.inventory || [])]
    const idx = inv.findIndex(i => i && i.type==='seed' && i.referenceId===seedRefId)
    if (idx < 0) return jsonResponse(false,null,'没有对应种子',400)
    const ft = getFlowerTypeBySeedId(seedRefId)
    if (!ft) return jsonResponse(false,null,'种子无效',400)
    const seed = inv[idx]
    if ((seed.quantity||0) <= 1) inv.splice(idx, 1)
    else inv[idx] = {...seed, quantity: seed.quantity-1}
    const pIdx = plots.indexOf(plot)
    plots[pIdx] = {...plot, flower: { id: 'f_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), flowerTypeId: ft.id, rank: 1, plantedAt: Date.now(), waterCount: 0, fertilizeCount: 0, pestCount: 0, hasPest: false, pestAt: null, growthProgress: 0, isReady: false, lastWaterAt: null, lastFertilizeAt: null }}
    const updated = await updateUser(user.id, { plots, inventory: inv })
    if (!updated) return jsonResponse(false, null, '种植失败', 500)
    try { updateTaskProgress(user.id, 't_daily_2', 1) } catch {}
    logger.info('garden','种植',{userId:user.id,seed:seedRefId,plotId})
    return jsonResponse(true, { user: sanitizeUser(updated), message: '🌱 '+ft.name+' 已种植' })
  } catch(e:any) {
    logger.error('garden','种植失败',{error:e?.message})
    return jsonResponse(false, null, e?.message || '种植失败', 500)
  }
}
