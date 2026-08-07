import { NextRequest } from 'next/server'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'
import { redeemCDK, updateUser } from '@/lib/server-store'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    let body: any
    try { body = await req.json() } catch { return jsonResponse(false,null,'请求格式错误',400) }
    const code = String(body?.code || '').trim().toUpperCase()
    if (!code) return jsonResponse(false,null,'请输入CDK',400)
    const res = await redeemCDK(user, code)
    if (!res.success) return jsonResponse(false, null, res.message, 400)
    let newInv = [...(user.inventory || [])]
    let coins = (user.coins || 0) + (res.rewards?.coins || 0)
    const details: string[] = []
    if (res.rewards?.coins) details.push('💰 '+res.rewards.coins+' 金币')
    if (res.rewards?.items) {
      for (const r of res.rewards.items) {
        const isSeed = r.type === 'seed'
        const ex = newInv.find(i => i && i.type===r.type && i.referenceId===r.referenceId)
        if (ex) { const i = newInv.indexOf(ex); newInv[i] = {...ex, quantity:(ex.quantity||0)+r.quantity} }
        else newInv.push({id:'cdk_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),type:r.type,referenceId:r.referenceId,name:r.referenceId,emoji:isSeed?'🌱':'🎁',quantity:r.quantity,maxStack:99,sellable:!isSeed,tradeable:true})
        details.push((isSeed?'🌱 ':'🎁 ')+r.referenceId+' × '+r.quantity)
      }
    }
    const updated = await updateUser(user.id, { coins, inventory: newInv })
    if (!updated) return jsonResponse(false, null, '写入用户失败', 500)
    logger.info('system','CDK兑换',{userId:user.id,code})
    return jsonResponse(true, { user: sanitizeUser(updated), message: '🎉 兑换成功：'+details.join('，'), rewards: res.rewards })
  } catch(e:any) {
    logger.error('system','CDK兑换失败',{error:e?.message})
    return jsonResponse(false,null,e?.message||'兑换失败',500)
  }
}
