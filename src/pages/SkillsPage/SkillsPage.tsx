import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ChevronRight, Minus, Maximize2, Save, Check } from 'lucide-react';

/* ============================
   技能数据定义
   ============================ */

interface SkillItem {
  name: string;
  engName: string;
}

interface SkillGroup {
  name: string;
  skills: SkillItem[];
}

const SKILL_GROUPS: SkillGroup[] = [
  {
    name: '舰船制造',
    skills: [
      { name: '护卫舰制造', engName: 'Frigate Manufacture' },
      { name: '进阶护卫舰制造', engName: 'Advanced Frigate Manufacture' },
      { name: '专家护卫舰制造', engName: 'Expert Frigate Manufacture' },
      { name: '驱逐舰制造', engName: 'Destroyer Manufacture' },
      { name: '进阶驱逐舰制造', engName: 'Advanced Destroyer Manufacture' },
      { name: '专家驱逐舰制造', engName: 'Expert Destroyer Manufacture' },
      { name: '巡洋舰制造', engName: 'Cruiser Manufacture' },
      { name: '进阶巡洋舰制造', engName: 'Advanced Cruiser Manufacture' },
      { name: '专家巡洋舰制造', engName: 'Expert Cruiser Manufacture' },
      { name: '战列巡洋舰制造', engName: 'Battlecruiser Manufacture' },
      { name: '进阶战列巡洋舰制造', engName: 'Advanced Battlecruiser Manufacture' },
      { name: '专家战列巡洋舰制造', engName: 'Expert Battlecruiser Manufacture' },
      { name: '战列舰制造', engName: 'Battleship Manufacture' },
      { name: '进阶战列舰制造', engName: 'Advanced Battleship Manufacture' },
      { name: '专家战列舰制造', engName: 'Expert Battleship Manufacture' },
      { name: '工业舰制造', engName: 'Industrial Ship Manufacture' },
      { name: '进阶工业舰制造', engName: 'Advanced Industrial Ship Manufacture' },
      { name: '专家工业舰制造', engName: 'Expert Industrial Ship Manufacture' },
      { name: '航母制造', engName: 'Carrier Manufacture' },
      { name: '进阶航母制造', engName: 'Advanced Carrier Manufacture' },
      { name: '专家航母制造', engName: 'Expert Carrier Manufacture' },
      { name: '无畏舰制造', engName: 'Dreadnought Manufacture' },
      { name: '进阶无畏舰制造', engName: 'Advanced Dreadnought Manufacture' },
      { name: '专家无畏舰制造', engName: 'Expert Dreadnought Manufacture' },
      { name: '货舰制造', engName: 'Freighter Manufacture' },
      { name: '进阶货舰制造', engName: 'Advanced Freighter Manufacture' },
      { name: '专家货舰制造', engName: 'Expert Freighter Manufacture' },
      { name: '跳跃货舰制造', engName: 'Jump Freighter Manufacture' },
      { name: '进阶跳跃货舰制造', engName: 'Advanced Jump Freighter Manufacture' },
      { name: '专家跳跃货舰制造', engName: 'Expert Jump Freighter Manufacture' },
      { name: '旗舰制造', engName: 'Capital Ship Manufacture' },
      { name: '进阶旗舰制造', engName: 'Advanced Capital Ship Manufacture' },
      { name: '专家旗舰制造', engName: 'Expert Capital Ship Manufacture' },
      { name: '旗舰工业舰制造', engName: 'Capital Industrial Ship Manufacture' },
      { name: '进阶旗舰工业舰制造', engName: 'Advanced Capital Industrial Ship Manufacture' },
      { name: '专家旗舰工业舰制造', engName: 'Expert Capital Industrial Ship Manufacture' },
    ],
  },
  {
    name: '装备与模块',
    skills: [
      { name: '模块制造', engName: 'Module Manufacture' },
      { name: '进阶模块制造', engName: 'Advanced Module Manufacture' },
      { name: '专家模块制造', engName: 'Expert Module Manufacture' },
      { name: '弹药制造', engName: 'Ammunition Manufacture' },
      { name: '进阶弹药制造', engName: 'Advanced Ammunition Manufacture' },
      { name: '专家弹药制造', engName: 'Expert Ammunition Manufacture' },
      { name: '芯片制造', engName: 'Chip Manufacture' },
      { name: '进阶芯片制造', engName: 'Advanced Chip Manufacture' },
      { name: '专家芯片制造', engName: 'Expert Chip Manufacture' },
      { name: '植入体制造', engName: 'Implant Manufacture' },
      { name: '进阶植入体制造', engName: 'Advanced Implant Manufacture' },
      { name: '专家植入体制造', engName: 'Expert Implant Manufacture' },
      { name: '旗舰模块制造', engName: 'Capital Module Manufacture' },
      { name: '进阶旗舰模块制造', engName: 'Advanced Capital Module Manufacture' },
      { name: '专家旗舰模块制造', engName: 'Expert Capital Module Manufacture' },
    ],
  },
  {
    name: '改装件与建筑',
    skills: [
      { name: '改装件制造', engName: 'Rig Manufacture' },
      { name: '进阶改装件制造', engName: 'Advanced Rig Manufacture' },
      { name: '专家改装件制造', engName: 'Expert Rig Manufacture' },
      { name: '建筑建造', engName: 'Structure Construction' },
      { name: '进阶建筑建造', engName: 'Advanced Structure Construction' },
      { name: '专家建筑建造', engName: 'Expert Structure Construction' },
      { name: '聚合物材料制造', engName: 'Polymer Material Manufacture' },
      { name: '进阶聚合物材料制造', engName: 'Advanced Polymer Material Manufacture' },
      { name: '专家聚合物材料制造', engName: 'Expert Polymer Material Manufacture' },
      { name: '旗舰组件制造', engName: 'Capital Ship Component Manufacture' },
      { name: '进阶旗舰组件制造', engName: 'Advanced Capital Ship Component Manufacture' },
      { name: '专家旗舰组件制造', engName: 'Expert Capital Ship Component Manufacture' },
      { name: '旗舰改装件制造', engName: 'Capital Rig Manufacture' },
      { name: '进阶旗舰改装件制造', engName: 'Advanced Capital Rig Manufacture' },
      { name: '专家旗舰改装件制造', engName: 'Expert Capital Rig Manufacture' },
    ],
  },
];

