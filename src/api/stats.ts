import type { CategoryStat, MonthlyPoint, TransactionType } from '@/types'
import { currentMonth } from '@/utils/date'

import { cleanParams, http } from './client'

/**
 * 分类统计的查询条件
 *
 * 前端目前只用支出类型（type 固定传 EXPENSE），
 * 保留 type 字段是为了将来支持「收入构成」。
 */
export interface CategoryStatQuery {
  /** 起始日期（含）yyyy-MM-dd */
  startDate: string
  /** 结束日期（含）yyyy-MM-dd */
  endDate: string
  /** 统计哪种类型：支出 / 收入 */
  type: TransactionType
}

/**
 * 统计接口
 *
 * 所有聚合（按月求和、按分类求和、算百分比）都由后端完成，
 * 前端只负责把结果画成图，避免前后端口径不一致。
 */
export const statsApi = {
  /**
   * 月度收支序列
   *
   * 后端保证返回连续月份并零填充（没有数据的月份也返回 0），
   * 这样趋势图的横轴不会出现断档。
   *
   * @param months   生成的月份数量（含 endMonth），前端最多用到 12
   * @param endMonth 结束月份 yyyy-MM，默认当前月
   */
  monthly(months = 6, endMonth: string = currentMonth()): Promise<MonthlyPoint[]> {
    return http
      .get<MonthlyPoint[]>('/stats/monthly', { params: { months, endMonth } })
      .then((res) => res.data)
  },

  /**
   * 分类占比
   *
   * 返回按金额降序排列的数组，percent 是占同类型总额的百分比；
   * 总额为 0 时返回空数组（前端显示空状态）。
   */
  categories(query: CategoryStatQuery): Promise<CategoryStat[]> {
    return http
      .get<CategoryStat[]>('/stats/categories', { params: cleanParams(query) })
      .then((res) => res.data)
  },
}
