/**
 * 日期工具
 *
 * 全部基于「本地时间」构造 Date，不用 new Date('2026-10-26')：
 * 后者会按 UTC 解析，在东八区会变成前一天。
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const pad = (n: number): string => String(n).padStart(2, '0')

/** Date -> yyyy-MM-dd */

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** yyyy-MM-dd -> Date（本地零点） */

export function parseISODate(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** 今天的 yyyy-MM-dd */
export function todayISO(): string {
  return toISODate(new Date())
}

/** 当前月份 yyyy-MM */
export function currentMonth(): string {
  return todayISO().slice(0, 7)
}

/** 从日期串截取月份 yyyy-MM */
export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

/** 月份加减：('2026-01', -1) -> '2025-12' */
export function addMonths(month: string, delta: number): string {
  const [year = 1970, mon = 1] = month.split('-').map(Number)
  const date = new Date(year, mon - 1 + delta, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** 某月第一天 */
export function startOfMonth(month: string): string {
  return `${month}-01`
}

/** 某月最后一天（自动处理闰年、大小月） */
export function endOfMonth(month: string): string {
  const [year = 1970, mon = 1] = month.split('-').map(Number)
  const lastDay = new Date(year, mon, 0).getDate()
  return `${month}-${pad(lastDay)}`
}

/** 某月天数 */
export function daysInMonth(month: string): number {
  const [year = 1970, mon = 1] = month.split('-').map(Number)
  return new Date(year, mon, 0).getDate()
}

/** 生成从 from 到 to 的连续月份数组（含两端） */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = []
  let cursor = from
  // 防御：最多生成 60 个月，避免异常入参导致死循环
  for (let i = 0; i < 60 && cursor <= to; i += 1) {
    months.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return months
}

/** '2026-10' -> '2026年10月' */
export function monthLabel(month: string): string {
  const [year = 1970, mon = 1] = month.split('-').map(Number)
  return `${year}年${mon}月`
}

/** '2026-10' -> '10月'（图表坐标轴用） */
export function monthShortLabel(month: string): string {
  const [, mon = 1] = month.split('-').map(Number)
  return `${mon}月`
}

/** '2026-10-26' -> '10月26日 周一' */
export function formatDateLabel(iso: string): string {
  const date = parseISODate(iso)
  const week = WEEKDAYS[date.getDay()] ?? ''
  return `${date.getMonth() + 1}月${date.getDate()}日 周${week}`
}

/** '2026-10-26' -> '10-26'（紧凑展示，用在窄屏或图表提示） */
export function formatShortDate(iso: string): string {
  return iso.slice(5)
}

/** 是否为今天 */
export function isToday(iso: string): boolean {
  return iso === todayISO()
}

/** 两个日期相差的天数（b - a） */
export function diffDays(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * 快捷时间区间的 key
 *
 * - thisMonth / lastMonth：自然月
 * - last30：含今天在内的最近 30 天（滚动窗口，不是自然月）
 * - thisYear：今年 1 月 1 日至今
 * - all：不限时间（空字符串，后端按「不传」处理）
 * - custom：使用页面上的自定义起止日期
 */
export type RangePresetKey = 'thisMonth' | 'lastMonth' | 'last30' | 'thisYear' | 'all' | 'custom'

/** 一个快捷区间的完整描述 */
export interface RangePreset {
  /** 区间标识，与筛选器状态对应 */
  key: RangePresetKey
  /** 展示文案，如「本月」 */
  label: string
  /** 实际生效的起止日期；空串表示该端不限制 */
  range: { startDate: string; endDate: string }
}

/**
 * 生成快捷日期区间
 *
 * 注意：
 * - 所有区间都基于「今天」实时计算，跨天/跨月后自动变化；
 * - `all` 返回空串，调用方拼查询参数时会被剔除；
 * - `custom` 只给出默认值（本月），真实值由页面上的两个日期输入决定。
 */
export function getRangePreset(key: RangePresetKey): RangePreset {
  const now = new Date()
  const thisMonth = currentMonth()

  switch (key) {
    case 'thisMonth':
      return {
        key,
        label: '本月',
        range: { startDate: startOfMonth(thisMonth), endDate: endOfMonth(thisMonth) },
      }
    case 'lastMonth': {
      const last = addMonths(thisMonth, -1)
      return {
        key,
        label: '上月',
        range: { startDate: startOfMonth(last), endDate: endOfMonth(last) },
      }
    }
    case 'last30': {
      const start = new Date(now)
      start.setDate(start.getDate() - 29)
      return {
        key,
        label: '近30天',
        range: { startDate: toISODate(start), endDate: todayISO() },
      }
    }
    case 'thisYear':
      return {
        key,
        label: '今年',
        range: { startDate: `${now.getFullYear()}-01-01`, endDate: todayISO() },
      }
    case 'all':
      return { key, label: '全部', range: { startDate: '', endDate: '' } }
    default:
      return {
        key: 'custom',
        label: '自定义',
        range: { startDate: startOfMonth(thisMonth), endDate: endOfMonth(thisMonth) },
      }
  }
}
