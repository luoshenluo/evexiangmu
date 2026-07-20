// EVE Echoes API 服务层
// 封装对 http://echoes.mobi/api 的调用，提供数据缓存、中文翻译和计算

const API_BASE = 'http://echoes.mobi/api';
const CACHE_TTL = 1000 * 60 * 60; // 1小时缓存

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCacheKey(endpoint: string): string {
  return `echoes_cache_${endpoint}`;
}

function getFromCache<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

/** 解析 CSV 文本为对象数组 */
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const result: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });
    result.push(obj);
  }
  return result;
}

async function fetchCSV(endpoint: string): Promise<Record<string, string>[]> {
  const cacheKey = getCacheKey(endpoint);
  const cached = getFromCache<Record<string, string>[]>(cacheKey);
  if (cached) return cached;
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const data = parseCSV(text);
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error(`[echoes-api] 获取 ${endpoint} 失败:`, err);
    return [];
  }
}

// ==================== 类型定义 ====================

export interface EchoesIndustrySkill {
  name: string;
  /** 效率数组（每级减少的材料百分比），如 "4,8,12,16,20" 解析为 [4,8,12,16,20] */
  efficiencyPerLevel: number[];
  /** 时间数组（每级减少的时间百分比），如 "-0.05,-0.1,-0.15,-0.2,-0.25" */
  timePerLevel: number[];
}

export interface EchoesBlueprintMaterial {
  id: string;
  name: string;
  type: string;
  quantity: number;
}

export interface EchoesBlueprint {
  id: string;
  name: string;
  category_name: string;
  group_name: string;
  output_number: number;
  skill_level: number;
  manufacture_cost: number;
  manufacture_time: number;
  decryptor_amount: number;
  iconId: string;
  item_id: string;
  skills: string[];
  materials: EchoesBlueprintMaterial[];
  iconUrl: string;
}

export interface EchoesItem {
  id: string;
  name: string;
  category_name: string;
  group_name: string;
  weekly_average_price: number;
  icon_id: string;
  icon_url: string;
}

// ==================== 中英文映射表 ====================