/* localStorage 存储键 */
const STORAGE_KEY = 'eve_echoes_skills_v1';

/* ============================
   Props 定义
   ============================ */

interface SkillsPageProps {
  onBack?: () => void;
}

/* ============================
   工具函数
   ============================ */

/** 从 localStorage 加载技能等级 */
function loadSkills(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
    /* 忽略解析错误 */
  }
  return {};
}

/** 保存技能等级到 localStorage 并触发跨Tab同步 */
function saveSkills(data: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  } catch {
    /* 忽略存储错误 */
  }
}

/* ============================
   技能等级按钮组件
   ============================ */

interface LevelButtonGroupProps {
  currentLevel: number;
  onChange: (engName: string, level: number) => void;
  engName: string;
}

/** 0-5 级技能等级按钮组 */
function LevelButtonGroup({ currentLevel, onChange, engName }: LevelButtonGroupProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 6 }, (_, i) => {
        const level = i;
        const isActive = currentLevel === level;
        return (
          <button
            key={level}
            onClick={() => onChange(engName, level)}
            className={`
              w-8 h-8 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95
              ${isActive
                ? 'bg-[#7C3AED] text-white shadow-lg shadow-purple-500/30'
                : 'bg-[#2C2C2C] text-[#888888] hover:bg-[#3A3A3A] hover:text-white'
              }
            `}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}

/* ============================
   Min/Max 快捷按钮组件
   ============================ */

interface QuickButtonsProps {
  engName: string;
  onSetMin: (engName: string) => void;
  onSetMax: (engName: string) => void;
}

function QuickButtons({ engName, onSetMin, onSetMax }: QuickButtonsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onSetMin(engName)}
        title="设为最低等级"
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2C2C2C] text-[#888888] hover:bg-[#3A3A3A] hover:text-white text-[11px] font-medium transition-all duration-200 active:scale-95"
      >
        <Minus className="h-3 w-3" />
        Min
      </button>
      <button
        onClick={() => onSetMax(engName)}
        title="设为最高等级"
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2C2C2C] text-[#888888] hover:bg-[#3A3A3A] hover:text-white text-[11px] font-medium transition-all duration-200 active:scale-95"
      >
        <Maximize2 className="h-3 w-3" />
        Max
      </button>
    </div>
  );
}

