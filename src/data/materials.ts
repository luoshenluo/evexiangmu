// EXPORTS: IMaterialItem, ICalcParams, IPlanResult, IManufactureProject, DEFAULT_CALC_PARAMS, PRESET_MINERALS, PRESET_SHIP_MATERIALS, PRESET_BUILD_MATERIALS, MANUFACTURE_PROJECTS

export interface IMaterialItem {
  name: string;
  /** 单价（ISK/个） */
  price: number;
  /** 数量（个） */
  quantity: number;
}

export interface ICalcParams {
  /** 150%效率市价材料成本（亿ISK） */
  materialCost150: number;
  /** 蓝图市场采购价（亿ISK） */
  blueprintPrice: number;
  /** 固定制造费（亿ISK） */
  fixedManufactureFee: number;
  /** 当前制造效率（默认0.85） */
  manufactureEfficiency: number;
  /** 材料收购折扣（默认0.85） */
  materialDiscount: number;
  /** 收购单标价（亿ISK） */
  buyOrderPrice: number;
  /** 市场挂单标价（亿ISK） */
  marketSellPrice: number;
  /** 市场交易总税率（默认0.121） */
  marketTaxRate: number;
  /** 自有蓝图折扣（默认0.8） */
  ownBlueprintDiscount: number;
}

export interface PlanVariant {
  /** 变体名称（如"蓝图市场采购" / "自有折扣蓝图"） */
  variantName: string;
  /** 材料成本（不含蓝图和制造费） */
  materialCost: number;
  /** 总制造成本（材料+蓝图+制造费） */
  totalCost: number;
  /** 收购单利润 */
  buyOrderProfit: number;
  /** 市场挂单利润 */
  marketSellProfit: number;
}

export interface IPlanResult {
  /** 方案名称 */
  planName: string;
  /** 方案说明 */
  planDesc: string;
  /** 方案变体（多数方案1个，方案3有2个） */
  variants: PlanVariant[];
}

/** 制造项目材料数量明细 */
export interface IProjectMaterials {
  /** 矿物数量数组，顺序与 PRESET_MINERALS 一致 */
  minerals: number[];
  /** 船材数量数组，顺序与 PRESET_SHIP_MATERIALS 一致 */
  shipMaterials: number[];
  /** 建材数量数组，顺序与 PRESET_BUILD_MATERIALS 一致 */
  buildMaterials: number[];
}

export interface IManufactureProject {
  /** 项目 ID */
  id: string;
  /** 舰船/项目名称 */
  name: string;
  /** 分类（护卫舰级/驱逐舰级等） */
  category: string;
  /** 是否为预设项目（预设不可删除） */
  isPreset?: boolean;
  /** 150%效率市价材料成本（亿ISK） */
  materialCost150: number;
  /** 蓝图市场参考价（亿ISK） */
  blueprintPrice: number;
  /** 固定制造费参考值（亿ISK） */
  fixedManufactureFee: number;
  /** 收购单参考价（亿ISK） */
  buyOrderPrice: number;
  /** 市场挂单参考价（亿ISK） */
  marketSellPrice: number;
  /** 材料明细数量 */
  materials?: IProjectMaterials;
}

export const DEFAULT_CALC_PARAMS: ICalcParams = {
  materialCost150: 4.4,
  blueprintPrice: 1.0,
  fixedManufactureFee: 0.2,
  manufactureEfficiency: 0.85,
  materialDiscount: 0.85,
  buyOrderPrice: 5.0,
  marketSellPrice: 5.5,
  marketTaxRate: 0.121,
  ownBlueprintDiscount: 0.8,
};

// 矿物录入预设数据（名称 + 默认数量，单价留空由用户填）
export const PRESET_MINERALS: IMaterialItem[] = [
  { name: '三钛合金', price: 0, quantity: 0 },
  { name: '类晶体胶矿', price: 0, quantity: 0 },
  { name: '类银超金属', price: 0, quantity: 0 },
  { name: '同位聚合体', price: 0, quantity: 0 },
  { name: '超新星诺克石', price: 0, quantity: 0 },
  { name: '晶状石英核岩', price: 0, quantity: 0 },
  { name: '超噬矿', price: 0, quantity: 0 },
  { name: '莫尔石', price: 0, quantity: 0 },
];

