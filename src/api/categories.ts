import type { Category, CategoryPayload } from '@/types'

import { http } from './client'

/**
 * 分类接口
 *
 * 分类是全局字典，数量少、变化频率低，因此不分页，
 * 由 category store 缓存后共享给各页面。
 */
export const categoryApi = {
  /** 查询全部分类（支出 + 收入一次性返回，前端按 type 过滤） */
  list(): Promise<Category[]> {
    return http.get<Category[]>('/categories').then((res) => res.data)
  },

  /** 新建分类；同类型下重名时后端返回 409 */
  create(payload: CategoryPayload): Promise<Category> {
    return http.post<Category>('/categories', payload).then((res) => res.data)
  },

  /** 编辑分类；已被流水引用时不允许改 type（后端 409） */
  update(id: number, payload: CategoryPayload): Promise<Category> {
    return http.put<Category>(`/categories/${id}`, payload).then((res) => res.data)
  },

  /** 删除分类；若该分类下仍有流水，后端返回 409，页面需把提示透出 */
  remove(id: number): Promise<void> {
    return http.delete<void>(`/categories/${id}`).then(() => undefined)
  },
}
