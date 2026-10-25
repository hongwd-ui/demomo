import { useEffect, useRef, useState } from 'react'
import { ConstructionEditor } from './features/materials/ConstructionEditor'
import { ResultPanel } from './features/results/ResultPanel'
import { createHostBridge } from './bridge/host'
import type { HostBridge } from './bridge/host'
import { defaultConstruction, loadLocalConstruction, saveLocalConstruction } from './bridge/demo'
import { validateConstruction } from './domain/construction'
import type { OpaqueConstruction } from './domain/construction'
import './App.css'

function App() {
  const [initial] = useState(loadLocalConstruction)
  const bridgeRef = useRef<HostBridge | null>(null)
  const [hostData, setHostData] = useState<{ key: string; value: OpaqueConstruction } | null>(null)
  const [hostError, setHostError] = useState('')
  const [status, setStatus] = useState('')
  const [active, setActive] = useState('工作台')
  const [north, setNorth] = useState('0')
  useEffect(() => {
    const host = createHostBridge(); bridgeRef.current = host
    let live = true, generation = 0
    async function loadHost() {
      const requested = ++generation
      try {
        const reply = await host.request('host.capabilities', {})
        if (!live || requested !== generation) return
        if (!Object.prototype.hasOwnProperty.call(reply.payload, 'saved_construction')) throw new Error('宿主未提供构造读取能力，请更新插件')
        const value = reply.payload.saved_construction === null ? defaultConstruction() : reply.payload.saved_construction
        const checked = validateConstruction(value)
        if (!checked.ok) throw new Error('模型中的构造数据无效，已阻止覆盖保存')
        setHostData({ key: `${reply.model_id}-${requested}`, value: checked.value })
        setHostError('')
      } catch (error) {
        if (live && requested === generation) setHostError(error instanceof Error ? error.message : '读取模型构造失败')
      }
    }
    const reload = () => { setHostData(null); setHostError(''); void loadHost() }
    const invalidate = () => setStatus('模型已变更，已有分析已失效；请重新提取并计算。')
    if (host.connected) void loadHost()
    window.addEventListener('zhitan:model-changed', reload)
    window.addEventListener('zhitan:retry-host', reload)
    window.addEventListener('zhitan:scene-invalidated', invalidate)
    return () => {
      live = false; host.dispose(); bridgeRef.current = null
      window.removeEventListener('zhitan:model-changed', reload)
      window.removeEventListener('zhitan:retry-host', reload)
      window.removeEventListener('zhitan:scene-invalidated', invalidate)
    }
  }, [])
  const connected = typeof window !== 'undefined' && typeof window.sketchup?.zhitan_request === 'function'
  async function save(value: OpaqueConstruction) {
    const bridge = bridgeRef.current
    if (connected && bridge) {
      if (!hostData) throw new Error('模型构造尚未读取，禁止保存')
      await bridge.request('construction.save', { construction: value })
      setStatus('构造已保存到 SketchUp；应用到模型后需重新计算。')
    } else {
      await saveLocalConstruction(value)
      setStatus('已保存到此浏览器，尚未应用到 SketchUp 模型。')
    }
  }
  async function exportScene() {
    const bridge = bridgeRef.current
    if (!bridge) return
    try { const reply = await bridge.request('scene.export', { selection_only: false }); setStatus(`已收到场景版本 ${reply.scene_revision}；计算引擎尚未接入面板。`) }
    catch (error) { setStatus(error instanceof Error ? error.message : '导出失败') }
  }
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#"><span className="brand-symbol">智</span><span>智碳<small>ZHITAN</small></span></a>
      <p className="nav-caption">建筑性能工作空间</p>
      <nav aria-label="功能导航">{['工作台', '节能材质', '气象与场地', '分析报告'].map((label, i) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => { setActive(label); document.getElementById(['workspace', 'construction-title', 'location-title', 'reports-note'][i])?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }) }}><span className="nav-icon">{['◫', '▤', '☼', '▧'][i]}</span>{label}{active === label && <i />}</button>)}</nav>
      <div className="sidebar-bottom"><span className="engine-dot" /> 开发预览 v0.1<p>SketchUp 专属建筑性能分析</p></div>
    </aside>
    <div className="workspace" id="workspace">
      <header className="topbar"><div className="breadcrumb">项目空间 <span>/</span> 智碳工作台</div><span className={`connection ${connected ? 'online' : ''}`}><i />{connected ? '宿主桥接已检测 · 引擎待验证' : '演示模式，未连接 SketchUp'}</span></header>
      <main>
        <div className="page-heading"><div><span className="eyebrow">BUILD BETTER. THINK CARBON.</span><h1>让设计，看见性能<span>。</span></h1><p>从一层材料开始，理解建筑与环境的关系。</p></div><button className="secondary-button" disabled={!connected} onClick={exportScene}>↗ 提取模型</button></div>
        {!connected && initial.warning && <div className="notice warning">{initial.warning}</div>}
        <div className="notice"><span>i</span><p>当前提供真实的一维构造 U 值计算。辐射热力图、气象联动与规范结论需接入并验证对应数据及引擎。</p></div>
        <div className="workspace-grid"><div className="main-column">
          <section className="card solar-card"><div className="section-heading"><div><span className="eyebrow">SOLAR RADIATION</span><h2>太阳辐射分析</h2></div><span className="pill muted">引擎未连接</span></div>
            <div className="model-placeholder"><div className="grid-plane" /><svg viewBox="0 0 500 240" role="img" aria-label="建筑体块示意，并非 SketchUp 模型或分析结果"><path d="M120 110 240 55 370 112 250 170Z" fill="#e4eeeb" stroke="#92aaa1" /><path d="M120 110 250 170 250 222 120 162Z" fill="#f3f7f5" stroke="#92aaa1" /><path d="M250 170 370 112 370 164 250 222Z" fill="#d4e2dc" stroke="#92aaa1" /><path d="M148 124v50m33-35v51m34-35v51m63-49v50m31-65v50m32-65v50" fill="none" stroke="#b2c9bd" /><circle cx="402" cy="42" r="14" stroke="#c7a761" fill="none" /><path d="M402 19v-7m0 60v-7m23-23h7m-60 0h7m39-16 5-5m-37 37-5 5m37-5 5 5m-37-37-5-5" stroke="#c7a761" /></svg><span className="schematic-label">建筑体块示意 · 非计算结果</span></div>
            <div className="empty-result"><span className="empty-icon">☼</span><div><h3>尚未计算太阳辐射</h3><p>连接 SketchUp 并完成场景、气象与引擎校验后，显示模型表面的真实分析结果。</p></div></div>
            <div className="solar-footer"><span>入射辐照度 <b>W/m²</b></span><span>预览与精算将分别标识</span></div>
          </section>
          <ResultPanel />
          <section className="report-note" id="reports-note"><b>分析报告</b><p>报告模块尚未实现；当前没有可导出的专业分析结论。</p></section>
        </div><div className="side-column">
          <section className="card location-card"><div className="section-heading"><div><span className="eyebrow">SITE & CLIMATE</span><h2 id="location-title">气象与场地</h2></div><span className="location-icon">⌖</span></div><div className="city-line"><strong>深圳</strong><span>广东 · 中国</span></div><div className="coordinates"><span>22.54° N</span><span>114.06° E</span><span>UTC +08:00</span></div><label className="north-field">真北偏转角（°）<input type="number" min="-180" max="180" value={north} onChange={e => setNorth(e.target.value)} /></label><p className="helper">场地示例值，尚未写入模型。真实气象文件未载入。</p><div className="weather-status"><span>EPW 气象数据</span><b>待导入</b></div></section>
          {!connected || hostData ? <ConstructionEditor key={hostData?.key || 'local'} value={hostData?.value || initial.value} onSave={save} /> : <section className="card host-loading"><h2>节能构造编辑器</h2><p>{hostError || '正在读取当前模型构造…'}</p>{hostError && <button className="secondary-button" onClick={() => window.dispatchEvent(new Event('zhitan:retry-host'))}>重试连接</button>}</section>}
        </div></div>
        <div className="status-line" role="status" aria-live="polite">{status || '就绪 · 构造参数为演示输入，请用产品资料替换。'}</div>
      </main><footer className="page-footer"><span>智碳 · 设计阶段性能分析</span><span>计算可追溯 · 结论有依据</span></footer>
    </div>
  </div>
}
export default App
