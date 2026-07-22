import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import Header from '@/components/Header';
import BottomTabBar, { type TabKey } from '@/components/BottomTabBar';
import MaterialInputSection from '@/components/MaterialInputSection';
import CalcSection from '@/components/CalcSection';
import ProjectSection from '@/components/ProjectSection';
import { PRESET_MINERALS, PRESET_SHIP_MATERIALS, PRESET_BUILD_MATERIALS, DEFAULT_CALC_PARAMS, type IMaterialItem, type ICalcParams, type IManufactureProject } from '@/data/materials';
import { sumMaterials } from '@/lib/utils';
import { loadMaterialPrices, getAnnouncement, type MarketDataItem, type Announcement } from '@/lib/admin-projects';
import { getCurrentUser, saveUserCloudData, loadUserCloudData } from '@/lib/user-service';
import MarketPage from '@/pages/MarketPage/MarketPage';
import SkillsPage from '@/pages/SkillsPage/SkillsPage';
import CorpPage from '@/pages/CorpPage/CorpPage';

const STORAGE_KEYS = { minerals: 'eve_minerals_v3', shipMaterials: 'eve_ship_materials_v3', buildMaterials: 'eve_build_materials_v3', calcParams: 'eve_calc_params_v3', activeTab: 'eve_active_tab_v3' };

function loadFromStorage<T>(key: string, fallback: T, useSession = false): T { try { const raw = useSession ? sessionStorage.getItem(key) : localStorage.getItem(key); if (raw) return JSON.parse(raw) as T; } catch { /* ignore */ } return fallback; }

