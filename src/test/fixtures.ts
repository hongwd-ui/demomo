export const sampleConstruction = () => ({
  id: 'wall-1', name: '示例外墙', kind: 'opaque_series' as const,
  source: '合成演示，非规范建议', rsi_m2k_w: 0.1, rse_m2k_w: 0.05,
  materials: [{ id: 'concrete', name: '混凝土示例', conductivity_w_mk: 1 }],
  layers: [{ material_id: 'concrete', thickness_m: 0.2 }],
})

