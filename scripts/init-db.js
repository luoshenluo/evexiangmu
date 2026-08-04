// Supabase 数据库初始化脚本
// 使用方法：在 Supabase SQL Editor 中执行 supabase/schema.sql
// 或在本地运行：node scripts/init-db.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('请设置 SUPABASE_URL 和 SUPABASE_SECRET_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function execSql(sql, description) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.log(`  [跳过] ${description}: ${error.message}`);
      return false;
    }
    console.log(`  [成功] ${description}`);
    return true;
  } catch (e) {
    console.log(`  [错误] ${description}: ${e.message}`);
    return false;
  }
}

async function main() {
  const sqlFile = process.argv[2] || path.join(__dirname, '..', 'supabase', 'schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('=== Supabase 数据库初始化 ===');
  console.log(`SQL 文件: ${sqlFile}`);
  console.log('');

  // 先创建 exec_sql 辅助函数
  console.log('步骤 1: 创建 exec_sql 辅助函数...');
  const execSqlFn = `
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT) RETURNS VOID AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
  const created = await execSql(execSqlFn, '创建 exec_sql 函数');

  if (!created) {
    console.log('\n⚠️  无法创建 exec_sql 函数。');
    console.log('请在 Supabase SQL Editor 中手动执行以下 SQL：\n');
    console.log('```sql');
    console.log(execSqlFn);
    console.log('```\n');
    console.log('然后重新运行此脚本。');
    process.exit(1);
  }

  // 分割 SQL 语句并逐条执行
  console.log('\n步骤 2: 执行 Schema SQL...');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let success = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const firstLine = stmt.split('\n')[0].trim().substring(0, 60);
    console.log(`  [${i + 1}/${statements.length}] ${firstLine}...`);

    const ok = await execSql(stmt, firstLine);
    if (ok) {
      success++;
    } else {
      skipped++;
    }
  }

  console.log(`\n=== 完成: ${success} 成功, ${skipped} 跳过 ===`);

  // 验证关键表
  console.log('\n步骤 3: 验证数据库...');
  const tables = ['users', 'game_state', 'listings', 'announcements', 'messages'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`  ${table}: ❌ ${error.message}`);
    } else {
      const count = data?.length || 0;
      console.log(`  ${table}: ✅ ${count} 条记录`);
    }
  }
}

main().catch(e => {
  console.error('初始化失败:', e.message);
  process.exit(1);
});
