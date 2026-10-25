import { describe, expect, it } from 'vitest'
import { calculateUValue, validateConstruction } from './construction'

import { sampleConstruction } from '../test/fixtures'

describe('multilayer construction', () => {
  it('computes the hand-calculated series U value', () => {
    expect(calculateUValue(sampleConstruction())).toBeCloseTo(2.857142857, 8)
  })
  it('includes every layer and is invariant to layer order in steady state', () => {
    const value = sampleConstruction()
    value.materials.push({ id: 'insulation', name: '保温示例', conductivity_w_mk: 0.04 })
    value.layers.push({ material_id: 'insulation', thickness_m: 0.08 })
    expect(calculateUValue(value)).toBeCloseTo(0.425531915, 8)
    expect(calculateUValue({ ...value, layers: [...value.layers].reverse() })).toBeCloseTo(0.425531915, 8)
  })
  it.each([0, -1, NaN, Infinity, '', null])('rejects invalid thickness %s', (thickness) => {
    const value = sampleConstruction()
    expect(validateConstruction({ ...value, layers: [{ material_id: 'concrete', thickness_m: thickness }] }).ok).toBe(false)
  })
  it.each([0, -1, NaN, Infinity, ''])('rejects invalid conductivity %s', (conductivity) => {
    const value = sampleConstruction()
    expect(validateConstruction({ ...value, materials: [{ ...value.materials[0], conductivity_w_mk: conductivity }] }).ok).toBe(false)
  })
  it('rejects missing references, empty layers, duplicate material IDs and unsupported constructions', () => {
    const value = sampleConstruction()
    for (const invalid of [
      { ...value, layers: [] },
      { ...value, layers: [{ material_id: 'missing', thickness_m: 0.2 }] },
      { ...value, materials: [...value.materials, value.materials[0]] },
      { ...value, kind: 'ventilated' },
      { ...value, name: '  ' },
      { ...value, rsi_m2k_w: -0.1 },
    ]) expect(validateConstruction(invalid).ok).toBe(false)
  })
  it('checks energy conservation only within the solar band', () => {
    const value = sampleConstruction()
    const material = { ...value.materials[0], solar_absorptance: 0.8, solar_reflectance: 0.4, solar_transmittance: 0 }
    expect(validateConstruction({ ...value, materials: [material] }).ok).toBe(false)
    expect(validateConstruction({ ...value, materials: [{ ...material, solar_reflectance: 0.2, visible_transmittance: 0.9 }] }).ok).toBe(true)
  })
  it('rejects out-of-range optics and nonpositive refractive indices', () => {
    const value = sampleConstruction()
    for (const optics of [{ solar_reflectance: 1.1 }, { visible_transmittance: -0.1 }, { refractive_index: 0 }]) {
      expect(validateConstruction({ ...value, materials: [{ ...value.materials[0], ...optics }] }).ok).toBe(false)
    }
  })
  it('refuses invalid input in the calculation API rather than producing plausible output', () => {
    expect(() => calculateUValue({ ...sampleConstruction(), layers: [] })).toThrow()
  })
})
