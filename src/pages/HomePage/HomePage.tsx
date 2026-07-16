function lsGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import Header from '@/components/Header';
import BottomTabBar, { type TabKey } from '@/components/BottomTabBar';
import MaterialInputSection from '@/components/MaterialInputSection';
import CalcSection from '@/components/CalcSection';
import ProjectSection from '@/components/ProjectSection';
import {
  PRESET_MINERALS,
  PRESET_SHIP_MATERIALS,
  PRESET_BUILD_MATERIALS,
  DEFAULT_CALC_PARAMS,
  type IMaterialItem,
  type ICalcParams,
  type IManufactureProject,
} from '@/data/materials';
import { sumMaterials } from '@/lib/utils';
import { loadMaterialPrices, type MarketDataItem } from '@/lib/admin-projects';
import MarketPage from '@/pages/MarketPage/MarketPage';

const STORAGE_KEYS = {
  minerals: 'eve_minerals_v3',
  shipMaterials: 'eve_ship_materials_v3',
  buildMaterials: 'eve_build_materials_v3',
  calcParams: 'eve_calc_params_v3',
  activeTab: 'eve_active_tab_v3',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = lsGetItem(key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    loadFromStorage<TabKey>(STORAGE_KEYS.activeTab, 'calc'),
  );
  const [minerals, setMinerals] = useState<IMaterialItem[]>(() =>
    loadFromStorage<IMaterialItem[]>(STORAGE_KEYS.minerals, PRESET_MINERALS),
  );
  const [shipMaterials, setShipMaterials] = useState<IMaterialItem[]>(() =>
    loadFromStorage<IMaterialItem[]>(STORAGE_KEYS.shipMaterials, PRESET_SHIP_MATERIALS),
  );
  const [buildMaterials, setBuildMaterials] = useState<IMaterialItem[]>(() =>
    loadFromStorage<IMaterialItem[]>(STORAGE_KEYS.buildMaterials, PRESET_BUILD_MATERIALS),
  );
  const [calcParams, setCalcParams] = useState<ICalcParams>(() =>
    loadFromStorage<ICalcParams>(STORAGE_KEYS.calcParams, DEFAULT_CALC_PARAMS),
  );
  const [showWelcome, setShowWelcome] = useState(true);

  // 三页材料总价之和（自动联动到 150%效率市价材料成本）
  const linkedMaterialTotal = useMemo(() => {
    return sumMaterials(minerals) + sumMaterials(shipMaterials) + sumMaterials(buildMaterials);
  }, [minerals, shipMaterials, buildMaterials]);

  // 当材料总价变化时，自动同步到 calcParams.materialCost150
  useEffect(() => {
    setCalcParams((prev) => {
      if (Math.abs(prev.materialCost150 - linkedMaterialTotal) < 0.0001) return prev;
      return { ...prev, materialCost150: linkedMaterialTotal };
    });
  }, [linkedMaterialTotal]);

  // 持久化存储
  useEffect(() => {
    lsSetItem(STORAGE_KEYS.activeTab, JSON.stringify(activeTab));
  }, [activeTab]);
  useEffect(() => {
    lsSetItem(STORAGE_KEYS.minerals, JSON.stringify(minerals));
  }, [minerals]);
  useEffect(() => {
    lsSetItem(STORAGE_KEYS.shipMaterials, JSON.stringify(shipMaterials));
  }, [shipMaterials]);
  useEffect(() => {
    lsSetItem(STORAGE_KEYS.buildMaterials, JSON.stringify(buildMaterials));
  }, [buildMaterials]);
  useEffect(() => {
    lsSetItem(STORAGE_KEYS.calcParams, JSON.stringify(calcParams));
  }, [calcParams]);

  // 仅追加后台新增材料（不覆盖用户已手动修改的已有数据）
  useEffect(() => {
    const syncNewMaterials = async () => {
      try {
        const [mineralPrices, shipPrices, buildPrices] = await Promise.all([
          loadMaterialPrices('minerals'),
          loadMaterialPrices('ship_materials'),
          loadMaterialPrices('build_materials'),
        ]);
        if (mineralPrices.length > 0) {
          setMinerals((prev) => {
            const existingNames = new Set(prev.map((p) => p.name));
            const newItems = mineralPrices
              .filter((c) => !existingNames.has(c.name))
              .map((c) => ({ name: c.name, price: c.price, quantity: c.quantity || 0 }));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
        if (shipPrices.length > 0) {
          setShipMaterials((prev) => {
            const existingNames = new Set(prev.map((p) => p.name));
            const newItems = shipPrices
              .filter((c) => !existingNames.has(c.name))
              .map((c) => ({ name: c.name, price: c.price, quantity: c.quantity || 0 }));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
        if (buildPrices.length > 0) {
          setBuildMaterials((prev) => {
            const existingNames = new Set(prev.map((p) => p.name));
            const newItems = buildPrices
              .filter((c) => !existingNames.has(c.name))
              .map((c) => ({ name: c.name, price: c.price, quantity: c.quantity || 0 }));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      } catch { /* ignore */ }
    };
    syncNewMaterials();
  }, []);

  const handleParamChange = <K extends keyof ICalcParams>(key: K, value: number) => {
    setCalcParams((prev) => ({ ...prev, [key]: value }));
  };

  // 从制造项目页导入数据到成本计算
  const handleImportProject = useCallback((project: IManufactureProject) => {
    setCalcParams((prev) => ({
      ...prev,
      materialCost150: project.materialCost150,
      blueprintPrice: project.blueprintPrice,
      fixedManufactureFee: project.fixedManufactureFee,
      buyOrderPrice: project.buyOrderPrice,
      marketSellPrice: project.marketSellPrice,
    }));
  }, []);

  const switchToCalc = useCallback(() => {
    setActiveTab('calc');
  }, []);

  // 从市场数据导入到三项录入
  const handleImportMarket = useCallback(
    (category: 'minerals' | 'ship_materials' | 'build_materials', items: MarketDataItem[]) => {
      const importData = (prev: IMaterialItem[]) => {
        return prev.map((item) => {
          const marketItem = items.find((mi) => mi.name === item.name);
          if (marketItem) {
            return {
              ...item,
              price: marketItem.sell_price || item.price,
            };
          }
          return item;
        });
      };

      let categoryName = '';
      if (category === 'minerals') {
        setMinerals((prev) => importData(prev));
        categoryName = '矿物';
      } else if (category === 'ship_materials') {
        setShipMaterials((prev) => importData(prev));
        categoryName = '船材';
      } else if (category === 'build_materials') {
        setBuildMaterials((prev) => importData(prev));
        categoryName = '建材';
      }

      toast.success(`已导入 ${items.length} 项市场价格到${categoryName}录入`);
    },
    [],
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'calc':
        return (
          <CalcSection
            params={calcParams}
            onParamChange={handleParamChange}
            linkedMaterialTotal={linkedMaterialTotal}
          />
        );
      case 'project':
        return (
          <ProjectSection
            onImportCost={handleImportProject}
            onImportMaterials={(mats) => {
              setMinerals(mats.minerals);
              setShipMaterials(mats.shipMaterials);
              setBuildMaterials(mats.buildMaterials);
            }}
            onSwitchToCalc={switchToCalc}
            onSwitchToMinerals={() => setActiveTab('minerals')}
            currentMinerals={minerals}
            currentShipMaterials={shipMaterials}
            currentBuildMaterials={buildMaterials}
          />
        );
      case 'minerals':
        return (
          <MaterialInputSection
            title="矿物录入"
            subtitle="输入矿物单价和数量，自动计算每项总价（单位：亿 ISK）"
            materials={minerals}
            onChange={setMinerals}
          />
        );
      case 'ship':
        return (
          <MaterialInputSection
            title="船材录入"
            subtitle="输入舰船材料单价和数量，自动计算每项总价（单位：亿 ISK）"
            materials={shipMaterials}
            onChange={setShipMaterials}
          />
        );
      case 'build':
        return (
          <MaterialInputSection
            title="建材录入"
            subtitle="输入建筑材料单价和数量，自动计算每项总价（单位：亿 ISK）"
            materials={buildMaterials}
            onChange={setBuildMaterials}
          />
        );
      case 'market':
        return <MarketPage onImport={handleImportMarket} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1E1E1E] text-white">
      <Toaster theme="dark" position="top-center" closeButton />
      <Header />
      <main className={`flex-1 ${activeTab === 'market' ? 'overflow-y-auto' : 'overflow-hidden'}`}>{renderContent()}</main>
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 欢迎弹窗 */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="relative w-full max-w-sm rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl">
            <button
              onClick={() => setShowWelcome(false)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-[#888888] transition-colors hover:bg-[#3A3A3A] hover:text-white"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-semibold text-[#A78BFA] pr-6">提示</h3>
            <div className="mt-3 space-y-2 text-sm text-[#A0A0A0]">
              <p>有bug可以联系作者：2787045979（QQ）</p>
              <p>此版本为测试版本。</p>
            </div>
            <button
              onClick={() => setShowWelcome(false)}
              className="mt-5 w-full rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98]"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
