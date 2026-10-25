export function ResultPanel() {
  return <section className="card results" aria-labelledby="results-title">
    <div className="section-heading"><div><span className="eyebrow">PERFORMANCE CHECK</span><h2 id="results-title">性能与规范监测</h2></div><span className="pill muted">待分析</span></div>
    <div className="table-scroll"><table><thead><tr><th scope="col">指标 / 模型实际值</th><th scope="col">规范要求值</th><th scope="col">差距值</th></tr></thead><tbody>
      <tr><th scope="row">外墙传热系数 <span>未绑定模型</span></th><td>未选择已审核规则</td><td>待校核</td></tr>
      <tr><th scope="row">四向窗墙比 <span>未提取墙窗语义</span></th><td>待选择适用标准</td><td>待计算</td></tr>
      <tr><th scope="row">太阳辐射 <span>尚未计算</span></th><td>按分析目标评价</td><td>待计算</td></tr>
    </tbody></table></div>
    <p className="helper">缺少模型、气象或适用条款时不作合格判定。室内采光与完整能耗尚未接入。</p>
  </section>
}
