import { newId } from '../../domain/id'
import { useState } from 'react'
import { calculateUValue, validateConstruction } from '../../domain/construction'
import type { Material, OpaqueConstruction } from '../../domain/construction'
type DraftLayer = { key: string; name: string; thickness: string; conductivity: string; material?: Material }
const numeric = (value: string) => value.trim() ? Number(value) : NaN
export function ConstructionEditor({ value, onSave }: { value: OpaqueConstruction; onSave: (value: OpaqueConstruction) => Promise<void> }) {
  const [name, setName] = useState(value.name)
  const [rsi, setRsi] = useState(String(value.rsi_m2k_w))
  const [rse, setRse] = useState(String(value.rse_m2k_w))
  const [layers, setLayers] = useState<DraftLayer[]>(() => value.layers.map((layer, index) => {
    const material = value.materials.find(m => m.id === layer.material_id)!
    return { key: `layer-${index}`, material, name: material.name, thickness: String(layer.thickness_m * 1000), conductivity: String(material.conductivity_w_mk) }
  }))
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const draft: OpaqueConstruction = {
    ...value, name, rsi_m2k_w: numeric(rsi), rse_m2k_w: numeric(rse),
    materials: layers.map(layer => ({ ...layer.material, id: layer.key, name: layer.name, conductivity_w_mk: numeric(layer.conductivity) })),
    layers: layers.map(layer => ({ material_id: layer.key, thickness_m: numeric(layer.thickness) / 1000 })),
  }
  const checked = validateConstruction(draft)
  let u: number | null = null
  if (checked.ok) { try { u = calculateUValue(checked.value) } catch { /* invalid numeric range */ } }
  const change = (index: number, field: keyof Omit<DraftLayer, 'key'>, next: string) => {
    setLayers(previous => previous.map((layer, i) => i === index ? { ...layer, [field]: next } : layer))
    setMessage(''); setSaveError('')
  }
  async function save() {
    if (!checked.ok || u === null) return
    setSaving(true); setMessage(''); setSaveError('')
    try { await onSave(checked.value); setMessage('构造已保存') }
    catch (error) { setSaveError(error instanceof Error ? error.message : '保存失败') }
    finally { setSaving(false) }
  }
  return <section className="card editor" aria-labelledby="construction-title">
    <div className="section-heading"><div><span className="eyebrow">CONSTRUCTION LIBRARY</span><h2 id="construction-title">节能构造编辑器</h2></div><span className="pill">一维稳态</span></div>
    <label className="name-field">构造名称<input value={name} onChange={e => { setName(e.target.value); setMessage('') }} /></label>
    <div className="assembly-preview" aria-label="构造层剖面示意，非比例物理渲染">
      <span>室外</span><div className="layer-strips">{layers.map((layer, i) => <div key={layer.key} className={`strip strip-${i % 4}`} style={{ flex: Math.max(1, Math.min(8, numeric(layer.thickness) / 15 || 1)) }} title={layer.name}><span>{i + 1}</span></div>)}</div><span>室内</span>
    </div>
    <div className="layer-labels"><span>材料层 / 室外 → 室内</span><span>厚度 mm</span><span>λ W/(m·K)</span><span /></div>
    <div className="layer-list">{layers.map((layer, i) => <div className="layer-row" key={layer.key}>
      <label className="material-name"><b className={`swatch strip-${i % 4}`}>{i + 1}</b><input aria-label={`第 ${i + 1} 层名称`} value={layer.name} onChange={e => change(i, 'name', e.target.value)} /></label>
      <input type="number" step="any" min="0" aria-label={`第 ${i + 1} 层厚度（mm）`} value={layer.thickness} onChange={e => change(i, 'thickness', e.target.value)} />
      <input type="number" step="any" min="0" aria-label={`第 ${i + 1} 层导热系数`} value={layer.conductivity} onChange={e => change(i, 'conductivity', e.target.value)} />
      <button className="icon-button" aria-label={`删除第 ${i + 1} 层`} disabled={layers.length === 1 || saving} onClick={() => { setLayers(previous => previous.filter((_, index) => index !== i)); setMessage('') }}>×</button>
    </div>)}</div>
    <button className="add-layer" aria-label="添加材料层" disabled={saving} onClick={() => { setLayers(previous => [...previous, { key: newId(), name: '新材料（请填写）', thickness: '20', conductivity: '1' }]); setMessage('') }}>＋ 添加材料层</button>
    <div className="resistance-fields"><label>内表面热阻 Rsi<input type="number" step="any" min="0" value={rsi} onChange={e => { setRsi(e.target.value); setMessage('') }} /></label><label>外表面热阻 Rse<input type="number" step="any" min="0" value={rse} onChange={e => { setRse(e.target.value); setMessage('') }} /></label></div>
    <p className="helper">表面热阻单位 m²·K/W；需按适用条件核对。层剖面仅为示意。</p>
    <div className="u-value"><div><span>构造传热系数 U</span><strong aria-label="构造传热系数">{u === null ? '—' : u.toFixed(3)} <small>W/(m²·K)</small></strong></div><span className="calculation-mark">Σ d / λ</span></div>
    <p className="source-note">{value.source}</p>
    {!checked.ok && <div className="error-message" role="alert">{checked.errors.map(error => error.message).filter((error, index, all) => all.indexOf(error) === index).join('；')}</div>}
    {saveError && <div className="error-message" role="alert">{saveError}</div>}
    <div className="editor-footer"><span className="helper">{message || '保存仅更新构造，不代表已应用到模型。'}</span><button className="primary-button" disabled={!checked.ok || u === null || saving} onClick={save}>{saving ? '保存中…' : '保存构造'}</button></div>
  </section>
}
