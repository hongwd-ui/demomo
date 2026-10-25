export type Material = {
  id: string
  name: string
  conductivity_w_mk: number
  density_kg_m3?: number
  specific_heat_j_kgk?: number
  solar_absorptance?: number
  solar_reflectance?: number
  solar_transmittance?: number
  visible_transmittance?: number
  refractive_index?: number
}
export type Layer = { material_id: string; thickness_m: number }
export type OpaqueConstruction = {
  id: string; name: string; kind: 'opaque_series'; source: string
  rsi_m2k_w: number; rse_m2k_w: number
  materials: Material[]; layers: Layer[]
}
export type FieldError = { path: string; message: string }
export type ValidationResult = { ok: true; value: OpaqueConstruction } | { ok: false; errors: FieldError[] }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

export function validateConstruction(input: unknown): ValidationResult {
  const errors: FieldError[] = []
  const error = (path: string, message: string) => errors.push({ path, message })
  if (!record(input)) return { ok: false, errors: [{ path: '', message: '构造数据无效' }] }
  for (const key of ['id', 'name', 'source']) if (!text(input[key])) error(key, '请填写非空文本')
  if (input.kind !== 'opaque_series') error('kind', '仅支持一维串联不透明构造')
  for (const key of ['rsi_m2k_w', 'rse_m2k_w']) if (!finite(input[key]) || input[key] < 0) error(key, '表面热阻必须是非负有限数')
  const materials = Array.isArray(input.materials) ? input.materials : []
  const ids = new Set<string>()
  if (!materials.length) error('materials', '至少需要一种材料')
  materials.forEach((m: unknown, i) => {
    const prefix = `materials.${i}`
    if (!record(m)) { error(prefix, '材料数据无效'); return }
    if (!text(m.id) || ids.has(m.id)) error(`${prefix}.id`, '材料标识不能为空或重复')
    else ids.add(m.id)
    if (!text(m.name)) error(`${prefix}.name`, '请填写材料名称')
    for (const key of ['conductivity_w_mk', 'density_kg_m3', 'specific_heat_j_kgk', 'refractive_index']) {
      if ((key === 'conductivity_w_mk' || m[key] !== undefined) && (!finite(m[key]) || m[key] <= 0)) error(`${prefix}.${key}`, '必须是大于零的有限数')
    }
    for (const key of ['solar_absorptance', 'solar_reflectance', 'solar_transmittance', 'visible_transmittance']) {
      if (m[key] !== undefined && (!finite(m[key]) || m[key] < 0 || m[key] > 1)) error(`${prefix}.${key}`, '必须在 0 到 1 之间')
    }
    const solar = [m.solar_absorptance, m.solar_reflectance, m.solar_transmittance]
    if (solar.every(finite) && Math.abs(solar.reduce((sum, value) => sum + value, 0) - 1) > 0.010000001) error(prefix, '同波段太阳吸收率、反射率与透射率之和应为 1（容差 0.01）')
  })
  const layers = Array.isArray(input.layers) ? input.layers : []
  if (!layers.length) error('layers', '至少需要一层材料')
  layers.forEach((layer: unknown, i) => {
    if (!record(layer)) { error(`layers.${i}`, '层数据无效'); return }
    if (!text(layer.material_id) || !ids.has(layer.material_id)) error(`layers.${i}.material_id`, '找不到引用的材料')
    if (!finite(layer.thickness_m) || layer.thickness_m <= 0) error(`layers.${i}.thickness_m`, '厚度必须大于零，单位为米')
  })
  return errors.length ? { ok: false, errors } : { ok: true, value: input as OpaqueConstruction }
}

export function calculateUValue(input: OpaqueConstruction): number {
  const checked = validateConstruction(input)
  if (!checked.ok) throw new Error(checked.errors.map(e => e.message).join('；'))
  const materials = new Map(input.materials.map(m => [m.id, m]))
  const resistance = input.rsi_m2k_w + input.rse_m2k_w + input.layers.reduce((sum, layer) => sum + layer.thickness_m / materials.get(layer.material_id)!.conductivity_w_mk, 0)
  const u = 1 / resistance
  if (!Number.isFinite(u) || u <= 0) throw new Error('计算超出有效数值范围')
  return u
}