const NAME_ZH_MAP: Record<string, string> = {
  'Tritanium': '三钛合金', 'Pyerite': '类银超金属', 'Mexallon': '类晶体胶矿',
  'Isogen': '同位聚合体', 'Nocxium': '超新星诺克石', 'Zydrine': '晶状石英核岩',
  'Megacyte': '超噬矿', 'Morphite': '莫尔石',
  'Base Metals': '基础金属', 'Heavy Metals': '重金属', 'Noble Metals': '贵金属',
  'Precious Metals': '稀有金属', 'Reactive Metals': '反应金属', 'Toxic Metals': '有毒金属',
  'Non-CS Crystals': '非晶态晶体', 'Crystalline Carbonide': '晶体碳化物',
  'Conductive Polymer': '导电聚合物', 'Industrial Fibers': '工业纤维',
  'Coolant': '冷却剂', 'Oxygen Isotopes': '氧同位素',
  'Noble Gas': '稀有气体', 'Reactive Gas': '反应气体',
  'Gleaming Alloy': '光泽合金', 'Lustering Alloy': '光彩合金',
  'Condensed Alloy': '浓缩合金', 'Precious Alloy': '精密合金',
  'Motley Compound': '杂色复合物', 'Fiber Composite': '纤维复合物',
  'Lucent Compound': '透光复合物', 'Glossy Compound': '多样复合物',
  'Sheen Compound': '光滑复合物', 'Dark Compound': '黑暗复合物',
  'Crystal Compound': '晶体复合物', 'Opulent Compound': '奢华复合物',
  'Nanotransistors': '纳米晶体管', 'Smartfab Units': '智能织物单元',
  'Condensates': '冷凝物', 'Nanites': '纳米修复膏',
  'Construction Blocks': '建筑模块', 'Ferrogel': '铁凝胶',
  'Silicate Glass': '硅酸盐玻璃', 'Supertensile Plastics': '超张力塑料',
  'Titanium Carbide': '碳化钛', 'Hexite': '六钛合金',
  'Phenolic Composites': '酚醛复合材料', 'Polyaramids': '聚芳酰胺',
  'PPD Fullerene Fiber': 'PPD富勒烯纤维', 'Sylramic Fibers': '赛拉米克纤维',
  'Reinforced Carbon Fiber': '强化碳纤维',
  'Fullerite-C50': '富勒烯-C50', 'Fullerite-C60': '富勒烯-C60', 'Fullerite-C70': '富勒烯-C70',
  'Fullerides': '富勒化物', 'Fullerene Intercalated Graphite': '富勒烯插层石墨',
  'Fullero-Ferrocene': '富勒二茂铁',
  'Blue Star Crystal': '蓝星水晶', 'Pink Star Crystal': '粉星水晶',
  'Purple Star Crystal': '紫星水晶', 'Chromatic Star Crystal': '彩色星水晶',
  'Black Moon Ore': '黑月矿', 'Brown Moon Ore': '棕月矿',
  'Gray Moon Ore': '灰月矿', 'Motley Moon Ore': '杂色月矿',
  'Accelerant Decryptor': '加速解码器', 'Attainment Decryptor': '达成解码器',
  'Augmentation Decryptor': '扩充解码器', 'Parity Decryptor': '奇偶解码器',
  'Process Decryptor': '工艺解码器', 'Symmetry Decryptor': '对称解码器',
  'Optimized Augmentation': '优化扩充', 'Optimized Attainment': '优化达成',
  'Burned Logic Circuit': '烧毁逻辑电路', 'Charred Micro Circuit': '烧焦微电路',
  'Fried Interface Circuit': '熔断接口电路', 'Tripped Power Circuit': '跳闸电源电路',
  'Damaged Artificial Neural Network': '损坏的人工神经网络',
  'Defective Current Pump': '缺陷电流泵',
  'Contaminated Lorentz Fluid': '污染洛伦兹流体',
  'Contaminated Nanite Polymer': '污染纳米聚合物',
  'Scorched Telemetry Processor': '烧焦遥测处理器',
  'Smashed Trigger Unit': '碎裂触发单元',
  'Drone Data Fluid': '无人机数据流体', 'Drone Power Core': '无人机能量核心',
  'Drone Synaptic Relay Wiring': '无人机突触中继线',
  'Drone Elastic Shell': '无人机弹性外壳',
  'Drone Computing Unit': '无人机计算单元',
  'Drone Smart Chip': '无人机智能芯片', 'Drone Tactical Limb': '无人机战术肢体',
  'Capital Burned Logic Circuit': '大型烧毁逻辑电路',
  'Capital Capacitor Battery': '大型电容器电池',
  'Capital Conductive Polymer': '大型导电聚合物',
  'Capital Construction Parts': '大型建筑构件',
  'Capital Contaminated Lorentz Fluid': '大型污染洛伦兹流体',
  'Capital Contaminated Nanite Compound': '大型污染纳米化合物',
  'Capital Damaged Artificial Neural Network': '大型损坏人工神经网络',
  'Capital Defective Current Pump': '大型缺陷电流泵',
  'Capital Armor Plates': '大型装甲板', 'Capital Cargo Bay': '大型货舱',
  'Capital Clone Vat Bay': '大型克隆舱湾',
  'Capital Computer System': '大型计算机系统',
  'Capital Corporate Hangar Bay': '大型公司机库舱',
  'Capital Doomsday Weapon Mount': '大型末日武器挂架',
  'Capital Drone Bay': '大型无人机舱',
  'Capital Jump Drive': '大型跳跃驱动器',
  'Capital Launcher Hardpoint': '大型发射器硬点',
  'Capital Power Generator': '大型发电机',
  'Capital Propulsion Engine': '大型推进引擎',
  'Capital Sensor Cluster': '大型传感器集群',
  'Capital Shield Emitter': '大型护盾发射器',
  'Capital Ship Maintenance Bay': '大型舰船维护舱',
  'Capital Siege Array': '大型攻城阵列',
  'Capital Turret Hardpoint': '大型炮塔硬点',
  'Structure Construction Parts': '建筑构件',
  'Structure Core Stabilizer': '建筑核心稳定器',
  'Capacitor Control Center': '电容控制中心',
  'Life Support Unit': '生命维持单元',
};

/** 将英文名翻译为中文 */
export function toChineseName(name: string): string {
  if (!name) return '';
  return NAME_ZH_MAP[name.trim()] || name.trim();
}