/* ============================
   技能行组件
   ============================ */

interface SkillRowProps {
  skill: SkillItem;
  level: number;
  onLevelChange: (engName: string, level: number) => void;
  onSetMin: (engName: string) => void;
  onSetMax: (engName: string) => void;
}

function SkillRow({ skill, level, onLevelChange, onSetMin, onSetMax }: SkillRowProps) {
  return (
    <div className="py-2.5 px-3 sm:px-4 rounded-xl bg-[#1E1E1E]/80 border border-[#2C2C2C] hover:border-[#3A3A3A] transition-colors duration-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{skill.name}</div>
          <div className="text-[10px] text-[#666666] truncate mt-0.5 hidden sm:block">{skill.engName}</div>
        </div>
        <LevelButtonGroup currentLevel={level} onChange={onLevelChange} engName={skill.engName} />
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 sm:hidden">
        <QuickButtons engName={skill.engName} onSetMin={onSetMin} onSetMax={onSetMax} />
        <span className="text-[10px] text-[#666666]">{skill.engName}</span>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 mt-1.5">
        <QuickButtons engName={skill.engName} onSetMin={onSetMin} onSetMax={onSetMax} />
      </div>
    </div>
  );
}

/* ============================
   主页面组件
   ============================ */

export default function SkillsPage({ onBack }: SkillsPageProps) {
  const [activeGroup, setActiveGroup] = useState(0);
  const [skills, setSkills] = useState<Record<string, number>>(() => loadSkills());
  const [savedSkills, setSavedSkills] = useState<Record<string, number>>(() => loadSkills());
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasChanges = JSON.stringify(skills) !== JSON.stringify(savedSkills);

  /** 手动保存 */
  const handleSave = useCallback(() => {
    saveSkills(skills);
    setSavedSkills({ ...skills });
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    setShowSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
  }, [skills]);

  /** 修改单个技能等级 */
  const handleLevelChange = useCallback((engName: string, level: number) => {
    setSkills((prev) => {
      // 等级为 0 时删除记录以节省存储
      if (level === 0) {
        const next = { ...prev };
        delete next[engName];
        return next;
      }
      return { ...prev, [engName]: level };
    });
  }, []);

  /** 快捷设为最低等级 */
  const handleSetMin = useCallback((engName: string) => {
    handleLevelChange(engName, 0);
  }, [handleLevelChange]);

  /** 快捷设为最高等级 */
  const handleSetMax = useCallback((engName: string) => {
    handleLevelChange(engName, 5);
  }, [handleLevelChange]);

  /** 统计已配置技能数（等级 > 0） */
  const configuredCount = Object.values(skills).filter((v) => v > 0).length;
  /** 总技能数 */
  const totalSkills = SKILL_GROUPS.reduce((sum, g) => sum + g.skills.length, 0);

  const currentGroup = SKILL_GROUPS[activeGroup];

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D] text-white">
      {/* ===== 顶部标题栏 ===== */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2C2C2C] bg-[#0D0D0D] shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#2C2C2C] hover:bg-[#3A3A3A] text-[#A0A0A0] hover:text-white transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight">技能配置</h1>
          <p className="text-xs text-[#888888] mt-0.5">配置制造技能等级，影响蓝图材料效率</p>
        </div>
      </div>

      {/* ===== 主体内容 ===== */}
      <div className="flex flex-1 min-h-0">
        {/* ----- 桌面端：左侧分类导航栏 ----- */}
        <nav className="hidden md:flex flex-col w-52 shrink-0 border-r border-[#2C2C2C] bg-[#1E1E1E] py-3 px-2 gap-1 overflow-y-auto">
          {SKILL_GROUPS.map((group, idx) => {
            const isActive = idx === activeGroup;
            const count = group.skills.filter((s) => (skills[s.engName] ?? 0) > 0).length;
            return (
              <button
                key={group.name}
                onClick={() => setActiveGroup(idx)}
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-200
                  ${isActive
                    ? 'bg-[#7C3AED]/15 text-white border border-[#7C3AED]/40'
                    : 'text-[#A0A0A0] hover:bg-[#2C2C2C] hover:text-white border border-transparent'
                  }
                `}
              >
                <span className="text-sm font-medium truncate">{group.name}</span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {count > 0 && (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-[#7C3AED]/30 text-[#A78BFA]' : 'bg-[#2C2C2C] text-[#888888]'}`}>
                      {count}
                    </span>
                  )}
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? 'text-[#A78BFA]' : 'text-[#555]'}`} />
                </div>
              </button>
            );
          })}
        </nav>

        {/* ----- 移动端 + 桌面端右侧：技能列表 ----- */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 移动端顶部 Tab */}
          <div className="flex md:hidden gap-1 px-3 py-2.5 border-b border-[#2C2C2C] overflow-x-auto shrink-0">
            {SKILL_GROUPS.map((group, idx) => {
              const isActive = idx === activeGroup;
              return (
                <button
                  key={group.name}
                  onClick={() => setActiveGroup(idx)}
                  className={`
                    whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 shrink-0
                    ${isActive
                      ? 'bg-[#7C3AED] text-white shadow-lg shadow-purple-500/20'
                      : 'bg-[#2C2C2C] text-[#888888] hover:bg-[#3A3A3A] hover:text-white'
                    }
                  `}
                >
                  {group.name}
                </button>
              );
            })}
          </div>

          {/* 当前分类标题（桌面端） */}
          <div className="hidden md:flex items-center gap-2 px-5 pt-4 pb-2 shrink-0">
            <div className="h-5 w-1 rounded-full bg-[#7C3AED]" />
            <h2 className="text-base font-semibold text-white">{currentGroup.name}</h2>
            <span className="text-xs text-[#888888]">{currentGroup.skills.length} 项技能</span>
          </div>

          {/* 技能列表 */}
          <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3 md:py-4 space-y-2">
            {currentGroup.skills.map((skill) => (
              <SkillRow
                key={skill.engName}
                skill={skill}
                level={skills[skill.engName] ?? 0}
                onLevelChange={handleLevelChange}
                onSetMin={handleSetMin}
                onSetMax={handleSetMax}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ===== 底部操作栏 ===== */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[#2C2C2C] bg-[#1E1E1E] shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-[#A0A0A0]">
            已配置 <span className="font-bold text-[#A78BFA]">{configuredCount}</span> / {totalSkills} 项技能
          </span>
          {hasChanges && <span className="text-[10px] text-[#F59E0B] bg-[#F59E0B]/15 px-1.5 py-0.5 rounded-md shrink-0">未保存</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {configuredCount > 0 && (
            <button
              onClick={() => { setSkills({}); }}
              className="text-xs text-[#888888] hover:text-red-400 transition-colors duration-200 px-2 py-1.5 rounded-lg hover:bg-[#2C2C2C]"
            >
              全部清空
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95
              ${hasChanges
                ? 'bg-[#7C3AED] text-white shadow-[0_4px_12px_rgba(124_58_237_0.35)] hover:bg-[#6D28D9]'
                : 'bg-[#2C2C2C] text-[#888888] cursor-not-allowed'
              }
            `}
          >
            {showSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {showSaved ? '已保存' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}