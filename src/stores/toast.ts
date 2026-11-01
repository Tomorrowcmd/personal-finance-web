import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 提示类型：成功 / 失败 / 普通信息，决定图标与配色 */
export type ToastType = 'success' | 'error' | 'info'

/** 一条提示 */
export interface ToastItem {
  /** 自增 id，作为列表 key 与关闭时的定位依据 */
  id: number
  /** 类型 */
  type: ToastType
  /** 文案 */
  message: string
}

/** 模块级自增序列，保证多条提示 id 不重复 */
let sequence = 0

/**
 * 轻提示（Toast）
 *
 * 全局只有一个渲染容器（ToastHost），任何地方调用
 * useToastStore().success('已保存') 即可弹出；
 * 每条提示到时间自动消失，也可以手动点关闭。
 */
export const useToastStore = defineStore('toast', () => {
  /** 当前在屏的提示列表 */
  const items = ref<ToastItem[]>([])

  /**
   * 推入一条提示
   *
   * @param message  文案
   * @param type     类型，默认 info
   * @param duration 停留毫秒数，错误提示默认更久
   */
  function push(message: string, type: ToastType = 'info', duration = 3200): void {
    const id = (sequence += 1)
    items.value = [...items.value, { id, type, message }]
    window.setTimeout(() => dismiss(id), duration)
  }

  /** 移除指定提示（自动到时或用户点了关闭） */
  function dismiss(id: number): void {
    items.value = items.value.filter((item) => item.id !== id)
  }

  /** 成功提示：3.2 秒 */
  const success = (message: string) => push(message, 'success')
  /** 失败提示：停留 4.2 秒，给用户更多阅读时间 */
  const error = (message: string) => push(message, 'error', 4200)
  /** 普通信息 */
  const info = (message: string) => push(message, 'info')

  return { items, push, dismiss, success, error, info }
})