export default function HomePage() {
  // 用户个人数据使用 sessionStorage，确保同一浏览器不同 Tab 之间互不干扰
  const [activeTab, setActiveTab] = useState<TabKey>(() => loadFromStorage<TabKey>(STORAGE_KEYS.activeTab, 'calc', true));
  const [minerals, setMinerals] = useState<IMaterialItem[]>(() => loadFromStorage<IMaterialItem[]>(STORAGE_KEYS.minerals, PRESET_MINERALS, true));
  const [shipMaterials, setShipMaterials] = useState<IMaterialItem[]>(() => loadFromStorage<IMaterialItem[]>(STORAGE_KEYS.shipMaterials, PRESET_SHIP_MATERIALS, true));
  const [buildMaterials, setBuildMaterials] = useState<IMaterialItem[]>(() => loadFromStorage<IMaterialItem[]>(STORAGE_KEYS.buildMaterials, PRESET_BUILD_MATERIALS, true));
  const [calcParams, setCalcParams] = useState<ICalcParams>(() => loadFromStorage<ICalcParams>(STORAGE_KEYS.calcParams, DEFAULT_CALC_PARAMS, true));
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const linkedMaterialTotal = useMemo(() => sumMaterials(minerals) + sumMaterials(shipMaterials) + sumMaterials(buildMaterials), [minerals, shipMaterials, buildMaterials]);

  useEffect(() => { setCalcParams((prev) => { if (Math.abs(prev.materialCost150 - linkedMaterialTotal) < 0.0001) return prev; return { ...prev, materialCost150: linkedMaterialTotal }; }); }, [linkedMaterialTotal]);

  useEffect(() => { try { sessionStorage.setItem(STORAGE_KEYS.activeTab, JSON.stringify(activeTab)); } catch { /* ignore */ } }, [activeTab]);
  useEffect(() => { try { sessionStorage.setItem(STORAGE_KEYS.minerals, JSON.stringify(minerals)); } catch { /* ignore */ } }, [minerals]);
  useEffect(() => { try { sessionStorage.setItem(STORAGE_KEYS.shipMaterials, JSON.stringify(shipMaterials)); } catch { /* ignore */ } }, [shipMaterials]);
  useEffect(() => { try { sessionStorage.setItem(STORAGE_KEYS.buildMaterials, JSON.stringify(buildMaterials)); } catch { /* ignore */ } }, [buildMaterials]);
  useEffect(() => { try { sessionStorage.setItem(STORAGE_KEYS.calcParams, JSON.stringify(calcParams)); } catch { /* ignore */ } }, [calcParams]);

  useEffect(() => {
    const syncMaterials = async () => {
      try {
        const [mineralPrices, shipPrices, buildPrices] = await Promise.all([loadMaterialPrices('minerals'), loadMaterialPrices('ship_materials'), loadMaterialPrices('build_materials')]);
        if (mineralPrices.length > 0) setMinerals((prev) => mineralPrices.map((c) => { const local = prev.find((p) => p.name === c.name); return { name: c.name, price: local?.price ?? c.price, quantity: local?.quantity ?? c.quantity ?? 0 }; }));
        if (shipPrices.length > 0) setShipMaterials((prev) => shipPrices.map((c) => { const local = prev.find((p) => p.name === c.name); return { name: c.name, price: local?.price ?? c.price, quantity: local?.quantity ?? c.quantity ?? 0 }; }));
        if (buildPrices.length > 0) setBuildMaterials((prev) => buildPrices.map((c) => { const local = prev.find((p) => p.name === c.name); return { name: c.name, price: local?.price ?? c.price, quantity: local?.quantity ?? c.quantity ?? 0 }; }));
      } catch { /* ignore */ }
    };
    syncMaterials();
  }, []);

  useEffect(() => { getAnnouncement().then(setAnnouncement).catch(() => {}); }, []);
  useEffect(() => { if (announcement && announcement.enabled && announcement.content) setShowWelcome(true); }, [announcement]);

  // ==================== 云端存储同步 ====================

  // 组件挂载时，如果用户已登录，尝试从云端恢复数据
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const cloudLoadRef = useRef(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || cloudLoadRef.current) return;
    cloudLoadRef.current = true;

    const loadCloud = async () => {
      try {
        const cloudData = await loadUserCloudData();
        if (cloudData) {
          // 只恢复有值的字段
          if (cloudData.minerals && Array.isArray(cloudData.minerals)) {
            setMinerals((prev) =>
              cloudData.minerals.map((c: any) => {
                const local = prev.find((p) => p.name === c.name);
                return { name: c.name, price: c.price ?? local?.price ?? 0, quantity: c.quantity ?? local?.quantity ?? 0 };
              })
            );
          }
          if (cloudData.shipMaterials && Array.isArray(cloudData.shipMaterials)) {
            setShipMaterials((prev) =>
              cloudData.shipMaterials.map((c: any) => {
                const local = prev.find((p) => p.name === c.name);
                return { name: c.name, price: c.price ?? local?.price ?? 0, quantity: c.quantity ?? local?.quantity ?? 0 };
              })
            );
          }
          if (cloudData.buildMaterials && Array.isArray(cloudData.buildMaterials)) {
            setBuildMaterials((prev) =>
              cloudData.buildMaterials.map((c: any) => {
                const local = prev.find((p) => p.name === c.name);
                return { name: c.name, price: c.price ?? local?.price ?? 0, quantity: c.quantity ?? local?.quantity ?? 0 };
              })
            );
          }
          if (cloudData.calcParams) {
            setCalcParams((prev) => ({ ...prev, ...cloudData.calcParams }));
          }
          setCloudLoaded(true);
        }
      } catch (err) {
        console.error('[CloudSync] 加载云端数据失败:', err);
      }
    };
    loadCloud();
  }, []);

  // 防抖保存到云端（500ms）
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCloudSave = useCallback(() => {
    const user = getCurrentUser();
    if (!user) return;

    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
    }

    cloudSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveUserCloudData({
          minerals,
          shipMaterials,
          buildMaterials,
          calcParams,
        });
      } catch (err) {
        console.error('[CloudSync] 保存云端数据失败:', err);
      }
    }, 500);
  }, [minerals, shipMaterials, buildMaterials, calcParams]);

  useEffect(() => {
    triggerCloudSave();
    return () => {
      if (cloudSaveTimerRef.current) {
        clearTimeout(cloudSaveTimerRef.current);
      }
    };
  }, [minerals, shipMaterials, buildMaterials, calcParams]);

  const handleParamChange = <K extends keyof ICalcParams>(key: K, value: number) => { setCalcParams((prev) => ({ ...prev, [key]: value })); };
  const handleImportProject = useCallback((project: IManufactureProject) => { setSelectedCategory(project.category || ''); setCalcParams((prev) => ({ ...prev, materialCost150: project.materialCost150, blueprintPrice: project.blueprintPrice, fixedManufactureFee: project.fixedManufactureFee, buyOrderPrice: project.buyOrderPrice, marketSellPrice: project.marketSellPrice })); }, []);
  const switchToCalc = useCallback(() => { setActiveTab('calc'); }, []);

  const handleImportMarket = useCallback((category: 'minerals' | 'ship_materials' | 'build_materials', items: MarketDataItem[]) => {
    const importData = (prev: IMaterialItem[]) => prev.map((item) => { const marketItem = items.find((mi) => mi.name === item.name); if (marketItem) return { ...item, price: marketItem.sell_price || item.price }; return item; });
    let categoryName = '';
    if (category === 'minerals') { setMinerals((prev) => importData(prev)); categoryName = '矿物'; }
    else if (category === 'ship_materials') { setShipMaterials((prev) => importData(prev)); categoryName = '船材'; }
    else if (category === 'build_materials') { setBuildMaterials((prev) => importData(prev)); categoryName = '建材'; }
    toast.success('已导入 ' + items.length + ' 项市场价格到' + categoryName + '录入');
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'calc': return <CalcSection params={calcParams} onParamChange={handleParamChange} linkedMaterialTotal={linkedMaterialTotal} selectedCategory={selectedCategory} />;
      case 'project': return <ProjectSection onImportCost={handleImportProject} onImportMaterials={(mats, category) => { setMinerals(mats.minerals); setShipMaterials(mats.shipMaterials); setBuildMaterials(mats.buildMaterials); if (category) setSelectedCategory(category); }} onSwitchToCalc={switchToCalc} onSwitchToMinerals={() => setActiveTab('minerals')} currentMinerals={minerals} currentShipMaterials={shipMaterials} currentBuildMaterials={buildMaterials} />;
      case 'minerals': return <MaterialInputSection title="矿物录入" subtitle="输入矿物单价和数量，自动计算每项总价（单位：亿 ISK）" materials={minerals} onChange={setMinerals} />;
      case 'ship': return <MaterialInputSection title="船材录入" subtitle="输入舰船材料单价和数量，自动计算每项总价（单位：亿 ISK）" materials={shipMaterials} onChange={setShipMaterials} />;
      case 'build': return <MaterialInputSection title="建材录入" subtitle="输入建筑材料单价和数量，自动计算每项总价（单位：亿 ISK）" materials={buildMaterials} onChange={setBuildMaterials} />;
      case 'market': return <MarketPage onImport={handleImportMarket} />;
      case 'skills': return <SkillsPage />;
      case 'corp': return <CorpPage />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1E1E1E] text-white">
      <Toaster theme="dark" position="top-center" closeButton />
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-y-auto md:overflow-y-auto">{renderContent()}</main>
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="relative w-full max-w-sm rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl">
            <button onClick={() => setShowWelcome(false)} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-[#888888] transition-colors hover:bg-[#3A3A3A] hover:text-white" aria-label="关闭"><X className="h-4 w-4" /></button>
            <h3 className="text-base font-semibold text-[#A78BFA] pr-6">{announcement?.title || '提示'}</h3>
            <div className="mt-3 space-y-2 text-sm text-[#A0A0A0] whitespace-pre-line">{announcement?.content}</div>
            <button onClick={() => setShowWelcome(false)} className="mt-5 w-full rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98]">知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}