// ==================== 技能名称中文映射 ====================

const SKILL_ZH_MAP: Record<string, string> = {
  'Frigate Manufacture': '护卫舰制造', 'Destroyer Manufacture': '驱逐舰制造',
  'Cruiser Manufacture': '巡洋舰制造', 'Battlecruiser Manufacture': '战列巡洋舰制造',
  'Battleship Manufacture': '战列舰制造', 'Industrial Ship Manufacture': '工业舰制造',
  'Capital Ship Manufacture': '旗舰制造', 'Carrier Manufacture': '航母制造',
  'Dreadnought Manufacture': '无畏舰制造', 'Freighter Manufacture': '货舰制造',
  'Jump Freighter Manufacture': '跳跃货舰制造',
  'Capital Industrial Ship Manufacture': '旗舰工业舰制造',
  'Advanced Frigate Manufacture': '进阶护卫舰制造', 'Advanced Destroyer Manufacture': '进阶驱逐舰制造',
  'Advanced Cruiser Manufacture': '进阶巡洋舰制造', 'Advanced Battlecruiser Manufacture': '进阶战列巡洋舰制造',
  'Advanced Battleship Manufacture': '进阶战列舰制造', 'Advanced Industrial Ship Manufacture': '进阶工业舰制造',
  'Advanced Capital Ship Manufacture': '进阶旗舰制造', 'Advanced Carrier Manufacture': '进阶航母制造',
  'Advanced Dreadnought Manufacture': '进阶无畏舰制造', 'Advanced Freighter Manufacture': '进阶货舰制造',
  'Advanced Jump Freighter Manufacture': '进阶跳跃货舰制造',
  'Advanced Capital Industrial Ship Manufacture': '进阶旗舰工业舰制造',
  'Expert Frigate Manufacture': '专家护卫舰制造', 'Expert Destroyer Manufacture': '专家驱逐舰制造',
  'Expert Cruiser Manufacture': '专家巡洋舰制造', 'Expert Battlecruiser Manufacture': '专家战列巡洋舰制造',
  'Expert Battleship Manufacture': '专家战列舰制造', 'Expert Industrial Ship Manufacture': '专家工业舰制造',
  'Expert Capital Ship Manufacture': '专家旗舰制造', 'Expert Carrier Manufacture': '专家航母制造',
  'Expert Dreadnought Manufacture': '专家无畏舰制造', 'Expert Freighter Manufacture': '专家货舰制造',
  'Expert Jump Freighter Manufacture': '专家跳跃货舰制造',
  'Expert Capital Industrial Ship Manufacture': '专家旗舰工业舰制造',
  'Module Manufacture': '模块制造', 'Advanced Module Manufacture': '进阶模块制造',
  'Capital Module Manufacture': '旗舰模块制造',
  'Advanced Capital Module Manufacture': '进阶旗舰模块制造',
  'Expert Module Manufacture': '专家模块制造',
  'Expert Capital Module Manufacture': '专家旗舰模块制造',
  'Ammunition Manufacture': '弹药制造', 'Advanced Ammunition Manufacture': '进阶弹药制造',
  'Expert Ammunition Manufacture': '专家弹药制造',
  'Chip Manufacture': '芯片制造', 'Advanced Chip Manufacture': '进阶芯片制造',
  'Expert Chip Manufacture': '专家芯片制造',
  'Implant Manufacture': '植入体制造', 'Advanced Implant Manufacture': '进阶植入体制造',
  'Expert Implant Manufacture': '专家植入体制造',
  'Rig Manufacture': '改装件制造', 'Advanced Rig Manufacture': '进阶改装件制造',
  'Expert Rig Manufacture': '专家改装件制造',
  'Capital Rig Manufacture': '旗舰改装件制造',
  'Advanced Capital Rig Manufacture': '进阶旗舰改装件制造',
  'Expert Capital Rig Manufacture': '专家旗舰改装件制造',
  'Structure Construction': '建筑建造', 'Advanced Structure Construction': '进阶建筑建造',
  'Expert Structure Construction': '专家建筑建造',
  'Polymer Material Manufacture': '聚合物材料制造',
  'Advanced Polymer Material Manufacture': '进阶聚合物材料制造',
  'Expert Polymer Material Manufacture': '专家聚合物材料制造',
  'Capital Ship Component Manufacture': '旗舰组件制造',
  'Advanced Capital Ship Component Manufacture': '进阶旗舰组件制造',
  'Expert Capital Ship Component Manufacture': '专家旗舰组件制造',
};

