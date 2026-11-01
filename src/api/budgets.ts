import type { Budget, BudgetPayload } from '@/types'

import { http } from './client'

/**
 * 预算接口
 *
 * 预算是「按月整体覆盖」的模型：
 * 一个月份一条总额 + 若干分类额度，保存时整份提交（PUT），
 * 不做单条增删改，避免前后端状态难以对齐。
 */
export const budgetApi = {
  /**
   * 查询某月预算
   *
   * @param month yyyy-MM（如 2026-10）
   * 未设置时后端返回 totalAmount = 0、items = []，
   * 但 totalSpent 仍会按当月实际支出计算。
   */
  get(month: string): Promise<Budget> {
    return http.get<Budget>(`/budgets/${month}`).then((res) => res.data)
  },

  /**
   * 整体覆盖保存某月预算（幂等，PUT 语义）
   *
   * 响应返回保存后的完整预算（含重新计算的 spent / totalSpent），
   * 前端保存成功后用 sync.bump() 触发页面重载即可。
   */
  save(month: string, payload: BudgetPayload): Promise<Budget> {
    return http.put<Budget>(`/budgets/${month}`, payload).then((res) => res.data)
  },
}
