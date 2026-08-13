import { NextRequest } from 'next/server'
import { updateUser, findUserById, createNotification, incrementTaskProgress, atomicCheckinMark } from '@/lib/server-store'
import { authRequest, jsonResponse, sanitizeUser, isSameDay } from '@/lib/auth'

export const runtime = 'edge'

// 每日签到奖励：大幅降低金币，保留少量花瓣
function getDailyReward(dayIndex: number /* 0..6 */): { coins: number; petals: number; label: string } {
  const cycle = [
    { coins: 20, petals: 0 },
    { coins: 30, petals: 0 },
    { coins: 40, petals: 0 },
    { coins: 50, petals: 1 },
    { coins: 60, petals: 1 },
    { coins: 80, petals: 2 },
    { coins: 150, petals: 5 }, // 第7天大奖励
  ]
  const r = cycle[dayIndex % cycle.length] || cycle[0]
  const label = dayIndex === 6 ? '7天大奖' : `第${dayIndex + 1}天`
  return { coins: r.coins, petals: r.petals || 0, label }
}

export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const u = (user as any)
    const lastCheckInAt = u.lastCheckInAt || 0
    const checkInStreak = u.checkInStreak || 0
    const lastDay = new Date(lastCheckInAt)
    const today = new Date()
    const checkedInToday = isSameDay(lastDay, today)

    // 判断是否断签：若昨天未签到，则断签
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const lastCheckDay = new Date(lastCheckInAt)
    const broken =
      lastCheckInAt > 0 &&
      !isSameDay(lastCheckDay, today) &&
      !isSameDay(lastCheckDay, yesterday)

    const streak = broken ? 0 : checkInStreak

    // 生成7天预览
    const dayIdx = broken ? 0 : (checkInStreak % 7)
    const preview = Array.from({ length: 7 }).map((_, i) => {
      const reward = getDailyReward(i)
      const claimed = broken
        ? false
        : checkedInToday
          ? i < dayIdx
          : i < dayIdx
      return {
        day: i + 1,
        coins: reward.coins,
        petals: reward.petals,
        label: reward.label,
        claimed,
        today: !checkedInToday && i === dayIdx,
      }
    })

    return jsonResponse(true, {
      checkedInToday,
      checkInStreak: streak,
      broken,
      lastCheckInAt,
      preview,
      petalCoins: u.petalCoins || 0,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const u: any = await findUserById(user.id)
    if (!u) return jsonResponse(false, null, '用户不存在', 404)
    const now = Date.now()
    const lastCheckInAt = u.lastCheckInAt || 0
    const checkInStreak = u.checkInStreak || 0

    const last = new Date(lastCheckInAt)
    const today = new Date(now)
    if (isSameDay(last, today)) return jsonResponse(false, null, '今天已经签到过了~', 400)

    // 原子标记签到（防并发重复签到）：仅当今天未签到时成功
    const marked = await atomicCheckinMark(u.id, now)
    if (!marked) return jsonResponse(false, null, '今天已经签到过了~', 400)

    // 原子标记成功后重新读取用户，基于最新数据计算奖励
    const fresh = await findUserById(u.id)
    if (!fresh) return jsonResponse(false, null, '用户不存在', 404)
    const freshStreak = fresh.checkInStreak || 0

    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const freshLastCheckIn = (fresh as any).lastCheckInAt || 0
    const broken = freshLastCheckIn > 0 && !isSameDay(new Date(freshLastCheckIn), yesterday)
    const nextStreak = broken ? 1 : (freshStreak + 1)
    const todayIndex = broken ? 0 : (freshStreak % 7)
    const reward = getDailyReward(todayIndex)

    // 发奖
    const patch: any = {
      lastCheckInAt: now,
      checkInStreak: nextStreak,
      coins: (fresh.coins || 0) + reward.coins,
      petalCoins: (fresh.petalCoins || 0) + reward.petals,
    }

    // 成就判定（签到成就）
    const achieves = (fresh.achievements || {}) as Record<string, { unlockedAt: number }>
    const ACHIEVEMENTS = [
      { k: 'checkin_1day',   need: 1,   name: '初次签到',   desc: '完成第一次每日签到' },
      { k: 'checkin_7day',   need: 7,   name: '周常达人',   desc: '累计签到7天' },
      { k: 'checkin_30day',  need: 30,  name: '勤奋园丁',   desc: '累计签到30天' },
      { k: 'checkin_100day', need: 100, name: '百日守护',   desc: '累计签到100天' },
    ]
    let totalCheckinDays = (fresh.totalCheckinDays || 0) + 1
    patch.totalCheckinDays = totalCheckinDays
    const newlyUnlocked: string[] = []
    const totalAll = (fresh.totalCheckinDaysAccum || 0) + 1  // 总签到天数
    patch.totalCheckinDaysAccum = totalAll
    const newTitles = Array.isArray(fresh.titles) ? [...fresh.titles] : []
    for (const a of ACHIEVEMENTS) {
      if (!achieves[a.k] && totalAll >= a.need) {
        achieves[a.k] = { unlockedAt: now }
        newlyUnlocked.push(a.k)
        if (a.k === 'checkin_1day' && !newTitles.includes('newbie')) newTitles.push('newbie')
        if (a.k === 'checkin_7day' && !newTitles.includes('checkin_dragon')) newTitles.push('checkin_dragon')
        if (a.k === 'checkin_30day' && !newTitles.includes('expert')) newTitles.push('expert')
        if (a.k === 'checkin_100day' && !newTitles.includes('master')) newTitles.push('master')
      }
    }
    if (newlyUnlocked.length > 0) patch.achievements = achieves
    if (newTitles.length > 0) patch.titles = newTitles

    const updated = await updateUser(fresh.id, patch)

    // 推送消息
    await createNotification({
      userId: fresh.id,
      type: 'reward',
      title: `每日签到 - ${reward.label}`,
      content: `签到成功，获得 ${reward.coins} 金币${reward.petals ? ` + ${reward.petals} 花瓣` : ''}！`,
    })
    for (const k of newlyUnlocked) {
      const def = ACHIEVEMENTS.find(a => a.k === k)!
      await createNotification({
        userId: fresh.id,
        type: 'achievement',
        title: `🏆 成就解锁：${def.name}`,
        content: def.desc,
      })
    }

    // 任务进度
    await incrementTaskProgress(fresh.id, 'login', 1)
    await incrementTaskProgress(fresh.id, 'daily_checkin', 1)
    // 周常·富豪：签到获得金币计入累计获得
    try { if (reward.coins > 0) await incrementTaskProgress(fresh.id, 'earn_coin', reward.coins) } catch {}

    return jsonResponse(true, {
      user: updated ? sanitizeUser(updated) : null,
      reward,
      nextStreak,
      newlyUnlocked,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