/** 将技能名翻译为中文 */
export function toSkillChineseName(name: string): string {
  return SKILL_ZH_MAP[name.trim()] || name.trim();
}

// ==================== 数据获取 ====================

/** 获取工业制造技能列表（自动翻译为中文） */
export async function fetchIndustrySkills(): Promise<EchoesIndustrySkill[]> {
  const rows = await fetchCSV('/v2/industry_skills');
  return rows.map((r) => {
    const effStr = r.efficiency || '';
    const timeStr = r.time || '';
    return {
      name: toSkillChineseName(r.name || ''),
      efficiencyPerLevel: effStr.split(',').map((s) => parseFloat(s.trim()) || 0),
      timePerLevel: timeStr.split(',').map((s) => parseFloat(s.trim()) || 0),
    };
  }).filter((s) => s.name);
}

/** 获取蓝图数据库（材料名自动翻译为中文） */
export async function fetchBlueprints(): Promise<EchoesBlueprint[]> {
  const rows = await fetchCSV('/v2/item_blueprints');
  return rows.map((r) => {
    const materials: EchoesBlueprintMaterial[] = [];
    for (let i = 0; i < 30; i++) {
      const id = r[`materials.${i}.id`] || '';
      const name = r[`materials.${i}.name`] || '';
      const type = r[`materials.${i}.type`] || '';
      const qty = r[`materials.${i}.quantity`] || '';
      if (id && name) {
        materials.push({ id, name: toChineseName(name), type, quantity: parseInt(qty, 10) || 0 });
      }
    }
    const skillsStr = r.skills || '';
    return {
      id: r.id || '',
      name: toChineseName(r.name || ''),
      category_name: r.category_name || '',
      group_name: r.group_name || '',
      output_number: parseInt(r.output_number, 10) || 1,
      skill_level: parseInt(r.skill_level, 10) || 0,
      manufacture_cost: parseInt(r.manufacture_cost, 10) || 0,
      manufacture_time: parseInt(r.manufacture_time, 10) || 0,
      decryptor_amount: parseInt(r.decryptor_amount, 10) || 0,
      iconId: r.iconId || '',
      item_id: r.item_id || '',
      skills: skillsStr ? skillsStr.split(',').map((s) => toSkillChineseName(s.trim())) : [],
      materials,
      iconUrl: r.iconId ? `https://echoes.mobi/public/icons/${r.iconId}.png` : '',
    };
  }).filter((b) => b.id && b.name);
}

/** 获取物品价格 */
export async function fetchItemPrices(): Promise<Record<string, number>> {
  const rows = await fetchCSV('/v2/item_prices');
  const prices: Record<string, number> = {};
  rows.forEach((r) => {
    const id = r.id || r.item_id || '';
    const price = parseFloat(r.price || r.sell_price || r.avg_price || '0');
    if (id && price > 0) prices[id] = price;
  });
  return prices;
}

/** 获取物品列表 */
export async function fetchItems(): Promise<EchoesItem[]> {
  const rows = await fetchCSV('/items');
  return rows.map((r) => ({
    id: r.id || '',
    name: toChineseName(r.name || ''),
    category_name: r.category_name || '',
    group_name: r.group_name || '',
    weekly_average_price: parseFloat(r.weekly_average_price) || 0,
    icon_id: r.icon_id || '',
    icon_url: r.icon_url || (r.icon_id ? `https://echoes.mobi/public/icons/${r.icon_id}.png` : ''),
  })).filter((i) => i.id && i.name);
}

// ==================== 军团数据 ====================

export interface CorpModule {
  name: string;
  nameZh: string;
  maxLevel: number;
  /** 每级材料效率加成（百分比） */
  meBonusPerLevel: number;
  /** 每级时间效率加成（百分比，负数表示减少） */
  teBonusPerLevel: number;
}

export interface CorpTech {
  name: string;
  nameZh: string;
  maxLevel: number;
  meBonusPerLevel: number;
  teBonusPerLevel: number;
}

