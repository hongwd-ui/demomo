# 智碳首个可验证闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 默认由主执行者逐项实施；未经用户要求不扩展为并行代理开发。

**Goal:** 交付可测试的多层构造面板、版本化宿主桥接，以及 SketchUp 导出到直射预览的第一条闭环。

**Architecture:** React 界面通过固定桥接契约与 Ruby 交互，浏览器演示使用明确标记的适配器。Ruby 导出局部 ENU 场景，独立 C++ 服务计算直射预览；真实 EPW 和 Radiance 接入分别通过独立验收。

**Tech Stack:** 当前 React/TypeScript/Vite、Vitest、Ruby API、C++17/CMake/CTest；后续 Radiance。

**Spec:** [MVP 设计](../specs/2026-10-25-zhitan-mvp-design.md)；[协议](../../architecture/zhitan-protocol-v1.md)。

## Global Constraints

- 首发 Windows，目标 SketchUp 2024–2026，并兼容 2021。
- 当前云端为 Linux，可做界面、协议、解析器和算法测试；不能替代 Windows SketchUp 验证。
- 结果必须区分 W/m²、kWh/m²、lux、W/(m²·K)，不得由辐射直接推导表面温度或建筑节能率。
- Observers 只记录变化，在安全时机合并。
- 只有依据明确的 fail 标红；缺输入不得显示通过。
- 初期不改仓库目录为 monorepo；保留根目录前端，增加 sketchup/、engine/、docs/。
- 不将示例阈值、合成气象或未运行算法表述为真实工程计算。
- 本文测试和命令是待执行计划，勾选前不得宣称通过。

## Review Focus

1. 空字符串、零厚度、NaN 和波段不一致的材质输入必须被拒绝（任务 1）。
2. 旧 revision、取消与完成竞态不得覆盖当前结果（任务 2）。
3. 无宿主浏览器环境必须明显显示演示，不制造已连接 SketchUp 的状态（任务 3）。
4. 镜像及共享组件实例必须保持正确法线、面积和独立身份（任务 4）。
5. 没有太阳或被完全遮挡时结果不得出现负值和假热力（任务 5）。

## Task 1: 构造模型与计算

**Files:** Create `src/domain/construction.ts`, `src/domain/construction.test.ts`; modify `package.json`、`package-lock.json`。

**Interfaces:** Produces `validateConstruction(input: unknown): ValidationResult` 和 `calculateUValue(input: OpaqueConstruction): number`。
`ValidationResult = {ok:true,value:OpaqueConstruction}|{ok:false,errors:FieldError[]}`；类型与字段遵循协议。

- [ ] 添加 Vitest 及 `test: "vitest run"`，保持锁文件更新可复现。
- [ ] 写失败测试：0.2 m、λ=1、Rsi=0.1、Rse=0.05 得到 U≈2.857142857；两层顺序不影响稳态 U。
- [ ] 写失败测试：空值、厚度≤0、λ≤0、Infinity 被拒绝；太阳 α=.8、ρ=.4、τ=0 被拒绝。
- [ ] 执行 `npm test -- src/domain/construction.test.ts`，确认因缺实现失败。
- [ ] 定义精确类型和上述接口，仅支持 `opaque_series`；不静默把不支持构造转为串联。
- [ ] 执行同一测试并确认通过；运行 `npm run build` 和 `npm run lint`。
- [ ] 提交：`feat: add validated multilayer construction model`。

## Task 2: 宿主协议与任务状态

**Files:** Create `src/bridge/protocol.ts`, `src/bridge/host.ts`, `src/bridge/jobs.ts` 及同名 `.test.ts`。

**Interfaces:** Consumes 任务 1 类型；produces `createHostBridge(): HostBridge`，
`HostBridge.request(type: RequestType, payload: unknown): Promise<Envelope>`、`dispose(): void`；
`acceptResult(current: SceneIdentity, activeJobId: string, result: ResultEnvelope): boolean`。
`SceneIdentity={model_id:string,scene_revision:number}`；其余字段使用协议原名。

- [ ] 写失败测试：错误协议版本、非法消息、超过 1 MiB 输入被拒绝。
- [ ] 写失败测试：同 revision 不同 job、旧 revision 和取消任务结果不可接受；正确任务可接受。
- [ ] 写失败测试：带引号和脚本标签的字符串作为数据往返，不执行；超时与 dispose 后清理 pending 请求。
- [ ] 执行 `npm test -- src/bridge` 并确认因缺实现失败。
- [ ] 实现固定入口消息分派；默认请求超时 10 秒，长计算以 job 事件完成，不占用长请求。
- [ ] 执行同一测试并确认通过；运行构建、lint。
- [ ] 提交：`feat: add versioned SketchUp bridge and job state`。

## Task 3: 材质编辑与结果面板

**Files:** Modify `src/App.tsx`, `src/App.css`, `src/index.css`；create
`src/features/materials/ConstructionEditor.tsx`, `src/features/results/ResultPanel.tsx`,
`src/bridge/demo.ts`, `src/features/materials/ConstructionEditor.test.tsx`。
按实际测试需要加入 Testing Library 与 DOM 测试环境，不引入重型图形引擎。

**Interfaces:** Consumes 任务 1、2；`ConstructionEditor({value,onSave})` 的 value 为 `OpaqueConstruction`，
`onSave(value:OpaqueConstruction):Promise<void>`；`ResultPanel` 接收类型化结果和规则状态。

