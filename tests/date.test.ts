import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addMonths,
  daysInMonth,
  endOfMonth,
  formatDateLabel,
  getRangePreset,
  monthRange,
  monthShortLabel,
  parseISODate,
  startOfMonth,
  toISODate,
} from '../src/utils/date.ts'

/**
 * 日期工具单测
 *
 * 重点覆盖：跨年加减月、大小月/闰年的月末、周一~周日文案、
 * 以及本地时间解析（不能用 UTC 解析导致偏移一天）。
 */

test('addMonths 跨年加减', () => {
  assert.equal(addMonths('2026-01', -1), '2025-12')
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-10', -12), '2025-10')
})

test('endOfMonth 处理大小月与闰年', () => {
  assert.equal(endOfMonth('2026-02'), '2026-02-28')
  assert.equal(endOfMonth('2024-02'), '2024-02-29')
  assert.equal(endOfMonth('2026-10'), '2026-10-31')
  assert.equal(endOfMonth('2026-04'), '2026-04-30')
})

test('startOfMonth / daysInMonth', () => {
  assert.equal(startOfMonth('2026-10'), '2026-10-01')
  assert.equal(daysInMonth('2026-10'), 31)
  assert.equal(daysInMonth('2024-02'), 29)
})

test('monthRange 含首尾且数量正确', () => {
  const months = monthRange('2025-11', '2026-02')
  assert.deepEqual(months, ['2025-11', '2025-12', '2026-01', '2026-02'])
})

test('monthShortLabel 只保留月份', () => {
  assert.equal(monthShortLabel('2026-10'), '10月')
  assert.equal(monthShortLabel('2026-01'), '1月')
})

test('formatDateLabel 星期几正确', () => {
  // 2026-10-26 是周一
  assert.equal(formatDateLabel('2026-10-26'), '10月26日 周一')
  // 2026-10-25 是周日
  assert.equal(formatDateLabel('2026-10-25'), '10月25日 周日')
})

test('parseISODate 按本地时间解析，不会偏移一天', () => {
  const date = parseISODate('2026-10-26')
  assert.equal(date.getFullYear(), 2026)
  assert.equal(date.getMonth(), 9) // 0-based
  assert.equal(date.getDate(), 26)
  assert.equal(toISODate(date), '2026-10-26')
})

test('getRangePreset 本月区间是自然月首尾', () => {
  const now = toISODate(new Date())
  const month = now.slice(0, 7)
  const preset = getRangePreset('thisMonth')
  assert.equal(preset.range.startDate, `${month}-01`)
  assert.equal(preset.range.endDate, endOfMonth(month))
})

test('getRangePreset 全部返回空区间（表示不过滤）', () => {
  const preset = getRangePreset('all')
  assert.equal(preset.range.startDate, '')
  assert.equal(preset.range.endDate, '')
})
