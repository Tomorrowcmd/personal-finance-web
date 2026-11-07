import { defineStore } from 'pinia'
import { ElMessageBox } from 'element-plus'

/** 确认框参数（与原有 API 一致） */
export interface ConfirmOptions {
  /** 标题 */
  title?: string
  /** 正文，支持 \n 换行 */
  message: string
  /** 确认按钮文案 */
  confirmText?: string
  /** 取消按钮文案 */
  cancelText?: string
  /** danger 使用红色确认按钮 */
  tone?: 'brand' | 'danger'
}

/**
 * 确认框（Element Plus 版）
 *
 * 对外仍是 `const ok = await confirm.ask({...})`，内部换成 ElMessageBox.confirm：
 * - 取消 / 关闭 / ESC 都会 reject，这里统一转成 false
 * - 确认返回 true
 */
export const useConfirmStore = defineStore('confirm', () => {
  /**
   * 打开确认框
   *
   * @returns 确认返回 true，取消返回 false
   */
  async function ask(options: ConfirmOptions): Promise<boolean> {
    try {
      await ElMessageBox.confirm(options.message, options.title ?? '确认操作', {
        confirmButtonText: options.confirmText ?? '确定',
        cancelButtonText: options.cancelText ?? '取消',
        type: options.tone === 'danger' ? 'warning' : 'info',
        // 危险操作给确认按钮加自定义 class（样式见 main.css）
        confirmButtonClass: options.tone === 'danger' ? 'app-confirm-danger' : undefined,
        closeOnClickModal: false,
        closeOnPressEscape: true,
        draggable: true,
      })
      return true
    } catch {
      return false
    }
  }

  /** 兼容旧 API（原 ConfirmHost 使用），现在无需手动结束 */
  function settle(): void {
    // no-op
  }

  return { ask, settle }
})
