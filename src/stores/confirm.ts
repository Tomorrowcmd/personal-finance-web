import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 确认框参数 */
export interface ConfirmOptions {
  /** 标题，默认「确认操作」 */
  title?: string
  /** 正文（支持 \n 换行） */
  message: string
  /** 确认按钮文案，默认「确定」 */
  confirmText?: string
  /** 取消按钮文案，默认「取消」 */
  cancelText?: string
  /** danger 会使用红色确认按钮（删除、退出等） */
  tone?: 'brand' | 'danger'
}

/** 内部状态：选项全部有默认值，外加 open 标记 */
interface ConfirmState extends Required<ConfirmOptions> {
  open: boolean
}

/**
 * 确认框
 *
 * 把「弹窗状态 + Promise」封装成一行调用，页面不用自己维护 show 变量：
 *
 * ```ts
 * const ok = await confirm.ask({ message: '确定删除？', tone: 'danger' })
 * if (!ok) return
 * ```
 *
 * 同一时刻只支持一个确认框（后开的会覆盖前一个的 Promise），
 * 对当前交互足够；如果将来需要队列，可改成数组。
 */
export const useConfirmStore = defineStore('confirm', () => {
  /** 当前弹窗内容与显隐 */
  const state = ref<ConfirmState>({
    open: false,
    title: '确认操作',
    message: '',
    confirmText: '确定',
    cancelText: '取消',
    tone: 'brand',
  })

  /** 保存 Promise 的 resolve，等用户操作后回调 */
  let resolver: ((value: boolean) => void) | null = null

  /**
   * 打开确认框并等待用户选择
   *
   * @returns 确认返回 true，取消/关闭返回 false
   */
  function ask(options: ConfirmOptions): Promise<boolean> {
    state.value = {
      open: true,
      title: options.title ?? '确认操作',
      message: options.message,
      confirmText: options.confirmText ?? '确定',
      cancelText: options.cancelText ?? '取消',
      tone: options.tone ?? 'brand',
    }
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  /** 结束确认（确认按钮传 true，取消/Esc/关闭传 false） */
  function settle(value: boolean): void {
    state.value.open = false
    resolver?.(value)
    resolver = null
  }

  return { state, ask, settle }
})
