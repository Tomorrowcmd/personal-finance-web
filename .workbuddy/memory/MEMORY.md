# 个人财务管家 · 项目长期笔记

## 协作约定（重要）
- **用户明确要求：本仓库前端代码禁止编辑/修改，除非先获得同意。** 默认只读；以对话方式讲解代码。
- 用户是学习者视角，讲代码时说明「为什么这么写」比贴大段实现更有用。

## 技术栈
Vue 3.5 + TypeScript + Vite 8 + Pinia + Vue Router 5 + ECharts 6 + Axios；无 UI 组件库，样式靠 CSS 设计令牌自建，支持深/浅主题。
后端（另行仓库）：Java 21 + Spring Boot 4 + PostgreSQL，端口 9081，context-path `/api`。

## 架构要点
- 分层：`views` → `stores`(Pinia) → `api`(axios) → mock 适配器 或 Spring Boot。
- `api/client.ts`：统一 baseURL `/api`、自动 Bearer Token、错误收敛为 `ApiError`、401 走 `setUnauthorizedHandler`（在 main.ts 注册，避免 store/router 循环依赖）。
- 数据刷新：`stores/sync.ts` 的 `version` 自增，页面 `watch([..., () => sync.version], load)` 重新拉取。
- 模板必须用 `{ immediate: true }`：不加的话 watcher 不会在挂载时执行，首次进入页面不加载数据。
- 竞态处理：`composables/useLatestRequest.ts` 用序号丢弃过期响应。
- 金额：接口用「元」，前端累加转「分」（`utils/format.ts` 的 toCents/fromCents）避免浮点误差。
- 路由守卫在 `router/index.ts`：除 `/login` 全部要求登录，带 `?redirect` 回跳。
- `App.vue` 通过 `route.meta.layout === 'blank'` 决定是否渲染侧栏顶栏。

## 环境变量现状（易踩坑）
- `.env` 与 `.env.development` 当前都是 `VITE_USE_MOCK=false`，即默认连真实后端 9081；README 里写的「默认启用模拟数据」与现状不一致。
- 切换 mock 只需改 `VITE_USE_MOCK=true` 并重启 dev server。

## Git 状态
- 只有一个提交 `6f003a4 feat:记账软件前端工程`。
- 工作区有一处未提交改动：`DashboardView.vue` 加了一行注释说明 `immediate: true`。
