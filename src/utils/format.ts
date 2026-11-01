import type { TransactionType } from '@/types'

/**
 * 金额与数字格式化工具
 *
 * 约定：
 * - 展示层统一走这里，避免各页面 toFixed(2) 写法不一；
 * - 需要精确计算时先转「分」（整数）再算，最后 fromCents 转回元；
 * - 所有函数对 NaN / Infinity 都做了兜底，不会把 "NaN" 渲染到页面上。
 */

/** 千分位 + 固定两位小数：1234.5 -> 1,234.50 */
const amountFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 纯数字格式化（不带货币符号），非法值按 0 处理 */
export function formatAmount(value: number): string {
  return amountFormatter.format(Number.isFinite(value) ? value : 0)
}

/** 带货币符号：1234.5 -> ¥1,234.50 */
export function formatCurrency(value: number): string {
  return `¥${formatAmount(value)}`
}

/**
 * 带方向符号的金额
 *
 * 收入显示 +，支出显示 -，用于流水列表（金额本身始终是正数）。
 */
export function formatSignedAmount(value: number, type: TransactionType): string {
  const sign = type === 'INCOME' ? '+' : '-'
  return `${sign}¥${formatAmount(Math.abs(value))}`
}

/**
 * 紧凑金额（卡片、坐标轴、中心标签用）
 *
 * 规则：≥1 亿显示「x亿」，≥1 万显示「x万」，否则原样输出整数；
 * 最多保留一位小数并去掉末尾的 0（1.0万 -> 1万）。
 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_0000_0000) return `${trimZero(value / 1_0000_0000)}亿`
  if (abs >= 10_000) return `${trimZero(value / 10_000)}万`
  return trimZero(value, 0)
}

/** 数字转字符串并去掉多余的 0（1.50 -> 1.5，2.00 -> 2） */
function trimZero(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString()
}

/**
 * 百分比格式化
 *
 * 12.345 -> "12.3%"，整数时省略小数（80.0% -> 80%）。
 */
export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0%'
  const fixed = value.toFixed(digits)
  return `${fixed.replace(/\.0+$/, '')}%`
}

/**
 * 元 -> 分（整数）
 *
 * 用于累加求和：0.1 + 0.2 在浮点里等于 0.30000000000000004，
 * 转成 10 + 20 = 30 分再除回 100 才是准确的 0.3。
 */
export function toCents(value: number): number {
  return Math.round(value * 100)
}

/** 分 -> 元 */
export function fromCents(cents: number): number {
  return cents / 100
}

/** 四舍五入到两位小数（提交给后端前规整金额） */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** 金额是否合法：有限数字、> 0、且不超过 99,999,999.99（与后端校验一致） */
export function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 99_999_999.99
}

/** 把数值限制在 [min, max] 区间内（进度条、百分比等处使用） */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
