import type { IProjectMaterials } from '@/data/materials';
import { PRESET_MINERALS, PRESET_SHIP_MATERIALS, PRESET_BUILD_MATERIALS } from '@/data/materials';

/** 创建空的材料数量数组 */
export function emptyMaterials(): IProjectMaterials {
  return {
    minerals: new Array(PRESET_MINERALS.length).fill(0),
    shipMaterials: new Array(PRESET_SHIP_MATERIALS.length).fill(0),
    buildMaterials: new Array(PRESET_BUILD_MATERIALS.length).fill(0),
  };
}