// 船材录入预设数据
export const PRESET_SHIP_MATERIALS: IMaterialItem[] = [
  { name: '光泽合金', price: 0, quantity: 0 },
  { name: '光彩合金', price: 0, quantity: 0 },
  { name: '闪光合金', price: 0, quantity: 0 },
  { name: '浓缩合金', price: 0, quantity: 0 },
  { name: '精密合金', price: 0, quantity: 0 },
  { name: '杂色复合物', price: 0, quantity: 0 },
  { name: '纤维复合物', price: 0, quantity: 0 },
  { name: '透光复合物', price: 0, quantity: 0 },
  { name: '多样复合物', price: 0, quantity: 0 },
  { name: '光滑复合物', price: 0, quantity: 0 },
  { name: '晶体复合物', price: 0, quantity: 0 },
  { name: '黑暗复合物', price: 0, quantity: 0 },
  { name: '基础金属', price: 0, quantity: 0 },
  { name: '重金属', price: 0, quantity: 0 },
  { name: '贵金属', price: 0, quantity: 0 },
  { name: '反应金属', price: 0, quantity: 0 },
  { name: '有毒金属', price: 0, quantity: 0 },
];

// 建材录入预设数据
export const PRESET_BUILD_MATERIALS: IMaterialItem[] = [
  { name: '活性气体', price: 0, quantity: 0 },
  { name: '稀有气体', price: 0, quantity: 0 },
  { name: '工业纤维', price: 0, quantity: 0 },
  { name: '超张力塑料', price: 0, quantity: 0 },
  { name: '聚芳酰胺', price: 0, quantity: 0 },
  { name: '冷却剂', price: 0, quantity: 0 },
  { name: '凝缩液', price: 0, quantity: 0 },
  { name: '建筑模块', price: 0, quantity: 0 },
  { name: '纳米体', price: 0, quantity: 0 },
  { name: '硅结构铸材', price: 0, quantity: 0 },
  { name: '灵巧单元建筑模块', price: 0, quantity: 0 },
];