/** 军团模块数据（模仿 echoes.mobi） */
export const CORP_MODULES: CorpModule[] = [
  { name: 'Assembly Workshop Module', nameZh: '装配车间模块', maxLevel: 3, meBonusPerLevel: 1, teBonusPerLevel: -0.5 },
  { name: 'Capital Ship Parts Factory Module', nameZh: '旗舰部件工厂模块', maxLevel: 3, meBonusPerLevel: 1, teBonusPerLevel: -0.5 },
];

/** 军团科技数据 */
export const CORP_TECHS: CorpTech[] = [
  { name: 'Manufacturing Technology', nameZh: '制造技术', maxLevel: 3, meBonusPerLevel: 1, teBonusPerLevel: -1 },
  { name: 'Advanced Manufacturing Technology', nameZh: '进阶制造技术', maxLevel: 5, meBonusPerLevel: 1, teBonusPerLevel: -1 },
  { name: 'Advanced Manufacturing Technology II', nameZh: '进阶制造技术 II', maxLevel: 5, meBonusPerLevel: 1, teBonusPerLevel: -1 },
];

// ==================== Decryptor 数据 ====================

export interface Decryptor {
  id: string;
  name: string;
  meModifier: number;
  teModifier: number;
  runModifier: number;
  probabilityModifier: number;
}

export const PRESET_DECRYPTORS: Decryptor[] = [
  { id: 'd1', name: '加速解码器', meModifier: 2, teModifier: 10, runModifier: 1, probabilityModifier: 20 },
  { id: 'd2', name: '达成解码器', meModifier: 4, teModifier: -2, runModifier: 2, probabilityModifier: 40 },
  { id: 'd3', name: '扩充解码器', meModifier: -2, teModifier: 4, runModifier: 9, probabilityModifier: 20 },
  { id: 'd4', name: '奇偶解码器', meModifier: 1, teModifier: -2, runModifier: 3, probabilityModifier: 40 },
  { id: 'd5', name: '工艺解码器', meModifier: 3, teModifier: 6, runModifier: 0, probabilityModifier: 10 },
  { id: 'd6', name: '对称解码器', meModifier: 1, teModifier: 8, runModifier: 2, probabilityModifier: 30 },
  { id: 'd7', name: '优化扩充', meModifier: -1, teModifier: 3, runModifier: 7, probabilityModifier: 30 },
  { id: 'd8', name: '优化达成', meModifier: 3, teModifier: -1, runModifier: 3, probabilityModifier: 50 },
];

// ==================== 技能计算 ====================

/** 根据技能名和等级获取材料效率（返回减少的百分比，如 -4 表示减少4%） */
export function getSkillME(skillName: string, level: number, skills: EchoesIndustrySkill[]): number {
  const skill = skills.find((s) => s.name === skillName);
  if (!skill || level <= 0) return 0;
  const idx = Math.min(level - 1, skill.efficiencyPerLevel.length - 1);
  return -(skill.efficiencyPerLevel[idx] || 0) / 100; // 转为负数
}

/** 根据技能名和等级获取时间效率 */
export function getSkillTE(skillName: string, level: number, skills: EchoesIndustrySkill[]): number {
  const skill = skills.find((s) => s.name === skillName);
  if (!skill || level <= 0) return 0;
  const idx = Math.min(level - 1, skill.timePerLevel.length - 1);
  return skill.timePerLevel[idx] || 0;
}

/** 从蓝图技能列表和用户配置中找到最佳匹配的制造技能ME */
export function getBestSkillME(blueprintSkills: string[], userSkillLevels: Record<string, number>, allSkills: EchoesIndustrySkill[]): number {
  let bestME = 0;
  for (const skillName of blueprintSkills) {
    const level = userSkillLevels[skillName] || 0;
    if (level > 0) {
      const me = getSkillME(skillName, level, allSkills);
      if (me < bestME) bestME = me; // 取最负值（最大减免）
    }
  }
  return bestME;
}

/** 从蓝图技能列表和用户配置中找到最佳匹配的制造技能TE */
export function getBestSkillTE(blueprintSkills: string[], userSkillLevels: Record<string, number>, allSkills: EchoesIndustrySkill[]): number {
  let bestTE = 0;
  for (const skillName of blueprintSkills) {
    const level = userSkillLevels[skillName] || 0;
    if (level > 0) {
      const te = getSkillTE(skillName, level, allSkills);
      if (te < bestTE) bestTE = te;
    }
  }
  return bestTE;
}

