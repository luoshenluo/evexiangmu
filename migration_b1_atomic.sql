-- ============================================================
-- B1 安全修复：原子 RPC 全集（防并发刷奖励/复制道具/偷花竞态）
-- 在 Supabase SQL Editor 手动执行（幂等，可重复执行）
--
-- 覆盖：
--   H5 原子 RPC 缺失 → atomic_add_coins / atomic_spend_coins /
--      atomic_add_petals / atomic_sell_inventory_item /
--      atomic_add_inventory_item
--   H4 偷花竞态     → plot_steal_records 唯一索引 +
--      atomic_steal_claim_plot / atomic_steal_take_flower
-- ============================================================

-- ============ 去重并加唯一约束：同一地块同一受害者只留一条记录 ============
DELETE FROM plot_steal_records
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY victim_id, plot_id ORDER BY stolen_at DESC) AS rn
    FROM plot_steal_records
  ) t WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plot_steal_plot
  ON plot_steal_records (victim_id, plot_id);

-- ============ 金币原子加 ============
CREATE OR REPLACE FUNCTION atomic_add_coins(p_user_id TEXT, p_amount BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users SET coins = coins + p_amount WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;

-- ============ 金币原子扣（余额不足返回 false） ============
CREATE OR REPLACE FUNCTION atomic_spend_coins(p_user_id TEXT, p_cost BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users SET coins = coins - p_cost WHERE id = p_user_id AND coins >= p_cost;
  RETURN FOUND;
END;
$$;

-- ============ 花瓣原子加 ============
CREATE OR REPLACE FUNCTION atomic_add_petals(p_user_id TEXT, p_amount BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users SET petal_coins = petal_coins + p_amount WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;

-- ============ 原子扣库存（按 item.id，数量不足返回 false） ============
CREATE OR REPLACE FUNCTION atomic_consume_inventory_item(
  p_user_id TEXT,
  p_item_id TEXT,
  p_qty INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_inv      JSONB;
  v_new_inv  JSONB := '[]'::JSONB;
  v_elem     JSONB;
  v_cur      INTEGER;
  v_found    BOOLEAN := FALSE;
BEGIN
  SELECT inventory INTO v_inv FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_inv IS NULL THEN RETURN FALSE; END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_inv) LOOP
    IF v_elem->>'id' = p_item_id THEN
      v_found := TRUE;
      v_cur := COALESCE((v_elem->>'quantity')::INTEGER, 0);
      IF v_cur < p_qty THEN RETURN FALSE; END IF;
      IF v_cur = p_qty THEN
        CONTINUE; -- 移除该元素
      END IF;
      v_elem := jsonb_set(v_elem, '{quantity}', to_jsonb(v_cur - p_qty));
    END IF;
    v_new_inv := v_new_inv || jsonb_build_array(v_elem);
  END LOOP;

  IF NOT v_found THEN RETURN FALSE; END IF;
  UPDATE users SET inventory = v_new_inv WHERE id = p_user_id;
  RETURN TRUE;
END;
$$;

-- ============ 原子卖出：扣库存 + 加金币（一步完成，防复制道具/刷钱） ============
CREATE OR REPLACE FUNCTION atomic_sell_inventory_item(
  p_user_id TEXT,
  p_item_id TEXT,
  p_qty INTEGER,
  p_coins BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_inv      JSONB;
  v_new_inv  JSONB := '[]'::JSONB;
  v_elem     JSONB;
  v_cur      INTEGER;
  v_found    BOOLEAN := FALSE;
BEGIN
  SELECT inventory INTO v_inv FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_inv IS NULL THEN RETURN FALSE; END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_inv) LOOP
    IF v_elem->>'id' = p_item_id THEN
      v_found := TRUE;
      v_cur := COALESCE((v_elem->>'quantity')::INTEGER, 0);
      IF v_cur < p_qty THEN RETURN FALSE; END IF;
      IF v_cur = p_qty THEN
        CONTINUE;
      END IF;
      v_elem := jsonb_set(v_elem, '{quantity}', to_jsonb(v_cur - p_qty));
    END IF;
    v_new_inv := v_new_inv || jsonb_build_array(v_elem);
  END LOOP;

  IF NOT v_found THEN RETURN FALSE; END IF;
  UPDATE users SET inventory = v_new_inv, coins = coins + p_coins WHERE id = p_user_id;
  RETURN TRUE;
END;
$$;

-- ============ 原子加库存（含合并堆叠/背包满检查，返回新库存 jsonb） ============
-- p_item 为 item 对象（不含 id），若可合并则累加数量，否则追加新元素。
-- 背包满（占用格子数 >= p_inventory_size）且无法合并时返回 NULL。
CREATE OR REPLACE FUNCTION atomic_add_inventory_item(
  p_user_id TEXT,
  p_item JSONB,
  p_inventory_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_inv       JSONB;
  v_new_inv   JSONB;
  v_elem      JSONB;
  v_merged    BOOLEAN := FALSE;
  v_cur       INTEGER;
  v_max       INTEGER;
  v_new_qty   INTEGER;
  v_type      TEXT;
  v_ref       TEXT;
  v_rank      TEXT;
  v_used      INTEGER := 0;
  v_new_item  JSONB;
BEGIN
  SELECT inventory INTO v_inv FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_inv IS NULL THEN RETURN NULL; END IF;

  v_type := p_item->>'type';
  v_ref  := p_item->>'referenceId';
  v_rank := p_item->>'rank';
  v_new_item := p_item ||
    jsonb_build_object('id', 'inv_' || floor(extract(epoch FROM now()) * 1000)::text || '_' || substr(md5(random()::text), 1, 4));

  v_new_inv := '[]'::JSONB;
  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_inv) LOOP
    IF COALESCE((v_elem->>'quantity')::INTEGER, 0) > 0 THEN v_used := v_used + 1; END IF;

    IF NOT v_merged
       AND v_elem->>'type' = v_type
       AND v_elem->>'referenceId' = v_ref
       AND ((v_rank IS NULL) OR (v_elem->>'rank') = v_rank)
       AND COALESCE((v_elem->>'quantity')::INTEGER, 0) < COALESCE((v_elem->>'maxStack')::INTEGER, 99)
    THEN
      v_cur     := COALESCE((v_elem->>'quantity')::INTEGER, 0);
      v_max     := COALESCE((v_elem->>'maxStack')::INTEGER, 99);
      v_new_qty := LEAST(v_max, v_cur + COALESCE((p_item->>'quantity')::INTEGER, 1));
      v_elem    := jsonb_set(v_elem, '{quantity}', to_jsonb(v_new_qty));
      v_merged  := TRUE;
    END IF;
    v_new_inv := v_new_inv || jsonb_build_array(v_elem);
  END LOOP;

  IF NOT v_merged THEN
    IF v_used >= p_inventory_size THEN
      RETURN NULL; -- 背包已满
    END IF;
    v_new_inv := v_new_inv || jsonb_build_array(v_new_item);
  END IF;

  UPDATE users SET inventory = v_new_inv WHERE id = p_user_id;
  RETURN v_new_inv;
END;
$$;

-- ============ 偷花占位（防并发偷同一地块）：成功占用返回 true ============
-- 同 (victim_id, plot_id) 唯一，冷却未过时拒绝。
CREATE OR REPLACE FUNCTION atomic_steal_claim_plot(
  p_victim_id TEXT,
  p_plot_id   INTEGER,
  p_thief_id  TEXT,
  p_now       BIGINT,
  p_cooldown  BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_cnt INTEGER;
BEGIN
  WITH ins AS (
    INSERT INTO plot_steal_records (id, victim_id, plot_id, thief_id, stolen_at, reset_at)
    VALUES (
      'psr_' || p_now || '_' || p_thief_id || '_' || p_plot_id,
      p_victim_id, p_plot_id, p_thief_id, p_now, p_now + p_cooldown
    )
    ON CONFLICT (victim_id, plot_id) DO UPDATE
      SET reset_at = EXCLUDED.reset_at, thief_id = EXCLUDED.thief_id, stolen_at = EXCLUDED.stolen_at
      WHERE plot_steal_records.reset_at <= p_now
    RETURNING id
  )
  SELECT count(*) INTO v_cnt FROM ins;
  RETURN v_cnt = 1;
END;
$$;

-- ============ 偷花取走：原子移除受害者地块的花并补偿金币 ============
-- 返回 true 表示取走成功；false 表示地块已无花（已被偷/无花）
CREATE OR REPLACE FUNCTION atomic_steal_take_flower(
  p_victim_id  TEXT,
  p_plot_id    INTEGER,
  p_compensation BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_plots     JSONB;
  v_new_plots JSONB := '[]'::JSONB;
  v_elem      JSONB;
  v_found     BOOLEAN := FALSE;
BEGIN
  SELECT plots INTO v_plots FROM users WHERE id = p_victim_id FOR UPDATE;
  IF v_plots IS NULL THEN RETURN FALSE; END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_plots) LOOP
    IF (v_elem->>'id')::INTEGER = p_plot_id THEN
      IF (v_elem->'flower') IS NULL OR v_elem->'flower' = 'null'::JSONB THEN
        RETURN FALSE; -- 地块已无花
      END IF;
      v_found := TRUE;
      v_elem := v_elem || jsonb_build_object('flower', NULL::JSONB);
    END IF;
    v_new_plots := v_new_plots || jsonb_build_array(v_elem);
  END LOOP;

  IF NOT v_found THEN RETURN FALSE; END IF;
  IF p_compensation > 0 THEN
    UPDATE users SET plots = v_new_plots, coins = coins + p_compensation WHERE id = p_victim_id;
  ELSE
    UPDATE users SET plots = v_new_plots WHERE id = p_victim_id;
  END IF;
  RETURN TRUE;
END;
$$;