- [ ] 写失败测试：新增/删除/修改层后 U 值正确；非法输入显示字段错误且禁止保存。
- [ ] 写失败测试：无 window.sketchup 时显示“演示模式，未连接 SketchUp”；没有计算时不显示虚构合格结论。
- [ ] 执行 `npm test -- src/features/materials/ConstructionEditor.test.tsx` 并确认失败。
- [ ] 实现三列布局、层剖面示意、单位标签、未计算/过期/失败状态；UI 不展示假进度与假精算结果。
- [ ] 执行同一测试、构建、lint；人工检查窄面板和键盘操作。
- [ ] 提交：`feat: add Zhitan construction editor and analysis panel`。

## Task 4: SketchUp 适配与场景导出

**Files:** Create `sketchup/zhitan.rb`, `sketchup/zhitan/main.rb`,
`sketchup/zhitan/exporter.rb`, `sketchup/zhitan/observers.rb`,
`sketchup/test/export_contract_test.rb`, `docs/validation/sketchup-matrix.md`。

**Interfaces:** Consumes 协议；produces `Zhitan::Exporter.export(model, selection_only: false) -> Hash`，
`Zhitan::Observers.attach(model)`、`detach(model)`。输出符合 scene v1。

- [ ] 在有 SketchUp 的 Windows 机写失败契约测试：1 m 立方体总面积 6 m²；镜像不反转外法线；两个实例 ID 不同。
- [ ] 增加嵌套、非均匀缩放、材质继承、翻面、撤销重做和模型切换测试；确认缺实现时失败。
- [ ] 实现 Ruby 加载器、HtmlDialog 桥接、米制 ENU 导出；Observers 采用 500 ms 合并且可 detach。
- [ ] 分别在 SketchUp 2021、2024、2025、2026 运行并记录实际版本和输出；未运行的格子保持“未验证”。
- [ ] 提交：`feat: add SketchUp scene exporter and change tracking`。

## Task 5: 独立直射预览服务

**Files:** Create `engine/CMakeLists.txt`, `engine/src/main.cpp`, `engine/src/direct_preview.cpp`,
`engine/include/zhitan/direct_preview.hpp`, `engine/tests/direct_preview_test.cpp`。

**Interfaces:** Consumes 场景 v1；produces `compute_direct(const Scene&, const SunInput&) -> PreviewResult`。
`SunInput` 为 ENU 单位太阳向量和非负 DNI；初版调用方显式提供，禁止伪造 EPW 来源。
结果 quality 固定 `direct_preview`，单位 `W_m2`。

- [ ] 配置 CMake/CTest，固定并审核必要依赖版本及校验；工具安装只走验证有效的来源。
- [ ] 写失败测试：DNI=800，正对太阳的无挡面=800，背面=0，完全遮挡=0；太阳地平线以下=0。
- [ ] 写失败测试：反向三角形与退化面报诊断；非法路径和取消任务不写有效结果。
- [ ] 执行 CTest 确认缺实现失败。
- [ ] 实现 CPU 射线遮挡、NDJSON 消息、取消和结果文件；性能库在基准证明需要后引入。
- [ ] 运行 `cmake -S engine -B /tmp/zhitan-build`、`cmake --build /tmp/zhitan-build`、`ctest --test-dir /tmp/zhitan-build --output-on-failure`。
- [ ] 将任务 4 场景导出接入服务，核对返回 revision；提交 `feat: add cancellable direct solar preview worker`。

## Task 6: 宿主热力图闭环

**Files:** Create `sketchup/zhitan/visualization.rb`, `sketchup/test/visualization_test.rb`,
`docs/validation/first-slice-results.md`；modify `sketchup/zhitan/main.rb`。

**Interfaces:** Consumes 任务 5 结果；produces `Zhitan::Visualization.show(model, result)`、`clear(model)`。

- [ ] 写失败验收：修改模型后旧结果拒绝；清理结果不修改用户原材质；结果组不被 exporter 再次导出。
- [ ] 验证新版本 Overlay 和 2021 降级路径；只启用已验证能力。
- [ ] 用固定模型执行导出→计算→显示；记录机器、三角形数、测点数、参数、耗时和异常。
- [ ] 在四版本执行撤销重做、关闭面板、切换模型、取消和工作进程崩溃测试。
- [ ] 将“仅直射，非完整太阳辐射/能耗”提示纳入截图和报告。
- [ ] 提交：`feat: visualize validated direct solar preview in SketchUp`。

## 后续独立计划与进入条件

1. EPW 与太阳位置：真实授权样本、时间约定和太阳基准检查后，替代任务 5 的显式 SunInput。
2. Radiance：固定二进制版本与许可，三场景独立比对后，开放 professional 结果。
3. 窗墙比与规则：先完成外边界/窗语义和专家审核规则包，随后开放合规结论。
4. 报告：上述版本、质量、来源和未校核项齐备后生成 PDF。
5. 室内采光、年度分析、EnergyPlus：各自单列规格和计划，不隐含在首个闭环内。

## 计划自检

- 材料、联动、结果显示与旧版本路径有明确任务；气象、精算、规范、报告明确为下一批计划。
- 类型和字段以协议为唯一命名来源；不混用 camelCase 与线上 snake_case。
- Review Focus 五类失败均映射到任务测试。
- Windows 实机、C++ 编译和 Radiance 基准尚未执行；不将文档完成等同于插件完成。

## 本次执行状态（2026-10-25）

任务 1–3 已实施并测试。任务 5 的独立服务与 CLI 已实施并通过 CTest。
任务 4/6 已有 Ruby 适配代码与可移植测试，但 Windows 实机验收未执行，保持待验收状态。
完整证据和独立审阅修复见 [验证记录](../../validation/first-slice-results.md)。
后续优先执行 [Windows 矩阵](../../validation/sketchup-matrix.md)，再接自动进程联动与真实 EPW。
原任务中没有实际执行的验收项不勾选，不把计划中的命令当作完成证据。
