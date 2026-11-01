import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  formatAmount,
  formatCompact,
  formatCurrency,
  formatPercent,
  formatSignedAmount,
  fromCents,
  isValidAmount,
  roundMoney,
  toCents,
} from '../src/utils/format.ts'

/**
 * 金额工具单测
 *
 * 重点覆盖：千分位、正负号、紧凑单位、百分比去零、分/元换算精度。
 * 运行：npm test（Node 内置测试器，无需额外依赖）
 */

test('formatAmount 固定两位小数并加千分位', () => {
  assert.equal(formatAmount(1234.5), '1,234.50')
  assert.equal(formatAmount(0), '0.00')
  assert.equal(formatAmount(Number.NaN), '0.00')
})

test('formatCurrency 带货币符号', () => {
  assert.equal(formatCurrency(1234.5), '¥1,234.50')
  assert.equal(formatCurrency(-20), '¥-20.00')
})

test('formatSignedAmount 支出为负、收入为正', () => {
  assert.equal(formatSignedAmount(128.5, 'EXPENSE'), '-¥128.50')
  assert.equal(formatSignedAmount(18500, 'INCOME'), '+¥18,500.00')
})

test('formatCompact 万/亿 与去尾零', () => {
  assert.equal(formatCompact(9999), '9999')
  assert.equal(formatCompact(12500), '1.3万')
  assert.equal(formatCompact(10000), '1万')
  assert.equal(formatCompact(125000000), '1.3亿')
})

test('formatPercent 去掉多余的 .0', () => {
  assert.equal(formatPercent(12.345), '12.3%')
  assert.equal(formatPercent(80), '80%')
  assert.equal(formatPercent(Number.NaN), '0%')
})

test('分与元换算不产生浮点误差', () => {
  // 0.1 + 0.2 直接相加是 0.30000000000000004
  assert.equal(toCents(0.1) + toCents(0.2), 30)
  assert.equal(fromCents(30), 0.3)
  assert.equal(roundMoney(0.1 + 0.2), 0.3)
})

test('isValidAmount 边界', () => {
  assert.equal(isValidAmount(0), false)
  assert.equal(isValidAmount(-1), false)
  assert.equal(isValidAmount(0.01), true)
  assert.equal(isValidAmount(99_999_999.99), true)
  assert.equal(isValidAmount(100_000_000), false)
  assert.equal(isValidAmount(Number.NaN), false)
})
