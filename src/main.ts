import { createApp } from 'vue'
import { createPinia } from 'pinia'
import type { Plugin } from 'vue'
import {
  ElAlert,
  ElButton,
  ElCard,
  ElConfigProvider,
  ElDatePicker,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElIcon,
  ElInput,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElPagination,
  ElProgress,
  ElRadio,
  ElSelect,
  ElSkeleton,
  ElSkeletonItem,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from 'element-plus'

import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from './api/client'
import { useAuthStore } from './stores/auth'
import { useToastStore } from './stores/toast'

// 样式顺序很重要：normalize → Element Plus 基础样式 → 项目主题（覆盖 EP 变量）
import 'modern-normalize/modern-normalize.css'
import 'element-plus/dist/index.css'
import '@/assets/styles/main.css'

/**
 * 用到的 Element Plus 组件
 *
 * 只注册实际用到的组件，而不是 `app.use(ElementPlus)` 全量注册：
 * 前者能被打包器 tree-shake，产物体积约为后者的一半。
 * 新增 EP 组件时记得同时加到这里。
 */
const ELEMENT_COMPONENTS = [
  ElAlert,
  ElButton,
  ElCard,
  ElConfigProvider,
  ElDatePicker,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElIcon,
  ElInput,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElPagination,
  ElProgress,
  ElRadio,
  ElSelect,
  ElSkeleton,
  ElSkeletonItem,
  ElTable,
  ElTableColumn,
  ElTooltip,
] as unknown as Plugin[]

/**
 * 启动流程
 *
 * 1. 若开启模拟开关，先装上 mock 适配器（必须在任何请求发出前）
 * 2. 创建 pinia 与 router，按需注册 Element Plus 组件
 * 3. 注册「401 自动登出」与「全局异常兜底」
 * 4. 挂载应用
 */
async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { installMockApi } = await import('./mock')
    installMockApi()
  }

  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)
  for (const component of ELEMENT_COMPONENTS) {
    app.use(component)
  }

  // 会话失效（401）：清空本地登录态，带着当前地址回到登录页
  setUnauthorizedHandler(() => {
    const auth = useAuthStore(pinia)
    if (!auth.isAuthenticated) return

    const current = router.currentRoute.value
    const redirect = current.fullPath
    auth.logout()

    void router.replace({
      name: 'login',
      query: redirect && redirect !== '/login' ? { redirect } : {},
    })
  })

  /**
   * 全局错误兜底
   *
   * 组件渲染 / 生命周期里未捕获的异常，默认只在控制台打印，用户看到的是白屏或卡住。
   * 这里记录日志，并在生产环境给一条可读提示（开发环境保留控制台堆栈，不打扰调试）。
   */
  app.config.errorHandler = (error, _instance, info) => {
    console.error('[app error]', info, error)
    if (import.meta.env.PROD) {
      useToastStore(pinia).error('页面出现异常，请刷新后重试')
    }
  }

  app.mount('#app')
}

void bootstrap()
