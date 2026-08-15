# AGENTS.md

花园模拟经营全栈小游戏。Next.js 14 (App Router) + TypeScript strict + Tailwind + Zustand，后端为 Next.js Route Handlers + Supabase (PostgreSQL)，部署到 Cloudflare Pages（next-on-pages）。完整功能说明见 `项目说明书.md`，代码注释与 UI 均为中文。

## 常用命令（仅 npm，`.npmrc` 强制 legacy-peer-deps）

- `npm run dev` — 本地开发，自动读取 `.env.local`
- `npm run build:next` — 纯 Next.js 构建（本地验证用）
- `npm run build` — **next-on-pages 构建**（bash 语法脚本，Windows cmd/PowerShell 下直接运行会失败，用 Git Bash/WSL 或 CI），产物到 `.vercel/output/static` 并复制到 `dist/`
- `npm run pages:deploy` — next-on-pages 构建 + wrangler 部署 Cloudflare Pages
- `npm run lint` — next lint
- 类型检查：`npx tsc --noEmit`（无脚本）；仓库**没有任何测试**，改动后靠 `build:next` + `tsc` 验证

## 架构要点

- `lib/server-store.ts`（~3100 行）是唯一服务端数据层：所有 DB 读写、DB 行 ↔ User 对象映射（snake_case ↔ camelCase）、经济与任务逻辑都在这里。改数据逻辑先看这个文件。
- `lib/game-data.ts` 是前后端共享的游戏配置（花/种子/价格/季节/敏感词/轮盘）。改数值或规则必须改这里，保证前后端一致；不要在前端硬编码另一份。
- `lib/auth.ts`：jose JWT (HS256, 7d)，`SUPER_ADMIN_ID` 超级管理员，管理员权限为 8 位 bitwise 权限位。
- 客户端状态：`lib/store.ts`（zustand + localStorage 持久化）。
- **API 路由约定：`app/api/*/route.ts` 必须导出 `export const runtime = 'edge'`**（next-on-pages 要求；新增路由漏掉会导致 Cloudflare 部署失败）。Edge 限制：用 jose 而非 jsonwebtoken、bcryptjs、不能用 Node 专属 API。
- 请求/响应统一走 `lib/auth.ts` 的 `authRequest()` / `jsonResponse()` / `sanitizeUser()`。

## 数据库（Supabase，项目 evexiangmu，RLS 已禁用）

- 服务端用 `service_role` key 直连（`lib/supabase.ts`），绕过 RLS；前端只有 anon key。
- 基线 schema 在 `supabase/schema.sql`，但**线上库领先于它**：迭代通过仓库根目录的 SQL 文件手工执行（`migration_*.sql`、`supabase-*.sql`、`hotupdate_*.sql`、`sql_step*.sql`），或 `node scripts/init-db.js [sql文件]`（需 `SUPABASE_URL` + `SUPABASE_SECRET_KEY` 环境变量）。不要假设 schema.sql 反映当前列结构。
- 改库：新增/修改表加列 → 新建一个根目录 SQL 迁移文件，并在变更前检查 server-store 的缺列自修复逻辑。
- `.game-data/db.json` 是废弃的本地文件存储，代码已不再引用，勿再使用。

## 环境变量

`.env.example` 有模板；`.env.local` 已 gitignore。`lib/supabase.ts` 与 `scripts/init-db.js` 兼容多套命名（`SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL` 等）。

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 可进客户端
- `SUPABASE_SERVICE_ROLE_KEY`、`JWT_SECRET` — **绝不能出现在客户端代码或日志中**；Cloudflare 上用 wrangler secrets
- `SUPER_ADMIN_ID` — 可选覆盖超级管理员 ID（默认 `admin`）

## 安全约定（近期修复重点，勿回退）

- 金币/道具变动必须是**数据库原子操作**（如 `update ... set coins = coins - x` 加条件校验），禁止服务端 read-modify-write，否则并发刷奖励。
- 所有 GET 接口都要鉴权（历史上有 IDOR：`/api/user/[id]` 未登录可读他人数据）。
- SQL 文件中不得出现明文密码/真实 hash，种子账号用占位口令。
- 日志（`lib/logger.ts`）不得输出 token 或密码。
