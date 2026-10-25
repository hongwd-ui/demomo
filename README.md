# 智碳 · SketchUp 建筑性能分析

React 面板、Ruby 宿主适配器和独立 C++ 直射预览服务的开发版本。
目前可计算多层一维稳态构造 U 值，并在独立服务中计算不透明遮挡下的单时刻直射辐照度。
**尚未完成 SketchUp 实机验收、真实 EPW 气象接入、Radiance、专业采光、规范库或报告。**

## 前端开发

Node.js 24 LTS 与 npm；依赖由 package-lock.json 锁定。

```sh
npm ci --cache /tmp/demomo-npm-cache --no-audit --no-fund
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
npm test
npm run lint
npm run build
```

浏览器页面明确显示演示模式。材料厚度、导热系数和热阻参与真实 U 值计算；
保存仅存入该浏览器。示例材料与深圳坐标不是经过验证的工程输入。

## 浏览器测试

```sh
npm run package:sketchup
npm run test:browser
```

需要 Chromium；Linux 默认 `/usr/bin/chromium`，其他路径设置 `CHROMIUM_PATH`。
测试覆盖编辑、保存后恢复、非法输入、响应式布局和 RBZ 内面板资源加载。
测试内服务仅用于验证，不是 SketchUp HtmlDialog 的替代品。

## 构建独立直射预览服务

需要 C++17 编译器、CMake >=3.20、Git 和 Python 3。
首次 CMake 配置从 GitHub 获取固定提交的 nlohmann/json，保持 HTTPS 和 Git 校验。

```sh
cmake -S engine -B /tmp/zhitan-build -DCMAKE_BUILD_TYPE=Release
cmake --build /tmp/zhitan-build --parallel 2
ctest --test-dir /tmp/zhitan-build --output-on-failure
python3 scripts/run_direct_preview.py --worker /tmp/zhitan-build/zhitan_worker --scene examples/direct-preview/scene.json --sun 0 0 1 --dni 800
```

CLI 打印结果文件路径。合成例子预期：遮挡地面 0、暴露地面 800、遮阳表面 800 W/m²。
`--sun` 是局部东/北/上太阳方向，`--dni` 是显式输入，并非自动气象或太阳位置算法。
服务只做每三角形一个重心点、不透明遮挡、直射投影；不含散射、反射、玻璃透射或能耗。
当前朴素射线实现最多 10,000 个三角形，不承诺大模型实时性能。

Windows 用 Visual Studio C++ 工具链和 CMake 构建；多配置生成器需 `--config Release`，
可执行文件通常位于 `build/Release/zhitan_worker.exe`。Windows 构建仍待验证。

## 打包 Ruby 适配器

```sh
npm run package:sketchup
```

产物：`artifacts/zhitan-0.1.0.rbz`。包内是 Ruby 和相对资源路径的经典 IIFE 面板，
不含 Windows 本地计算服务，也没有进行扩展签名或商用发布。

在测试 Windows 机器通过扩展管理器安装后，可从“扩展 → 智碳”打开面板、
导出场景 JSON、导入直射结果或清除显示。当前流程是人工导出/计算/导入，
**尚未实现服务自动启动或自动后台精算**。首次加载和四版本兼容尚待实机确认。

宿主保存的构造存在模型属性中；重新打开面板先读取模型数据，未读取成功前禁止保存。
当前构造保存不等于给面赋予构造；不声称已完成原生材质双向同步。
真北尚未确认时按模型 +Y 处理并产生诊断，不能据此给出真实深圳分析结论。

有 Ruby/Minitest 的机器可运行可移植测试：

```sh
ruby -I sketchup/test -e 'Dir.glob("./sketchup/test/*_test.rb").sort.each { |file| require_relative file }'
```

这些测试使用几何数据与宿主接口替身，不加载真实 SketchUp SDK，不证明宿主兼容。

## 设计与验收

- [MVP 设计](docs/superpowers/specs/2026-10-25-zhitan-mvp-design.md)
- [协议](docs/architecture/zhitan-protocol-v1.md)
- [实施计划](docs/superpowers/plans/2026-10-25-zhitan-first-slice.md)
- [本次验证与限制](docs/validation/first-slice-results.md)
- [Windows SketchUp 验收矩阵](docs/validation/sketchup-matrix.md)
