/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 应用标题 */
  readonly VITE_APP_TITLE: string
  /** 接口基础路径，如 /api */
  readonly VITE_API_BASE_URL: string
  /** 是否启用本地模拟数据：'true' | 'false' */
  readonly VITE_USE_MOCK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
