import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { categoryApi } from '@/api/categories'
import { errorMessage } from '@/api/client'
import type { Category, CategoryPayload } from '@/types'

/**
 * 分类缓存
 *
 * 分类变化频率低，全局只拉一次并缓存在 store 里；
 * 页面里的下拉框、图例、分类表单都从这里取，避免每个页面重复请求。
 *
 * 刷新策略：
 * - 应用启动（登录后）加载一次；
 * - 新增 / 编辑 / 删除后调用 refresh() 强制重新拉取；
 * - 组件卸载不清理，跨页面共享。
 */
export const useCategoryStore = defineStore('category', () => {
  /** 全部分类（支出 + 收入），按接口返回顺序 */
  const items = ref<Category[]>([])
  /** 是否正在请求（首次加载时分类页显示骨架屏） */
  const loading = ref(false)
  /** 是否已经成功加载过，用于避免重复请求 */
  const loaded = ref(false)
  /** 加载失败的错误文案（页面可据此提示） */
  const error = ref('')

  /** 支出分类（预算、记账表单使用） */
  const expenseCategories = computed(() => items.value.filter((item) => item.type === 'EXPENSE'))
  /** 收入分类 */
  const incomeCategories = computed(() => items.value.filter((item) => item.type === 'INCOME'))

  /**
   * 加载分类
   *
   * @param force 为 true 时忽略缓存强制请求（增删改之后用）
   */
  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    error.value = ''
    try {
      items.value = await categoryApi.list()
      loaded.value = true
    } catch (err) {
      error.value = errorMessage(err)
    } finally {
      loading.value = false
    }
  }

  /** 强制重新拉取（增删改之后调用） */
  async function refresh(): Promise<void> {
    await load(true)
  }

  /** 按 id 查分类（判断「已选分类是否属于当前类型」时用） */
  function byId(id: number): Category | undefined {
    return items.value.find((item) => item.id === id)
  }

  /** 按类型取分类，表单切换收支类型时用 */
  function byType(type: Category['type']): Category[] {
    return type === 'EXPENSE' ? expenseCategories.value : incomeCategories.value
  }

  /**
   * 新建分类
   *
   * 先调接口，成功后刷新缓存并返回新建对象；
   * 失败（重名等）直接抛出，由表单展示错误。
   */
  async function create(payload: CategoryPayload): Promise<Category> {
    const created = await categoryApi.create(payload)
    await refresh()
    return created
  }

  /** 编辑分类（改名/换色后历史流水会读新值，因为后端是 join 查询） */
  async function update(id: number, payload: CategoryPayload): Promise<Category> {
    const updated = await categoryApi.update(id, payload)
    await refresh()
    return updated
  }

  /** 删除分类；被流水引用时后端返回 409，错误向上抛给页面提示 */
  async function remove(id: number): Promise<void> {
    await categoryApi.remove(id)
    await refresh()
  }

  return {
    items,
    loading,
    loaded,
    error,
    expenseCategories,
    incomeCategories,
    load,
    refresh,
    byId,
    byType,
    create,
    update,
    remove,
  }
})
