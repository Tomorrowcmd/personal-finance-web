import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 数据版本号
 *
 * 用途：跨页面通知「数据变了」。
 * - 写操作（新增/修改/删除流水、分类、预算）成功后调用 bump()；
 * - 各页面 `watch(() => sync.version, load)`，版本号 +1 就重新拉数据。
 *
 * 相比事件总线/层层 emit 的好处：
 * - 组件之间零耦合，新增页面只要 watch 一下就能自动刷新；
 * - 同一轮里多次 bump 也只会在下一个 tick 触发一次 watcher。
 */
export const useSyncStore = defineStore('sync', () => {
  /** 单调递增的版本号，本身没有业务含义，只作为变化信号 */
  const version = ref(0)

  /** 标记「数据已变更」，触发所有监听页面重新请求 */
  function bump(): void {
    version.value += 1
  }

  return { version, bump }
})
