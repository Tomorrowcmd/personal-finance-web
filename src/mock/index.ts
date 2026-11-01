import { http } from '@/api/client'

import { createMockAdapter } from './adapter'

/**
 * 启用本地模拟接口
 *
 * 只在 VITE_USE_MOCK === 'true' 时被动态 import，
 * 生产构建里不会包含这段代码（Rollup 会把动态导入的独立 chunk 移除）。
 */
export function installMockApi(): void {
  http.defaults.adapter = createMockAdapter()
  console.info(
    '%c[mock] 已启用本地模拟数据',
    'color:#0f7a63;font-weight:600',
    '— 数据保存在 localStorage，设置 VITE_USE_MOCK=false 可切换到真实后端',
  )
}
