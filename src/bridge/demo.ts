import { validateConstruction } from '../domain/construction'
import type { OpaqueConstruction } from '../domain/construction'
export const storageKey = 'zhitan.construction.v1'
export function defaultConstruction(): OpaqueConstruction {
  return {
    id: 'demo-wall', name: '外墙 · 多层构造', kind: 'opaque_series',
    source: '合成演示参数；非规范建议值，工程使用前请核对产品资料',
    rsi_m2k_w: 0.1, rse_m2k_w: 0.05,
    materials: [
      { id: 'finish', name: '水泥砂浆（示例）', conductivity_w_mk: 0.93 },
      { id: 'insulation', name: '保温材料（示例）', conductivity_w_mk: 0.04 },
      { id: 'concrete', name: '钢筋混凝土（示例）', conductivity_w_mk: 1.74 },
    ],
    layers: [
      { material_id: 'finish', thickness_m: 0.02 },
      { material_id: 'insulation', thickness_m: 0.05 },
      { material_id: 'concrete', thickness_m: 0.2 },
    ],
  }
}
export function loadLocalConstruction(): { value: OpaqueConstruction; warning: string } {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return { value: defaultConstruction(), warning: '' }
    const checked = validateConstruction(JSON.parse(stored))
    if (checked.ok) return { value: checked.value, warning: '' }
    return { value: defaultConstruction(), warning: '本地构造数据无效，已载入演示参数；原数据未覆盖。' }
  } catch {
    return { value: defaultConstruction(), warning: '本地构造数据无效或不可访问，已载入演示参数。' }
  }
}
export async function saveLocalConstruction(value: OpaqueConstruction): Promise<void> {
  const checked = validateConstruction(value)
  if (!checked.ok) throw new Error(checked.errors.map(error => error.message).join('；'))
  localStorage.setItem(storageKey, JSON.stringify(checked.value))
}
