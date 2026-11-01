import type {
  PageResult,
  Summary,
  Transaction,
  TransactionPayload,
  TransactionQuery,
} from '@/types'
import { saveBlob, parseFilename } from '@/utils/download'
import { todayISO } from '@/utils/date'

import { cleanParams, http } from './client'

/**
 * 流水接口
 *
 * 所有方法的参数/返回类型都来自 types/index.ts，
 * 这里只做「拼 URL + 取 data」，不做任何业务判断。
 */

/**
 * 导出接口的参数
 *
 * 与列表接口共用同一份筛选条件，但分页参数没有意义，这里剔除。
 */
function exportParams(query: TransactionQuery): Record<string, unknown> {
  const { page: _page, size: _size, ...rest } = query
  return cleanParams(rest)
}

export const transactionApi = {
  /**
   * 分页查询流水
   *
   * 空值参数会被 cleanParams 剔除（避免 ?type=&keyword=），
   * 后端据此按「不限」处理。
   */
  page(query: TransactionQuery): Promise<PageResult<Transaction>> {
    return http
      .get<PageResult<Transaction>>('/transactions', { params: cleanParams(query) })
      .then((res) => res.data)
  },

  /** 新增流水，返回后端生成完整字段后的记录 */
  create(payload: TransactionPayload): Promise<Transaction> {
    return http.post<Transaction>('/transactions', payload).then((res) => res.data)
  },

  /** 编辑流水（整体覆盖），返回更新后的记录 */
  update(id: number, payload: TransactionPayload): Promise<Transaction> {
    return http.put<Transaction>(`/transactions/${id}`, payload).then((res) => res.data)
  },

  /** 删除流水；不存在时后端返回 404，由页面统一提示 */
  remove(id: number): Promise<void> {
    return http.delete<void>(`/transactions/${id}`).then(() => undefined)
  },

  /**
   * 当前筛选条件下的收支合计
   *
   * 与列表接口共用筛选条件（忽略分页），用于明细页顶部汇总条。
   */
  summary(query: TransactionQuery): Promise<Summary> {
    return http
      .get<Summary>('/transactions/summary', { params: cleanParams(query) })
      .then((res) => res.data)
  },

  /**
   * 导出 Excel
   *
   * 后端返回 xlsx 二进制流（Apache POI 生成）+ Content-Disposition 文件名；
   * 前端不解码内容，直接触发浏览器下载，并返回文件名用于 toast 提示。
   *
   * 注意：mock 模式下这个接口返回的是 CSV（浏览器生成），
   * 接真实后端后自动变成 xlsx，调用方无需区分。
   */
  async exportExcel(query: TransactionQuery): Promise<string> {
    const response = await http.get<Blob>('/transactions/export', {
      params: exportParams(query),
      responseType: 'blob',
    })

    // 文件名优先取后端响应头，取不到就用「收支明细-今天.xlsx」兜底
    const disposition = response.headers['content-disposition'] as string | undefined
    const filename = parseFilename(disposition, `收支明细-${todayISO()}.xlsx`)
    saveBlob(response.data, filename)
    return filename
  },
}
