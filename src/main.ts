import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from './api/client'
import { useAuthStore } from './stores/auth'
import { useToastStore } from './stores/toast'
import 'modern-normalize/modern-normalize.css'
import '@/assets/styles/main.css'

/**
 * 启动流程
 *
 * 1. 若开启模拟开关，先装上 mock 适配器（必须在任何请求发出前）
 * 2. 创建 pinia 与 router，注册「401 自动登出」与「全局异常兜底」
 * 3. 挂载应用
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
