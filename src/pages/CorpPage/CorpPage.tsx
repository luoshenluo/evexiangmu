import React, { useState, useEffect, useCallback } from 'react';

/* ========== 类型定义 ========== */

/** 军团配置持久化数据结构 */
export interface CorpConfig {
  modules: { [engName: string]: number };
  techs: { [engName: string]: number };
}

/** 页面属性 */
export interface CorpPageProps {
  onBack?: () => void;
}

/* ========== 配置定义 ========== */

/** 模块配置条目 */
interface ModuleEntry {
  engName: string;       // 英文标识，用作 localStorage key
  cnName: string;        // 中文显示名
  maxLevel: number;      // 最大等级
  desc: string;          // 中文描述
}

/** 科技配置条目 */
interface TechEntry {
  engName: string;
  cnName: string;
  maxLevel: number;
  desc: string;
}

/** 所有模块定义 */
const MODULES: ModuleEntry[] = [
  {
    engName: 'assembly_workshop',
    cnName: '装配车间模块',
    maxLevel: 3,
    desc: '每级 +1% 材料效率，-0.5% 时间',
  },
  {
    engName: 'capital_ship_parts_factory',
    cnName: '旗舰部件工厂模块',
    maxLevel: 3,
    desc: '每级 +1% 材料效率，-0.5% 时间',
  },
];

/** 所有科技定义 */
const TECHS: TechEntry[] = [
  {
    engName: 'manufacturing_technology',
    cnName: '制造技术',
    maxLevel: 3,
    desc: '每级 +1% ME，-1% TE',
  },
  {
    engName: 'advanced_manufacturing_technology',
    cnName: '高级制造技术',
    maxLevel: 5,
    desc: '每级 +1% ME，-1% TE',
  },
  {
    engName: 'advanced_manufacturing_technology_ii',
    cnName: '高级制造技术 II',
    maxLevel: 5,
    desc: '每级 +1% ME，-1% TE',
  },
];

/* ========== localStorage 工具 ========== */

const STORAGE_KEY = 'eve_echoes_corp_v1';

/** 从 localStorage 读取军团配置，若不存在则返回默认值 */
function loadConfig(): CorpConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as CorpConfig;
    }
  } catch {
    // 解析失败时使用默认值
  }
  return { modules: {}, techs: {} };
}

/** 将军团配置写入 localStorage */
function saveConfig(config: CorpConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ========== 子组件 ========== */

/** 等级调整按钮行 */
interface LevelButtonsProps {
  level: number;         // 当前等级（0 ~ maxLevel）
  maxLevel: number;      // 最大等级
  onChange: (newLevel: number) => void;
}

const LevelButtons: React.FC<LevelButtonsProps> = ({ level, maxLevel, onChange }) => {
  /** 按钮基础样式 */
  const baseBtn =
    'flex items-center justify-center rounded px-2 py-1 text-xs font-medium transition-colors select-none';

  /** 普通按钮样式 */
  const normalBtn = `${baseBtn} bg-[#2C2C2C] text-[#A0A0A0] hover:bg-[#3A3A3A] hover:text-white cursor-pointer`;

  /** 当前等级高亮按钮样式 */
  const activeBtn = `${baseBtn} bg-[#7C3AED] text-white cursor-default`;

  /** 边界按钮（Min / Max）样式 */
  const boundaryBtn = `${baseBtn} bg-[#2C2C2C] text-[#888888] hover:bg-[#3A3A3A] hover:text-[#A0A0A0] cursor-pointer`;

  /** 构造按钮列表 */
  const buttons: { label: string; value: number; isBoundary?: boolean }[] = [
    { label: 'Min', value: 0, isBoundary: true },
    { label: '−', value: Math.max(0, level - 1) },
    ...Array.from({ length: maxLevel + 1 }, (_, i) => ({ label: `${i}`, value: i })),
    { label: '+', value: Math.min(maxLevel, level + 1) },
    { label: 'Max', value: maxLevel, isBoundary: true },
  ];

  return (
    <div className="flex items-center gap-1">
      {buttons.map((btn) => {
        const isActive = !btn.isBoundary && btn.label !== '−' && btn.label !== '+' && btn.value === level;
        return (
          <button
            key={`${btn.label}-${btn.value}`}
            className={isActive ? activeBtn : btn.isBoundary ? boundaryBtn : normalBtn}
            onClick={() => onChange(btn.value)}
            disabled={isActive}
            title={btn.isBoundary ? (btn.value === 0 ? '最低等级' : '最高等级') : undefined}
          >
            {btn.label}
          </button>
        );
      })}
    </div>
  );
};

/** 单个配置行 */
interface ConfigRowProps {
  cnName: string;
  engName: string;
  desc: string;
  level: number;
  maxLevel: number;
  onChange: (engName: string, newLevel: number) => void;
}

const ConfigRow: React.FC<ConfigRowProps> = ({ cnName, engName, desc, level, maxLevel, onChange }) => {
  /** 等级显示文本 */
  const levelText = level === 0 ? '关闭' : `Lv.${level}`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] p-4 transition-colors hover:border-[#7C3AED]/40">
      {/* 主行：名称 + 等级文本 */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-white">{cnName}</span>
          <span className="text-xs text-[#888888]">{desc}</span>
        </div>
        <span className={`min-w-[3rem] text-right text-sm font-medium ${level === 0 ? 'text-[#888888]' : 'text-[#A78BFA]'}`}>
          {levelText}
        </span>
      </div>

      {/* 按钮行 */}
      <div className="flex justify-end">
        <LevelButtons
          level={level}
          maxLevel={maxLevel}
          onChange={(newLevel) => onChange(engName, newLevel)}
        />
      </div>
    </div>
  );
};

/** 分区标题 */
const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="mb-3 flex items-center gap-2">
    <div className="h-px flex-1 bg-[#3A3A3A]" />
    <h2 className="whitespace-nowrap text-sm font-semibold tracking-wide text-[#A78BFA]">
      {title}
    </h2>
    <div className="h-px flex-1 bg-[#3A3A3A]" />
  </div>
);

