# demomo

基于 React、TypeScript 和 Vite 的最小前端项目。

## 开发环境

使用 Node.js 24 LTS 和 npm，依赖版本由 `package-lock.json` 锁定。
无需数据库、外部服务或密钥。

```sh
npm ci --cache /tmp/demomo-npm-cache --no-audit --no-fund
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

入口为 `src/App.tsx`，默认页面提供计数器示例和热更新。

## 验证与构建

```sh
npm run lint
npm run build
```

构建包括 TypeScript 检查，输出位于 `dist/`。
仓库暂未配置自动化测试套件。

## 预览生产构建

```sh
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
```
