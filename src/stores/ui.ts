import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/** 主题模式：浅色 / 深色 */
export type ThemeMode = 'light' | 'dark'

/** localStorage 里保存主题偏好的 key */
const THEME_KEY = 'pf.theme'
/** localStorage 里保存侧边栏展开状态的 key */
const SIDEBAR_KEY = 'pf.sidebar'

/**
 * 读取初始主题
 *
 * 优先级：本地保存的用户选择 > 系统 prefers-color-scheme > 浅色。
 * 用可选链是因为个别环境（如老版本无头浏览器）没有 matchMedia。
 */
function readInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 读取侧边栏初始状态：默认展开 */
function readInitialSidebar(): boolean {
  return localStorage.getItem(SIDEBAR_KEY) === 'collapsed'
}

/**
 * 全局 UI 状态
 *
 * - theme：浅色/深色，切换时写 <html data-theme> 与 localStorage
 * - quickAddOpen：全局「记一笔」弹窗，顶栏按钮与空状态都能触发
 * - mobileNavOpen：移动端导航抽屉（当前布局用底部标签栏，保留该状态备用）
 */
export const useUiStore = defineStore('ui', () => {
  /** 当前主题 */
  const theme = ref<ThemeMode>(readInitialTheme())
  /** 「记一笔」弹窗是否打开（App.vue 里渲染这个弹窗） */
  const quickAddOpen = ref(false)
  /** 移动端导航抽屉开关 */
  const mobileNavOpen = ref(false)
  /** 侧边栏是否收起（桌面端） */
  const sidebarCollapsed = ref(readInitialSidebar())

  // 侧边栏状态持久化：刷新、重新登录后保持用户的选择
  watch(sidebarCollapsed, (value) => {
    localStorage.setItem(SIDEBAR_KEY, value ? 'collapsed' : 'expanded')
  })

  // 主题变化时同步三处：DOM 属性、本地存储、浏览器地址栏颜色
  // immediate: true 保证首屏渲染前就把 data-theme 应用上，避免闪白
  watch(
    theme,
    (value) => {
      document.documentElement.dataset.theme = value
      localStorage.setItem(THEME_KEY, value)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', value === 'dark' ? '#0d1117' : '#f2f4f7')
    },
    { immediate: true },
  )

  /** 在浅色/深色之间切换 */
  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  /** 打开「记一笔」弹窗（登录后任意页面可用） */
  function openQuickAdd(): void {
    quickAddOpen.value = true
  }

  /** 展开 / 收起侧边栏 */
  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    theme,
    quickAddOpen,
    mobileNavOpen,
    sidebarCollapsed,
    toggleTheme,
    openQuickAdd,
    toggleSidebar,
  }
})
