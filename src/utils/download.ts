/**
 * 文件下载工具
 *
 * 后端导出 Excel 时返回二进制流 + Content-Disposition，
 * 前端拿到 Blob 后用 <a download> 触发浏览器保存。
 */

/**
 * 触发浏览器下载
 *
 * 必须把 <a> 临时挂到 body 上再 click（部分浏览器对游离节点不触发）；
 * 用完立即移除节点，并延迟释放 object URL，防止下载还没开始就被回收。
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // 延迟释放，避免部分浏览器下载尚未开始就失效
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * 从 Content-Disposition 中解析文件名，兼容两种写法：
 *   attachment; filename="report.xlsx"
 *   attachment; filename*=UTF-8''%E6%94%B6%E6%94%AF.xlsx
 */
export function parseFilename(disposition: string | null | undefined, fallback: string): string {
  if (!disposition) return fallback

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      return fallback
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain?.[1] ?? fallback
}
