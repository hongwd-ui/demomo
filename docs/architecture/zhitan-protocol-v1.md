# 智碳协议 v1（实施契约，尚未实现）

## 通道与安全

UI → Ruby：`window.sketchup.zhitan_request(JSON.stringify(request))`。
Ruby → UI：通过 JSON 序列化的数据调用固定入口 `window.ZhitanBridge.receive(envelope)`；
不得将用户字符串拼接成可执行脚本。浏览器演示适配器必须显示演示标识。

Ruby 与本地服务：子进程 stdin/stdout 使用每行一个 UTF-8 JSON 的 NDJSON；
stderr 输出脱敏诊断。首版不开放 HTTP 监听端口。
单消息最大 1 MiB；大型网格以任务目录下的文件传输。拒绝绝对路径、`..`、逃逸根目录的符号链接。
引擎命令使用固定可执行路径与参数数组，禁止拼接 shell 命令。

## 信封

```json
{
  "protocol_version": 1,
  "request_id": "uuid",
  "type": "analysis.start",
  "model_id": "uuid",
  "scene_revision": 7,
  "payload": {}
}
```

`request_id` 用于请求关联；每次分析的 `job_id` 由服务产生。
收到未知主版本返回 `UNSUPPORTED_PROTOCOL`；未知类型返回 `UNKNOWN_MESSAGE`。
错误响应包含 `code`、安全的 `message`、`retryable`；不得泄漏密钥和用户完整路径。
数值必须有限，拒绝 NaN/Infinity；错误数据不得自动改成零。

## 消息

| type | payload | 结果 |
|---|---|---|
| `host.capabilities` | `{}` | 宿主版本、可视化能力、引擎版本、可用算法 |
| `scene.export` | `selection_only: boolean` | 场景摘要、诊断、当前 revision |
| `construction.save` | `construction` | 经验证的构造及数据版本 |
| `weather.import` | `relative_path: string` | 元数据、质量诊断、内容哈希 |
| `analysis.start` | `scene_path, mode, weather_hash?, settings` | `job_id` |
| `analysis.cancel` | `job_id` | 取消确认；允许任务已完成 |
| `job.progress` | `job_id, progress: 0..1, stage` | 服务推送 |
| `job.result` | `job_id, result_path, quality` | 服务推送；核对模型及 revision 后接收 |
| `job.error` | `job_id, code, message, retryable` | 服务推送 |

`mode` 初期为 `direct_preview` 或 `radiance_solar`；不得把预留的采光模式显示为可用。

## 场景结构

- `schema_version: 1`、`model_id: string`、`scene_revision: integer >= 0`。
- `coordinate_system: "local_enu_m"`：局部东、北、上，单位米；大型坐标先平移到局部原点。
- `location: { latitude_deg, longitude_deg, elevation_m, utc_offset_minutes }`。
- `north_rotation_deg`：保留宿主到 ENU 的转换元数据；顶点已转换，禁止计算端再次旋转。
- `surfaces[]: { id, role, appearance_id?, construction_id?, triangles, normal }`。
- `triangles`：每个三角形为三个有限的 `[x,y,z]` 坐标；零面积三角形报诊断。
- `role`：`wall | roof | ground | window | shade | obstruction | unknown`。
- `constructions[]`、`diagnostics[]`；后续增加房间与测点不改变现有坐标口径。

初期正确性优先，三角形使用 JSON；体积超过限制后以经版本化的二进制格式替代，不能随意改变解析口径。

## 材料与构造

`Material`：`id, name, conductivity_w_mk?, density_kg_m3?, specific_heat_j_kgk?`。
可选光学参数：`solar_absorptance, solar_reflectance, solar_transmittance, visible_transmittance, refractive_index`。
参数带来源与适用条件；太阳参数不得由可见光参数默认复制。

`Layer`：`material_id, thickness_m`，厚度和导热系数必须大于零。
`Construction`：`id, name, kind, layers, rsi_m2k_w, rse_m2k_w, source`。
`kind` 初期 `opaque_series`；复杂构造使用 `unsupported`，不能错误计算。
Rsi/Rse 要求显式输入并记录来源，不设置无依据的全国统一默认值。

光学比例范围 0..1；同条件、同波段三项齐备时检查 α+ρ+τ≈1，容差 0.01。
折射率为正数；其存在不表示所有求解器都会使用。

## 结果与一致性

结果包含 `schema_version, model_id, scene_revision, job_id, engine_version, settings_hash,
weather_hash?, material_hash, created_at, quality, metric, unit, samples, diagnostics`。
`quality`：`synthetic_demo | direct_preview | professional`。
`metric` 与单位配对：`incident_irradiance/W_m2`、`absorbed_irradiance/W_m2`、
`cumulative_irradiation/kWh_m2`、`illuminance/lux`；当前实现未支持的组合必须拒绝。
每个 sample 保存 `surface_id, position_m, value`；不得只输出一张不可追溯图片。
结果含非有限数、错误 revision、取消任务或哈希不匹配时，不可发布为当前有效结果。

任务状态：`queued → running → completed | failed | cancelled`；过期是客户端结果属性。
进度单调不减；取消请求与完成事件竞态时，前端以当前 revision 和任务身份决定接收，不能串结果。
