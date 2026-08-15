// 经济体系重构迁移脚本（阶段7）
// 作用：
//  1. 清理官方挂售（只留基础种子 seed_daisy/seed_tulip/seed_sunflower + 工具，工具价改官方价）
//  2. 清理官方收购单为统一价
//  3. 清空所有非 admin 玩家的旧背包/地块，并重新赠送（3基础种子×3 + 除虫剂×5 + 1块地）
//  4. 保留金币/花瓣/好友/家族/任务/称号
// 用法：node scripts/economy-migrate.js
// 需环境变量：SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY（或 SUPABASE_SECRET_KEY）

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('请设置 SUPABASE_URL 和 SUPABASE_SECRET_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function createInitialPlots() {
  // 与 server-store 的 createInitialPlots(1) 保持一致：1 块已解锁地块
  return [
    {
      id: 1,
      unlocked: true,
      flower: null,
      unlockPrice: 30,
    },
  ];
}

function initialInventory() {
  // 与 createUser 的新手赠送一致
  return [
    { id: 'inv_s1', type: 'seed', referenceId: 'seed_daisy', name: '雏菊种子', emoji: '🌱', quantity: 3, maxStack: 99, sellable: false, tradeable: true },
    { id: 'inv_s2', type: 'seed', referenceId: 'seed_tulip', name: '郁金香种子', emoji: '🌱', quantity: 3, maxStack: 99, sellable: false, tradeable: true },
    { id: 'inv_s3', type: 'seed', referenceId: 'seed_sunflower', name: '向日葵种子', emoji: '🌱', quantity: 3, maxStack: 99, sellable: false, tradeable: true },
    { id: 'inv_t1', type: 'tool', referenceId: 'pesticide', name: '除虫剂', emoji: '🧴', quantity: 5, maxStack: 99, sellable: true, tradeable: true },
  ];
}

async function main() {
  console.log('=== 经济体系重构迁移 ===');

  // 1. 清理官方挂售
  const { error: e1 } = await supabase.from('listings').delete().eq('is_official', true).eq('item_type', 'flower');
  if (e1) console.error('清理官方花挂售失败:', e1.message);
  else console.log('[1] 已删除官方花挂售');

  const { error: e2 } = await supabase
    .from('listings')
    .delete()
    .eq('is_official', true)
    .eq('item_type', 'seed')
    .not('reference_id', 'in', '("seed_daisy","seed_tulip","seed_sunflower")');
  if (e2) console.error('清理官方高阶种子挂售失败:', e2.message);
  else console.log('[2] 已删除官方高阶种子挂售');

  // 工具价改官方价
  const toolPrices = { watering_can: 5, fertilizer: 8, pesticide: 10, speedup_card: 30 };
  for (const [refId, price] of Object.entries(toolPrices)) {
    await supabase.from('listings').update({ price }).eq('is_official', true).eq('reference_id', refId);
  }
  console.log('[3] 官方工具价已更新');

  // 2. 官方收购单统一价
  await supabase.from('buy_orders').update({ price: 30 }).eq('is_official', true).eq('reference_id', 'rose');
  await supabase.from('buy_orders').update({ price: 12 }).eq('is_official', true).eq('reference_id', 'daisy');
  console.log('[4] 官方收购单已恢复统一价');

  // 3. 玩家数据重置
  const { data: users, error: e3 } = await supabase.from('users').select('id, username').neq('is_admin', true);
  if (e3) {
    console.error('查询玩家失败:', e3.message);
  } else {
    let count = 0;
    for (const u of users || []) {
      if (u.username === 'admin') continue;
      await supabase.from('users').update({
        inventory: initialInventory(),
        plots: createInitialPlots(),
        inventory_size: 5,
      }).eq('id', u.id);
      count++;
    }
    console.log(`[5] 已重置 ${count} 名玩家的背包与地块并重新赠送`);
  }

  console.log('=== 迁移完成 ===');
}

main().catch((e) => {
  console.error('迁移失败:', e);
  process.exit(1);
});
