/**
 * 请求竞态守卫
 *
 * 场景：用户快速切换筛选条件/月份时，会连续发多个请求。
 * 若旧请求比新请求晚返回（网络抖动、mock 随机延迟），
 * 旧数据会覆盖新数据，页面显示的内容与筛选条件不一致。
 *
 * 用法：
 * ```ts
 * const latest = useLatestRequest()
 * async function load() {
 *   const id = latest.next()
 *   const data = await api()
 *   if (!latest.isLatest(id)) return   // 已有更新的请求，丢弃本次结果
 *   list.value = data
 * }
 * ```
 */
export function useLatestRequest() {
  /** 单调递增的请求序号 */
  let sequence = 0

  /** 发起新请求前调用，拿到本次的序号 */
  function next(): number {
    sequence += 1
    return sequence
  }

  /** 判断本次请求是否仍是最新的一次（否则应丢弃结果） */
  function isLatest(id: number): boolean {
    return id === sequence
  }

  return { next, isLatest }
}