// 预设制造项目（10 个 EVE 常见舰船），附带材料数量明细
export const MANUFACTURE_PROJECTS: IManufactureProject[] = [
  {
    id: 'atron',
    name: '阿特龙级',
    category: '护卫舰级',
    isPreset: true,
    materialCost150: 0.12,
    blueprintPrice: 0.05,
    fixedManufactureFee: 0.01,
    buyOrderPrice: 0.25,
    marketSellPrice: 0.3,
    materials: {
      minerals: [25000, 12000, 5000, 1500, 400, 120, 30, 10],
      shipMaterials: [80, 60, 40, 25, 15, 50, 35, 20, 15, 10, 8, 5, 120, 60, 25, 15, 8],
      buildMaterials: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 'incursus',
    name: '因卡萨斯级',
    category: '护卫舰级',
    isPreset: true,
    materialCost150: 0.18,
    blueprintPrice: 0.08,
    fixedManufactureFee: 0.012,
    buyOrderPrice: 0.38,
    marketSellPrice: 0.45,
    materials: {
      minerals: [38000, 18000, 7500, 2200, 600, 180, 45, 15],
      shipMaterials: [120, 90, 60, 35, 22, 75, 50, 30, 22, 15, 12, 8, 180, 90, 35, 22, 12],
      buildMaterials: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 'catalyst',
    name: '催化级',
    category: '驱逐舰级',
    isPreset: true,
    materialCost150: 0.55,
    blueprintPrice: 0.15,
    fixedManufactureFee: 0.03,
    buyOrderPrice: 1.1,
    marketSellPrice: 1.3,
    materials: {
      minerals: [120000, 55000, 22000, 6500, 1800, 500, 130, 40],
      shipMaterials: [380, 280, 180, 110, 65, 240, 160, 95, 70, 48, 35, 22, 580, 290, 110, 70, 35],
      buildMaterials: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 'vexor',
    name: '狂怒者级',
    category: '巡洋舰级',
    isPreset: true,
    materialCost150: 2.2,
    blueprintPrice: 0.6,
    fixedManufactureFee: 0.08,
    buyOrderPrice: 4.2,
    marketSellPrice: 4.8,
    materials: {
      minerals: [480000, 220000, 90000, 26000, 7200, 2000, 520, 160],
      shipMaterials: [1500, 1100, 720, 420, 260, 950, 640, 380, 280, 190, 140, 85, 2300, 1150, 420, 280, 140],
      buildMaterials: [50, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 'thorax',
    name: '托勒克斯级',
    category: '巡洋舰级',
    isPreset: true,
    materialCost150: 2.8,
    blueprintPrice: 0.75,
    fixedManufactureFee: 0.1,
    buyOrderPrice: 5.5,
    marketSellPrice: 6.2,
    materials: {
      minerals: [620000, 280000, 115000, 33000, 9000, 2500, 650, 200],
      shipMaterials: [1900, 1400, 920, 540, 330, 1200, 800, 480, 350, 240, 180, 110, 2900, 1450, 540, 350, 180],
      buildMaterials: [80, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 'myrmidon',
    name: '弥洱米顿级',
    category: '战巡舰级',
    isPreset: true,
    materialCost150: 8.5,
    blueprintPrice: 2.0,
    fixedManufactureFee: 0.25,
    buyOrderPrice: 16.0,
    marketSellPrice: 18.5,
    materials: {
      minerals: [1900000, 850000, 350000, 100000, 28000, 7800, 2000, 600],
      shipMaterials: [5800, 4200, 2800, 1600, 1000, 3700, 2500, 1500, 1100, 750, 550, 340, 8800, 4400, 1600, 1100, 550],
      buildMaterials: [300, 120, 80, 40, 20, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 'dominix',
    name: '多米尼克斯级',
    category: '战列舰级',
    isPreset: true,
    materialCost150: 28.0,
    blueprintPrice: 5.5,
    fixedManufactureFee: 0.8,
    buyOrderPrice: 52.0,
    marketSellPrice: 58.0,
    materials: {
      minerals: [6200000, 2800000, 1150000, 330000, 90000, 25000, 6500, 2000],
      shipMaterials: [19000, 14000, 9200, 5400, 3300, 12000, 8000, 4800, 3500, 2400, 1800, 1100, 29000, 14500, 5400, 3500, 1800],
      buildMaterials: [1200, 500, 300, 150, 80, 50, 20, 0, 0, 0, 0],
    },
  },
  {
    id: 'megathron',
    name: '万王宝座级',
    category: '战列舰级',
    isPreset: true,
    materialCost150: 35.0,
    blueprintPrice: 7.0,
    fixedManufactureFee: 1.0,
    buyOrderPrice: 68.0,
    marketSellPrice: 75.0,
    materials: {
      minerals: [7800000, 3500000, 1450000, 420000, 115000, 32000, 8200, 2500],
      shipMaterials: [24000, 17500, 11500, 6800, 4100, 15200, 10200, 6100, 4400, 3000, 2200, 1400, 36500, 18200, 6800, 4400, 2200],
      buildMaterials: [1800, 700, 450, 220, 120, 80, 30, 0, 0, 0, 0],
    },
  },
  {
    id: 'iteron',
    name: '伊特龙级',
    category: '工业舰',
    isPreset: true,
    materialCost150: 1.2,
    blueprintPrice: 0.3,
    fixedManufactureFee: 0.05,
    buyOrderPrice: 2.4,
    marketSellPrice: 2.8,
    materials: {
      minerals: [260000, 120000, 50000, 14000, 4000, 1100, 280, 90],
      shipMaterials: [800, 580, 380, 220, 140, 500, 340, 200, 150, 100, 75, 48, 1200, 600, 220, 150, 75],
      buildMaterials: [200, 80, 50, 25, 12, 0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 'epithal',
    name: '埃比斯级',
    category: '运输舰',
    isPreset: true,
    materialCost150: 4.5,
    blueprintPrice: 1.2,
    fixedManufactureFee: 0.15,
    buyOrderPrice: 9.0,
    marketSellPrice: 10.5,
    materials: {
      minerals: [980000, 440000, 180000, 52000, 14000, 4000, 1050, 320],
      shipMaterials: [3000, 2200, 1450, 850, 520, 1900, 1280, 760, 560, 380, 280, 170, 4600, 2300, 850, 560, 280],
      buildMaterials: [600, 250, 150, 80, 40, 20, 10, 0, 0, 0, 0],
    },
  },
];