// ==================== 分类 → 技能映射 ====================

/** 项目分类 → 技能关键词（用于匹配 Base/Advanced/Expert 三级技能） */
export const CATEGORY_SKILL_KEYWORDS: Record<string, string[]> = {
  '护卫舰级': ['Frigate Manufacture'],
  '驱逐舰级': ['Destroyer Manufacture'],
  '巡洋舰级': ['Cruiser Manufacture'],
  '战巡舰级': ['Battlecruiser Manufacture'],
  '战列舰级': ['Battleship Manufacture'],
  '工业舰': ['Industrial Ship Manufacture'],
  '运输舰': ['Freighter Manufacture'],
  '旗舰级': ['Capital Ship Manufacture'],
  '航母级': ['Carrier Manufacture'],
  '无畏舰级': ['Dreadnought Manufacture'],
  '旗舰工业舰': ['Capital Industrial Ship Manufacture'],
  '跳跃货舰级': ['Jump Freighter Manufacture'],
  '模块': ['Module Manufacture'],
  '旗舰模块': ['Capital Module Manufacture'],
  '弹药': ['Ammunition Manufacture'],
  '芯片': ['Chip Manufacture'],
  '植入体': ['Implant Manufacture'],
  '改装件': ['Rig Manufacture'],
  '旗舰改装件': ['Capital Rig Manufacture'],
  '建筑': ['Structure Construction'],
  '聚合物材料': ['Polymer Material Manufacture'],
  '旗舰组件': ['Capital Ship Component Manufacture'],
};

/** 从 localStorage 读取技能配置 */
export function loadUserSkills(): Record<string, number> {
  try {
    const raw = localStorage.getItem('eve_echoes_skills_v1');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** 判断技能是否与分类匹配 */
export function isSkillRelevant(skillEngName: string, category: string): boolean {
  if (!category) return false;
  const keywords = CATEGORY_SKILL_KEYWORDS[category];
  if (!keywords) return false;
  return keywords.some((kw) => skillEngName.includes(kw));
}

/** 计算指定分类的技能ME总减免（正数=减少的百分比点）
 * 规则：Base 技能每级 -6%，Advanced 每级 -4%，Expert 每级 -3%
 * 不再依赖 API 数据，直接根据技能英文名关键词判定
 */
export function calcCategorySkillMEReduction(
  category: string,
  userSkills: Record<string, number>,
): { totalReduction: number; matchedSkills: { name: string; level: number; reduction: number }[] } {
  let totalReduction = 0;
  const matchedSkills: { name: string; level: number; reduction: number }[] = [];
  Object.entries(userSkills).forEach(([engName, level]) => {
    if (level > 0 && isSkillRelevant(engName, category)) {
      const zhName = toSkillChineseName(engName);
      let reductionPerLevel = 0.06; // Base: 6%
      if (engName.includes('Advanced')) reductionPerLevel = 0.04;
      else if (engName.includes('Expert')) reductionPerLevel = 0.01;
      const reduction = reductionPerLevel * level;
      totalReduction += reduction;
      matchedSkills.push({ name: zhName, level, reduction });
    }
  });
  return { totalReduction, matchedSkills };
}

/** 从 localStorage 读取军团配置 */
export function loadCorpConfig(): { modules: Record<string, number>; techs: Record<string, number> } {
  try {
    const raw = localStorage.getItem('eve_echoes_corp_v1');
    if (raw) {
      const data = JSON.parse(raw);
      return { modules: data.modules || {}, techs: data.techs || {} };
    }
  } catch { /* ignore */ }
  return { modules: {}, techs: {} };
}

/** 计算军团总材料效率减少量（正数=减少的百分比点） */
export function calcCorpMEReduction(corp: ReturnType<typeof loadCorpConfig>): number {
  let reduction = 0;
  for (const mod of CORP_MODULES) {
    const lv = corp.modules[mod.name] || 0;
    reduction += mod.meBonusPerLevel * lv;
  }
  for (const tech of CORP_TECHS) {
    const lv = corp.techs[tech.name] || 0;
    reduction += tech.meBonusPerLevel * lv;
  }
  return reduction;
}
