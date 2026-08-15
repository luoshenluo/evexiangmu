import type { FlowerType, SeedType, Tool, GameState, Announcement, PestSeverity } from './types'
export { RankNames, RankColors } from './types'

// 花品种配置（80 种，每季 20 种）
export const FLOWER_TYPES: FlowerType[] = [
  // ========== 春季 20 种 ==========
  { id: 'daisy',        name: '雏菊',     emoji: '🌼', season: ['spring'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 20,  baseSellPrice: 12,  description: '纯真的小花，新手入门首选。' },
  { id: 'tulip',        name: '郁金香',   emoji: '🌷', season: ['spring'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 40,  baseSellPrice: 25,  description: '优雅的春之使者，花姿挺拔。' },
  { id: 'cherry',       name: '樱花',     emoji: '🌸', season: ['spring'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 60,  baseSellPrice: 38,  description: '浪漫的春日限定，花期短暂而绚烂。' },
  { id: 'lily',         name: '百合',     emoji: '⚜️', season: ['spring'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 70,  baseSellPrice: 42,  description: '洁白高雅的球根花卉，香气宜人。' },
  { id: 'peony',        name: '牡丹',     emoji: '🌺', season: ['spring'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 100, baseSellPrice: 55,  description: '花中之王，雍容华贵。' },
  { id: 'hydrangea',    name: '绣球花',   emoji: '💮', season: ['spring'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 65,  baseSellPrice: 40,  description: '团簇如球的夏日花球，色彩多变。' },
  { id: 'wisteria',     name: '紫藤花',   emoji: '🪻', season: ['spring'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 95,  baseSellPrice: 52,  description: '垂挂如瀑的紫色花帘。' },
  { id: 'orchid',       name: '兰花',     emoji: '🏵️', season: ['spring'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 110, baseSellPrice: 58,  description: '君子之花，幽香清雅。' },
  { id: 'azalea',       name: '杜鹃花',   emoji: '🌺', season: ['spring'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 35,  baseSellPrice: 22,  description: '漫山遍野的报春花海。' },
  { id: 'camellia',     name: '山茶花',   emoji: '🌸', season: ['spring'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 60,  baseSellPrice: 35,  description: '四季常青的端庄之花。' },
  { id: 'narcissus',    name: '水仙',     emoji: '🌼', season: ['spring'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 30,  baseSellPrice: 18,  description: '凌波仙子，清香淡雅。' },
  { id: 'hyacinth',     name: '风信子',   emoji: '🫐', season: ['spring'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 45,  baseSellPrice: 28,  description: '色彩缤纷的球根花穗。' },
  { id: 'forsythia',    name: '迎春花',   emoji: '🌼', season: ['spring'],            maxRank: 5, growthTime: 3 * 60 * 1000,  baseBuyPrice: 32,  baseSellPrice: 20,  description: '最先迎接春天的金黄小花。' },
  { id: 'plum_blossom', name: '梅花(春)', emoji: '🌸', season: ['spring'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 105, baseSellPrice: 60,  description: '凌寒傲雪的君子之花。' },
  { id: 'freesia',      name: '小苍兰',   emoji: '🌷', season: ['spring'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 60,  baseSellPrice: 36,  description: '芬芳馥郁的春之花。' },
  { id: 'anemone',      name: '银莲花',   emoji: '🌺', season: ['spring'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 42,  baseSellPrice: 26,  description: '花瓣如绸的早春花。' },
  { id: 'bluebell',     name: '蓝铃花',   emoji: '🔔', season: ['spring'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 26,  baseSellPrice: 16,  description: '串串蓝铃摇曳于林间。' },
  { id: 'primrose',     name: '报春花',   emoji: '🌸', season: ['spring'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 24,  baseSellPrice: 14,  description: '最早的春信之一。' },
  { id: 'buttercup',    name: '金凤花',   emoji: '🌼', season: ['spring'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 40,  baseSellPrice: 24,  description: '亮黄如金的春日小花。' },
  { id: 'blacktulip',   name: '黑郁金香', emoji: '🌷', season: ['spring'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 150, baseSellPrice: 80,  description: '神秘的近黑郁金香，稀世珍品。' },
  // ========== 夏季 20 种 ==========
  { id: 'sunflower',    name: '向日葵',   emoji: '🌻', season: ['summer'],            maxRank: 5, growthTime: 6 * 60 * 1000,  baseBuyPrice: 35,  baseSellPrice: 20,  description: '追逐阳光的夏日之花。' },
  { id: 'lotus',        name: '荷花',     emoji: '🪷', season: ['summer'],            maxRank: 6, growthTime: 7 * 60 * 1000,  baseBuyPrice: 70,  baseSellPrice: 45,  description: '出淤泥而不染，濯清涟而不妖。' },
  { id: 'rose',         name: '玫瑰',     emoji: '🌹', season: ['summer'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 50,  baseSellPrice: 30,  description: '爱情的象征，娇艳多刺。' },
  { id: 'marigold',     name: '万寿菊',   emoji: '🏵️', season: ['summer'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 26,  baseSellPrice: 15,  description: '金黄灿烂的节庆之花。' },
  { id: 'zinnia',       name: '百日菊',   emoji: '🌼', season: ['summer'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 45,  baseSellPrice: 28,  description: '花期超长的百日芳华。' },
  { id: 'hibiscus',     name: '木槿',     emoji: '🌺', season: ['summer'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 62,  baseSellPrice: 38,  description: '朝开暮落，日日新花。' },
  { id: 'peacock',      name: '蓝孔雀花', emoji: '🦚', season: ['summer'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 95,  baseSellPrice: 50,  description: '如孔雀开屏般的蓝色奇花。' },
  { id: 'morningglory', name: '牵牛花',   emoji: '🌸', season: ['summer'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 30,  baseSellPrice: 18,  description: '清晨绽放的朝颜。' },
  { id: 'lantana',      name: '马缨丹',   emoji: '🌺', season: ['summer'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 40,  baseSellPrice: 24,  description: '七彩变色的圆球花簇。' },
  { id: 'bougainvillea', name: '三角梅',  emoji: '🌺', season: ['summer'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 100, baseSellPrice: 55,  description: '热烈奔放的紫红花瀑。' },
  { id: 'waterlily',    name: '睡莲',     emoji: '🪷', season: ['summer'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 68,  baseSellPrice: 42,  description: '静静漂浮水面的优雅睡莲。' },
  { id: 'goldenspray',  name: '金雀花',   emoji: '🌻', season: ['summer'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 48,  baseSellPrice: 30,  description: '金黄如雀的夏之花。' },
  { id: 'cactusflower', name: '仙人掌花', emoji: '🌵', season: ['summer'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 60,  baseSellPrice: 35,  description: '荒漠中的惊艳绽放。' },
  { id: 'delphinium',   name: '飞燕草',   emoji: '💠', season: ['summer'],            maxRank: 7, growthTime: 7 * 60 * 1000,  baseBuyPrice: 85,  baseSellPrice: 48,  description: '如飞燕振翅的蓝色花塔。' },
  { id: 'canna',        name: '美人蕉',   emoji: '🌺', season: ['summer'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 34,  baseSellPrice: 20,  description: '热情似火的盛夏花卉。' },
  { id: 'dahlia',       name: '大丽花',   emoji: '🌸', season: ['summer'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 66,  baseSellPrice: 40,  description: '华美繁复的万花之冠。' },
  { id: 'phlox',        name: '福禄考',   emoji: '🌸', season: ['summer'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 42,  baseSellPrice: 26,  description: '斑斓的铺地花毯。' },
  { id: 'begonia',      name: '秋海棠',   emoji: '🌺', season: ['summer'],            maxRank: 4, growthTime: 4 * 60 * 1000,  baseBuyPrice: 38,  baseSellPrice: 22,  description: '娇俏的粉红花盏。' },
  { id: 'jasmine',      name: '茉莉',     emoji: '🌼', season: ['summer'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 52,  baseSellPrice: 32,  description: '清香四溢的月下仙子。' },
  { id: 'bluelotus',    name: '蓝睡莲',   emoji: '🪷', season: ['summer'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 160, baseSellPrice: 85,  description: '稀有的蓝色水中精灵。' },
  // ========== 秋季 20 种 ==========
  { id: 'chrysanthemum', name: '菊花',    emoji: '🏵️', season: ['autumn'],            maxRank: 5, growthTime: 5 * 60 * 1000,  baseBuyPrice: 45,  baseSellPrice: 28,  description: '秋日之王，凌霜绽放。' },
  { id: 'osmanthus',    name: '桂花',     emoji: '🌼', season: ['autumn'],            maxRank: 7, growthTime: 7 * 60 * 1000,  baseBuyPrice: 90,  baseSellPrice: 50,  description: '金秋飘香的满园桂子。' },
  { id: 'cosmos',       name: '大波斯菊', emoji: '🌸', season: ['autumn'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 62,  baseSellPrice: 38,  description: '秋日原野的粉色花海。' },
  { id: 'dahlia_aut',   name: '秋大丽花', emoji: '🌺', season: ['autumn'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 100, baseSellPrice: 55,  description: '华贵绚烂的秋日牡丹。' },
  { id: 'aster',        name: '紫菀',     emoji: '🌼', season: ['autumn'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 42,  baseSellPrice: 26,  description: '秋日路边的紫色星花。' },
  { id: 'pansy',        name: '三色堇',   emoji: '🌸', season: ['autumn'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 40,  baseSellPrice: 24,  description: '如笑脸般的多彩花面。' },
  { id: 'okra',         name: '秋葵花',   emoji: '🌻', season: ['autumn'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 28,  baseSellPrice: 16,  description: '清雅的淡黄秋葵花。' },
  { id: 'lycoris',      name: '彼岸花',   emoji: '🌺', season: ['autumn'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 75,  baseSellPrice: 45,  description: '妖冶神秘的红花石蒜。' },
  { id: 'calendula',    name: '金盏菊',   emoji: '🏵️', season: ['autumn'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 30,  baseSellPrice: 18,  description: '秋日暖阳般的金黄菊。' },
  { id: 'cyclamen',     name: '仙客来',   emoji: '🌸', season: ['autumn'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 58,  baseSellPrice: 36,  description: '翩翩如蝶的秋日花。' },
  { id: 'celosia',      name: '鸡冠花',   emoji: '🌺', season: ['autumn'],            maxRank: 4, growthTime: 4 * 60 * 1000,  baseBuyPrice: 34,  baseSellPrice: 20,  description: '如鸡冠般火红的秋花。' },
  { id: 'verbena',      name: '美女樱',   emoji: '🌼', season: ['autumn'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 46,  baseSellPrice: 28,  description: '圆球状的缤纷花簇。' },
  { id: 'chrysanthemum_gold', name: '黄金菊', emoji: '🏵️', season: ['autumn'],      maxRank: 7, growthTime: 7 * 60 * 1000,  baseBuyPrice: 88,  baseSellPrice: 48,  description: '金灿灿的贵气秋菊。' },
  { id: 'tithonia',     name: '墨西哥向日葵', emoji: '🌻', season: ['autumn'],       maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 66,  baseSellPrice: 40,  description: '橘红如火的秋日骄阳。' },
  { id: 'nerine',       name: '石蒜',     emoji: '🌺', season: ['autumn'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 70,  baseSellPrice: 42,  description: '秋雨后的粉红精灵。' },
  { id: 'dwarfzinnia',  name: '小百日菊', emoji: '🌼', season: ['autumn'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 24,  baseSellPrice: 14,  description: '迷你可爱的迷你菊。' },
  { id: 'helianthus',   name: '秋菊',     emoji: '🌼', season: ['autumn'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 58,  baseSellPrice: 35,  description: '深秋盛放的多头菊。' },
  { id: 'safflower',    name: '红花',     emoji: '🌺', season: ['autumn'],            maxRank: 5, growthTime: 5 * 60 * 1000,  baseBuyPrice: 52,  baseSellPrice: 32,  description: '药食两用的艳红菊科花。' },
  { id: 'redlycoris',   name: '红彼岸花', emoji: '🌺', season: ['autumn'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 170, baseSellPrice: 90,  description: '深红如血的秋日奇花。' },
  { id: 'marigold_gold', name: '万寿金菊', emoji: '🏵️', season: ['autumn'],          maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 64,  baseSellPrice: 39,  description: '金光夺目的丰收菊。' },
  // ========== 冬季 20 种 ==========
  { id: 'plum',         name: '梅花',     emoji: '🌸', season: ['winter'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 100, baseSellPrice: 60,  description: '寒冬独开的传奇之花。' },
  { id: 'snowdrop',     name: '雪滴花',   emoji: '❄️', season: ['winter'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 68,  baseSellPrice: 40,  description: '冰雪中垂首的纯白小花。' },
  { id: 'camellia_w',   name: '冬山茶',   emoji: '🌺', season: ['winter'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 62,  baseSellPrice: 38,  description: '寒冬依然娇艳的花。' },
  { id: 'poinsettia',   name: '一品红',   emoji: '🌺', season: ['winter'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 75,  baseSellPrice: 45,  description: '圣诞的节日红火。' },
  { id: 'paperwhite',   name: '水仙(冬)', emoji: '🌼', season: ['winter'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 44,  baseSellPrice: 26,  description: '冬日案头的清雅水仙。' },
  { id: 'cyclamen_w',   name: '冬仙客来', emoji: '🌸', season: ['winter'],            maxRank: 4, growthTime: 4 * 60 * 1000,  baseBuyPrice: 32,  baseSellPrice: 18,  description: '寒冬室内的翩翩蝶花。' },
  { id: 'hellebore',    name: '铁筷子花', emoji: '🌸', season: ['winter'],            maxRank: 6, growthTime: 6 * 60 * 1000,  baseBuyPrice: 70,  baseSellPrice: 42,  description: '风雪中的圣诞玫瑰。' },
  { id: 'winterjasmin', name: '冬迎春',   emoji: '🌼', season: ['winter'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 28,  baseSellPrice: 16,  description: '寒冬中最早的黄花。' },
  { id: 'cymbidium',    name: '墨兰',     emoji: '🏵️', season: ['winter'],            maxRank: 7, growthTime: 7 * 60 * 1000,  baseBuyPrice: 100, baseSellPrice: 55,  description: '墨香幽幽的冬兰。' },
  { id: 'sasanqua',     name: '茶梅',     emoji: '🌸', season: ['winter'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 58,  baseSellPrice: 36,  description: '冬末春初的柔美花。' },
  { id: 'whitenarcissus', name: '白水仙', emoji: '🌼', season: ['winter'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 46,  baseSellPrice: 28,  description: '清透如雪的白水仙。' },
  { id: 'winterdawn',   name: '冬菊',     emoji: '🌻', season: ['winter'],            maxRank: 5, growthTime: 4 * 60 * 1000,  baseBuyPrice: 40,  baseSellPrice: 24,  description: '傲霜绽放的冬日菊。' },
  { id: 'dogwood',      name: '山茱萸花', emoji: '🌺', season: ['winter'],            maxRank: 7, growthTime: 7 * 60 * 1000,  baseBuyPrice: 92,  baseSellPrice: 50,  description: '如星如雪的冬季花。' },
  { id: 'witchhazel',   name: '金缕梅',   emoji: '🌼', season: ['winter'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 56,  baseSellPrice: 34,  description: '冬日金丝般的细花。' },
  { id: 'crocus',       name: '番红花',   emoji: '🌸', season: ['winter'],            maxRank: 4, growthTime: 3 * 60 * 1000,  baseBuyPrice: 26,  baseSellPrice: 15,  description: '雪中探头的早春花。' },
  { id: 'winterberry',  name: '冬青',     emoji: '🫐', season: ['winter'],            maxRank: 6, growthTime: 5 * 60 * 1000,  baseBuyPrice: 50,  baseSellPrice: 30,  description: '红果冬青的节日装饰。' },
  { id: 'snowberry',    name: '雪果花',   emoji: '🌼', season: ['winter'],            maxRank: 4, growthTime: 4 * 60 * 1000,  baseBuyPrice: 34,  baseSellPrice: 20,  description: '白果累累的冬季灌木花。' },
  { id: 'winterrose',   name: '冬玫瑰',   emoji: '🌹', season: ['winter'],            maxRank: 7, growthTime: 8 * 60 * 1000,  baseBuyPrice: 135, baseSellPrice: 70,  description: '冰雪玫瑰，稀有珍贵。' },
  { id: 'iceorchid',    name: '冰兰花',   emoji: '🏵️', season: ['winter'],            maxRank: 7, growthTime: 9 * 60 * 1000,  baseBuyPrice: 220, baseSellPrice: 120, description: '传说级的冰晶兰花。' },
  { id: 'plumking',     name: '帝王梅',   emoji: '🌸', season: ['winter'],            maxRank: 7, growthTime: 9 * 60 * 1000,  baseBuyPrice: 280, baseSellPrice: 150, description: '万梅之王的传说之花。' },
]

// 种子配置
// 官方售卖的基础种子（玩家可购买起步）
const OFFICIAL_BASIC_SEEDS = new Set(['daisy', 'sunflower', 'tulip'])

// maxRank → 种子阶级（决定杂交升级路径）
function flowerTier(maxRank: number): SeedType['tier'] {
  if (maxRank <= 4) return 'black_iron'
  if (maxRank === 5) return 'bronze'
  if (maxRank === 6) return 'silver'
  return 'gold'
}

export const SEED_TYPES: SeedType[] = FLOWER_TYPES.map(flower => ({
  id: `seed_${flower.id}`,
  flowerTypeId: flower.id,
  name: `${flower.name}种子`,
  emoji: '🌱',
  price: OFFICIAL_BASIC_SEEDS.has(flower.id) ? Math.floor(flower.baseBuyPrice * 0.3) : 0,
  description: `可种植出${flower.name}的种子。`,
  season: flower.season,
  tier: flowerTier(flower.maxRank),
  officialSell: OFFICIAL_BASIC_SEEDS.has(flower.id),
}))

// 工具配置（种植处固定价）
export const TOOLS: Tool[] = [
  {
    id: 'watering_can',
    name: '水壶',
    emoji: '💧',
    price: 10,
    description: '给花浇水，促进生长。',
    effect: 'water',
    power: 5,
  },
  {
    id: 'fertilizer',
    name: '化肥',
    emoji: '🧪',
    price: 15,
    description: '为花施肥，大幅加速生长。',
    effect: 'fertilize',
    power: 15,
  },
  {
    id: 'pesticide',
    name: '除虫剂',
    emoji: '🧴',
    price: 20,
    description: '消灭害虫，保护花朵。',
    effect: 'pesticide',
    power: 1,
  },
  {
    id: 'speedup_card',
    name: '加速卡',
    emoji: '⚡',
    price: 50,
    description: '立即加速花朵成长进度。',
    effect: 'speedup',
    power: 30,
  },
]

// 初始游戏状态 - 每8小时切换一个季度（现实 1 天 = 游戏内 4 季循环）
export const SEASON_CYCLE_MS = 8 * 60 * 60 * 1000 // 8小时
export const SEASON_ORDER: ('spring' | 'summer' | 'autumn' | 'winter')[] = ['spring', 'summer', 'autumn', 'winter']

export const INITIAL_GAME_STATE: GameState = {
  currentSeason: getCurrentSeason(),
  seasonStartAt: getSeasonStartAt(),
  seasonDuration: SEASON_CYCLE_MS,
}

// 获取游戏内当前季节（现实8小时 = 游戏内 1 季，1天循环春夏秋冬）
export function getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
  const now = Date.now()
  const cycleIdx = Math.floor(now / SEASON_CYCLE_MS) % SEASON_ORDER.length
  return SEASON_ORDER[cycleIdx]
}

// 兼容旧接口：别名，避免改大量调用点
export const getSeasonByMonth = getCurrentSeason

// 当前季度的起点时间戳
export function getSeasonStartAt(): number {
  const now = Date.now()
  return Math.floor(now / SEASON_CYCLE_MS) * SEASON_CYCLE_MS
}

// 距离下一个季度的剩余毫秒数
export function getSeasonRemainingMs(): number {
  const now = Date.now()
  return SEASON_CYCLE_MS - (now % SEASON_CYCLE_MS)
}

// 初始公告
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'announce_1',
    title: '🎉 欢迎来到花园！',
    content: '欢迎来到花园模拟经营游戏！在这里你可以种花、交易、交友。完成签到和任务获取金币与花瓣奖励，解锁称号和外观，快去你的花园看看吧！',
    createdAt: Date.now(),
    priority: 'urgent',
  },
  {
    id: 'announce_2',
    title: '📖 游戏玩法介绍',
    content: '1. 在花园中种植花朵，浇水、施肥、除虫、使用加速卡加速成长，注意虫灾哦。\n2. 收获的花朵可卖给系统，或在市场自由定价挂售/收购（支持花朵、种子、工具）。\n3. 解锁更多地块和背包格，使用工坊制作花束与培育珍稀品种。\n4. 完成每日/每周/每月任务和每日签到，获取金币与花瓣奖励。\n5. 加入家族：贡献金币、完成家族集体任务、升级家族、解锁更多成员名额。\n6. 小游戏：消耗花瓣玩幸运转盘和猜大小，赢取丰厚金币。\n7. 成就系统：连续签到、收获花朵、消费金币，解锁专属称号。\n8. 外观设置：切换界面主题与花园背景皮肤，打造专属花园。',
    createdAt: Date.now() - 3600000,
    priority: 'important',
  },
]

// 季节名称映射
export const SEASON_NAMES: Record<string, string> = {
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季',
}

// ===== 家族系统：等级/成员上限（前后端共享，避免不一致） =====
export const FAMILY_LEVEL_EXP = [0, 100, 300, 700, 1500, 3000, 6000, 12000, 24000, 50000]
export const FAMILY_MAX_LEVEL = 10
/** 传入当前家族总exp，返回1-10级 */
export function calcFamilyLevel(exp: number): number {
  let lv = 1
  for (let i = 1; i < FAMILY_LEVEL_EXP.length; i++) {
    if (exp >= FAMILY_LEVEL_EXP[i]) lv = i + 1
  }
  return Math.min(lv, FAMILY_MAX_LEVEL)
}
/** Lv1=10人，每升级+10人；Lv10=100人（"最多百人"宣传文案对应） */
export function calcFamilyMaxMembers(level: number): number {
  return 10 + (Math.min(FAMILY_MAX_LEVEL, Math.max(1, level)) - 1) * 10
}

// 季节颜色
export const SEASON_COLORS: Record<string, string> = {
  spring: 'from-green-400 to-pink-300',
  summer: 'from-yellow-400 to-orange-400',
  autumn: 'from-orange-500 to-amber-700',
  winter: 'from-blue-300 to-slate-400',
}

// 计算地块解锁价格
export function getPlotUnlockPrice(plotNumber: number): number {
  return plotNumber * 30
}

// 计算背包扩容价格
export function getInventoryExpandPrice(currentSize: number): number {
  const expansions = (currentSize - 5) / 5
  return Math.floor(100 * Math.pow(1.5, expansions))
}

// 计算花的售价（按等级倍率）
export function getFlowerSellPrice(flower: FlowerType, rank: number): number {
  const rankMultipliers = [1, 1.5, 2.2, 3.2, 5, 8, 15]
  return Math.floor(flower.baseSellPrice * rankMultipliers[rank - 1])
}

// 工具价格调控兼容别名
export const TOOL_TYPES = TOOLS

// 幸运转盘奖励配置（花瓣代币玩法）
// 奖励类型：coins（金币）| seed（种子）| flower（花朵）
// 成本 10 花瓣/抽（花瓣回收机制）；期望值约 16 金币/抽；大奖 500 概率 0.01%
export const WHEEL_REWARDS: {
  key: string
  label: string
  weight: number
  coins: number
  petals?: number
  /** seed/flower 类型的奖励数据 */
  itemType?: 'seed' | 'flower'
  referenceId?: string
  quantity?: number
}[] = [
  { key: 'coins_10',    label: '20 金币',    weight: 2000, coins: 20 },
  { key: 'coins_20',    label: '40 金币',    weight: 1200, coins: 40 },
  { key: 'seed_daisy',  label: '雏菊种子',    weight: 1000, coins: 0, itemType: 'seed', referenceId: 'seed_daisy', quantity: 2 },
  { key: 'flower_common', label: '随机花朵',  weight: 800, coins: 0, itemType: 'flower', referenceId: 'random', quantity: 2 },
  { key: 'seed_rose',   label: '玫瑰种子',    weight: 600, coins: 0, itemType: 'seed', referenceId: 'seed_rose', quantity: 2 },
  { key: 'coins_50',    label: '100 金币',   weight: 300, coins: 100 },
  { key: 'coins_100',   label: '200 金币',   weight: 120, coins: 200 },
  { key: 'seed_plum',   label: '梅花种子',    weight: 150, coins: 0, itemType: 'seed', referenceId: 'seed_plum', quantity: 2 },
  { key: 'flower_rare', label: '稀有花朵',    weight: 80, coins: 0, itemType: 'flower', referenceId: 'random', quantity: 2, petals: 0 },
  { key: 'coins_200',   label: '300 金币',   weight: 30, coins: 300 },
  { key: 'jackpot',     label: '🎉 500💰',   weight: 1, coins: 500 },
  { key: 'nothing',     label: '谢谢参与',    weight: 3719, coins: 0 },
]

export function pickWheelIndex(): number {
  const total = WHEEL_REWARDS.reduce((s, r) => s + r.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < WHEEL_REWARDS.length; i++) {
    r -= WHEEL_REWARDS[i].weight
    if (r <= 0) return i
  }
  return 0
}

// 敏感词过滤
// 默认内置敏感词（DB 中无配置时的兜底）
const DEFAULT_SENSITIVE_WORDS = [
  '操', '草', '傻逼', 'sb', 'SB', '去死', '狗日', '他妈', 'tmd', 'TMD',
  '垃圾游戏', '骗钱', '外挂', 'waigua', 'hack',
]

// 过滤敏感词（可传入后台动态词库；不传则只用默认内置词）
export function filterSensitiveWords(text: string, extraWords?: string[]): string {
  let result = text
  const words = extraWords && extraWords.length > 0 ? extraWords : DEFAULT_SENSITIVE_WORDS
  for (const word of words) {
    if (!word) continue
    try {
      // 转义正则特殊字符
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'gi')
      result = result.replace(regex, '*'.repeat(word.length))
    } catch {
      // 单个词正则失败不影响其他词
      result = result.split(word).join('*'.repeat(word.length))
    }
  }
  return result
}

export function containsSensitiveWords(text: string, extraWords?: string[]): boolean {
  const words = extraWords && extraWords.length > 0 ? extraWords : DEFAULT_SENSITIVE_WORDS
  const lower = text.toLowerCase()
  for (const word of words) {
    if (word && lower.includes(word.toLowerCase())) {
      return true
    }
  }
  return false
}

// ==================== 虫灾系统配置 ====================

export const PEST_CONFIG = {
  // 每次打理操作后触发单株虫害的概率
  singlePestChance: 0.08,
  // 花园加载时触发虫灾事件的基础概率（每天每用户一次检查）
  disasterBaseChance: 0.15,
  // 虫灾严重程度配置
  severity: {
    minor: { plotsAffected: [1, 2], growthPenalty: 0.3 },        // 轻微：1-2块地，生长速度30%
    major: { plotsAffected: [2, 4], growthPenalty: 0.2 },         // 严重：2-4块地，生长速度20%
    catastrophic: { plotsAffected: [3, 6], growthPenalty: 0.1 },  // 灾难：3-6块地，生长速度10%
  } as Record<PestSeverity, { plotsAffected: [number, number]; growthPenalty: number }>,
  // 虫灾未处理时花死亡的时间（毫秒），6小时
  pestDeathTimeout: 6 * 60 * 60 * 1000,
}

// 随机选择虫灾严重程度
export function rollPestSeverity(): PestSeverity {
  const roll = Math.random()
  if (roll < 0.55) return 'minor'
  if (roll < 0.85) return 'major'
  return 'catastrophic'
}

// ==================== 偷花系统配置 ====================

export const STEAL_CONFIG = {
  // 每日偷花次数上限
  dailyStealLimit: 3,
  // 偷花成功率
  strangerSuccessRate: 0.20,  // 陌生人 20%
  friendSuccessRate: 0.30,    // 好友 30%
  // 好友保护期（添加好友后多少小时内不能偷），毫秒
  friendProtectionPeriod: 12 * 60 * 60 * 1000,
  // 同一地块每天只能被偷一次
  plotStealCooldown: 24 * 60 * 60 * 1000,
  // 只有成熟的花才能被偷
  requireReady: true,
  // 花园保护道具持续时间，毫秒
  gardenProtectionDuration: 24 * 60 * 60 * 1000,
  // 被偷后给受害者的补偿金币比例（基于花的售价）
  victimCompensationRate: 0.3,
}

// 花园保护道具
export const GARDEN_GUARD_TOOL: Tool = {
  id: 'garden_guard',
  name: '花园守卫',
  emoji: '🛡️',
  price: 50,
  description: '激活后24小时内防止花朵被偷。',
  effect: 'speedup', // 复用 effect 字段
  power: 0,
}

