import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'

/**
 * 轻提示（Element Plus 版）
 *
 * 对外 API 与之前完全一致：toast.success('已保存') / toast.error(...) / toast.info(...)。
 * 内部从「自绘 Toast 列表」改为 ElMessage 命令式调用，视图代码零改动。
 *
 * 注意：ElMessage 自带队列与层级管理，多条同时出现会自动堆叠。
 */

/** 提示类型 */
export type ToastType = 'success' | 'error' | 'info'

export const useToastStore = defineStore('toast', () => {
  /**
   * 弹出一条提示
   *
   * @param message  文案
   * @param type     类型
   * @param duration 停留毫秒数
   */
  function push(message: string, type: ToastType = 'info', duration = 3200): void {
    ElMessage({
      message,
      type,
      duration,
      showClose: true,
      // 相同内容的多条提示合并，避免连续点击刷屏
      grouping: true,
    })
  }

  /** 兼容旧 API：ElMessage 自行管理关闭，这里保留空实现 */
  function dismiss(): void {
    // no-op
  }

  /** 成功提示 */
  const success = (message: string) => push(message, 'success')
  /** 失败提示：停留更久，便于阅读 */
  const error = (message: string) => push(message, 'error', 4200)
  /** 普通信息 */
  const info = (message: string) => push(message, 'info')

  return { push, dismiss, success, error, info }
})