/* ========== 主页面组件 ========== */

const CorpPage: React.FC<CorpPageProps> = ({ onBack }) => {
  const [config, setConfig] = useState<CorpConfig>(loadConfig);

  /* 配置变更时持久化 */
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  /* ---- 模块等级变更 ---- */
  const handleModuleChange = useCallback((engName: string, newLevel: number) => {
    setConfig((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [engName]: newLevel,
      },
    }));
  }, []);

  /* ---- 科技等级变更 ---- */
  const handleTechChange = useCallback((engName: string, newLevel: number) => {
    setConfig((prev) => ({
      ...prev,
      techs: {
        ...prev.techs,
        [engName]: newLevel,
      },
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* ========== 顶部导航栏 ========== */}
        <div className="mb-6 flex items-center gap-3">
          {/* 返回按钮 */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] text-[#A0A0A0] transition-colors hover:border-[#7C3AED]/60 hover:text-white"
              title="返回"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h1 className="text-xl font-bold tracking-wide text-white">军团配置</h1>
        </div>

        {/* ========== 分区1：模块 ========== */}
        <section className="mb-8">
          <SectionTitle title="模块 (Modules)" />
          <div className="flex flex-col gap-3">
            {MODULES.map((mod) => (
              <ConfigRow
                key={mod.engName}
                cnName={mod.cnName}
                engName={mod.engName}
                desc={mod.desc}
                level={config.modules[mod.engName] ?? 0}
                maxLevel={mod.maxLevel}
                onChange={handleModuleChange}
              />
            ))}
          </div>
        </section>

        {/* ========== 分区2：军团科技 ========== */}
        <section className="mb-8">
          <SectionTitle title="军团科技 (Corp Technology)" />
          <div className="flex flex-col gap-3">
            {TECHS.map((tech) => (
              <ConfigRow
                key={tech.engName}
                cnName={tech.cnName}
                engName={tech.engName}
                desc={tech.desc}
                level={config.techs[tech.engName] ?? 0}
                maxLevel={tech.maxLevel}
                onChange={handleTechChange}
              />
            ))}
          </div>
        </section>

        {/* ========== 底部信息 ========== */}
        <div className="mt-4 text-center text-xs text-[#888888]">
          数据保存在本地浏览器中
        </div>
      </div>
    </div>
  );
};

export default CorpPage;
