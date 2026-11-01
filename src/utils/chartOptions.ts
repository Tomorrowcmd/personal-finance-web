import type { EChartsOption } from 'echarts'

import type { ThemeMode } from '@/stores/ui'
import type { CategoryStat, MonthlyPoint } from '@/types'

import { getChartPalette, withAlpha } from './chartTheme'
import { monthShortLabel } from './date'
import { formatCompact, formatCurrency } from './format'

/**
 * 图表配置生成器
 *
 * 所有 ECharts option 集中在这里，页面只负责把接口数据传进来，
 * 这样坐标轴、网格、提示框、配色在 4 个图表之间保持一致。
 *
 * 统一约定：
 * - 每个函数都接收 theme（light/dark），主题切换时由页面 computed 重新生成配置；
 * - 颜色一律取自 chartTheme 的调色板，与 CSS 设计令牌对齐；
 * - 金额展示统一走 formatCurrency / formatCompact，避免各图格式不一；
 * - 不在 option 里写死像素颜色，深浅主题才能正确切换。
 */

/**
 * 近 N 个月「支出柱状 + 收入折线」组合图
 *
 * 设计意图：
 * - 支出用柱状突出「花多花少」，收入用折线+渐变面积表达趋势；
 * - 两者共用一条 y 轴，便于直观比较收支规模；
 * - 坐标轴标签只显示「x月」，完整年月放在 tooltip 里。
 *
 * @param points 按月份升序排列的收支序列（后端已零填充，长度即月份数）
 * @param theme  当前主题，决定文字/网格线/系列颜色
 */
export function buildTrendOption(points: MonthlyPoint[], theme: ThemeMode): EChartsOption {
  const palette = getChartPalette(theme)

  return {
    // 图表切换月份时会重建 option，动画让数据变化更平滑
    animationDuration: 520,
    // containLabel 保证坐标轴文字不被裁掉；top 留白给折线顶点
    grid: { top: 18, right: 6, bottom: 2, left: 2, containLabel: true },
    tooltip: {
      // axis 模式：悬停整列时同时展示支出与收入
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: palette.tooltipText, fontSize: 12 },
      axisPointer: {
        // 背景阴影跟随柱子，形成「当前列」的视觉高亮
        type: 'shadow',
        shadowStyle: { color: withAlpha(palette.brand, 0.06) },
      },
      // 原始值是数字，这里统一格式化成 ¥1,234.56
      valueFormatter: (value) => formatCurrency(Number(value)),
    },
    xAxis: {
      type: 'category',
      // '2026-10' -> '10月'，横轴只保留月份，避免拥挤
      data: points.map((point) => monthShortLabel(point.month)),
      axisLine: { lineStyle: { color: palette.axis } },
      axisTick: { show: false },
      axisLabel: { color: palette.subText, fontSize: 11.5, margin: 12 },
    },
    yAxis: {
      type: 'value',
      // 固定 4 段，配合格式化后的「1.5万」这类标签更整齐
      splitNumber: 4,
      axisLabel: {
        color: palette.subText,
        fontSize: 11,
        // 大金额显示为 1.2万，小金额保留原值
        formatter: (value: number) => formatCompact(value),
      },
      splitLine: { lineStyle: { color: palette.split, type: [4, 4] } },
    },
    series: [
      {
        name: '支出',
        type: 'bar',
        data: points.map((point) => point.expense),
        barWidth: '38%',
        itemStyle: {
          // 只圆角顶部，底部贴住坐标轴
          borderRadius: [7, 7, 3, 3],
          // 自上而下的渐变，让柱体更轻，不抢折线的视觉重心
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: palette.expense },
              { offset: 1, color: withAlpha(palette.expense, 0.55) },
            ],
          },
        },
        emphasis: { itemStyle: { color: palette.expense } },
      },
      {
        name: '收入',
        type: 'line',
        data: points.map((point) => point.income),
        // 轻微平滑，避免月度波动被画成生硬的折角
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 7,
        showSymbol: true,
        lineStyle: { width: 2.4, color: palette.income },
        // 描边用卡片底色，圆点在柱子上也能清晰分离
        itemStyle: { color: palette.income, borderWidth: 2, borderColor: palette.surface },
        // 面积渐变从 22% 透明度淡出到 0，强调趋势但不遮挡柱子
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(palette.income, 0.22) },
              { offset: 1, color: withAlpha(palette.income, 0) },
            ],
          },
        },
      },
    ],
  }
}

/**
 * 分类占比环形图
 *
 * 设计意图：
 * - 环心中间由页面用 DOM 叠一个「总支出」，所以不画 ECharts 的 label；
 * - 分类名称与占比放在卡片右侧的自定义图例里，比挤在扇区上更易读；
 * - 每块扇区之间留 2.5px 卡片底色描边，形成分隔感。
 *
 * @param stats 分类统计，已按金额降序（颜色来自分类本身，保证跨页面一致）
 * @param theme 当前主题
 */
export function buildCategoryDonutOption(stats: CategoryStat[], theme: ThemeMode): EChartsOption {
  const palette = getChartPalette(theme)

  return {
    animationDuration: 520,
    tooltip: {
      trigger: 'item',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: palette.tooltipText, fontSize: 12 },
      formatter: '{b}<br/>{c}（{d}%）',
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderColor: palette.surface,
          borderWidth: 2.5,
          borderRadius: 4,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 5,
          itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0, 0, 0, 0.12)' },
        },
        // 扇区颜色直接取分类自身的 color，不做调色板映射，
        // 这样同一个分类在环形图、排行图、列表里颜色始终一致
        data: stats.map((item) => ({
          name: item.name,
          value: item.amount,
          itemStyle: { color: item.color },
        })),
      },
    ],
  }
}

/**
 * 分类排行横向条形图
 *
 * 设计意图：
 * - 横向排列更适合中文分类名，不需要旋转坐标轴文字；
 * - 每根柱子使用分类自己的颜色，和环形图、列表小圆点保持同一套色；
 * - 数值用 formatCompact 标在柱子右侧（如 1.9万），省去读刻度。
 *
 * @param stats 分类统计，按金额降序
 * @param theme 当前主题
 */
export function buildCategoryRankingOption(stats: CategoryStat[], theme: ThemeMode): EChartsOption {
  const palette = getChartPalette(theme)
  // 条形图从下往上画，反转后视觉上金额最大的在顶部
  const ordered = [...stats].reverse()

  return {
    animationDuration: 480,
    grid: { top: 4, right: 56, bottom: 4, left: 4, containLabel: true },
    tooltip: {
      trigger: 'item',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: palette.tooltipText, fontSize: 12 },
      valueFormatter: (value) => formatCurrency(Number(value)),
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: ordered.map((item) => `${item.icon} ${item.name}`),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.text, fontSize: 12.5, margin: 12 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 13,
        data: ordered.map((item) => ({
          value: item.amount,
          itemStyle: {
            color: item.color,
            borderRadius: [0, 7, 7, 0],
          },
        })),
        label: {
          show: true,
          position: 'right',
          distance: 8,
          color: palette.subText,
          fontSize: 11.5,
          formatter: (params) => formatCompact(Number(params.value)),
        },
      },
    ],
  }
}

/**
 * 每月结余柱状图（收入 - 支出，正负分色）
 *
 * 设计意图：
 * - 正结余用收入色、负结余用支出色，柱体圆角方向也跟着翻转；
 * - 只画柱子不画折线，因为它和趋势图里的收入线含义不同（这里是差值）；
 * - 金额在 JS 侧先按「分」四舍五入再除回，避免浮点误差画出 -0.00。
 *
 * @param points 月度收支序列
 * @param theme  当前主题
 */
export function buildBalanceOption(points: MonthlyPoint[], theme: ThemeMode): EChartsOption {
  const palette = getChartPalette(theme)

  return {
    animationDuration: 520,
    grid: { top: 20, right: 6, bottom: 2, left: 2, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: palette.tooltipText, fontSize: 12 },
      axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(palette.brand, 0.06) } },
      valueFormatter: (value) => formatCurrency(Number(value)),
    },
    xAxis: {
      type: 'category',
      data: points.map((point) => monthShortLabel(point.month)),
      axisLine: { lineStyle: { color: palette.axis } },
      axisTick: { show: false },
      axisLabel: { color: palette.subText, fontSize: 11.5, margin: 12 },
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      axisLabel: {
        color: palette.subText,
        fontSize: 11,
        formatter: (value: number) => formatCompact(value),
      },
      splitLine: { lineStyle: { color: palette.split, type: [4, 4] } },
    },
    series: [
      {
        name: '结余',
        type: 'bar',
        barWidth: '42%',
        data: points.map((point) => {
          // 先乘 100 取整再除回，规避 0.1 + 0.2 这类浮点尾数导致的 -0.00
          const balance = Math.round((point.income - point.expense) * 100) / 100
          return {
            value: balance,
            itemStyle: {
              // 正数绿色、负数红色；圆角方向随正负切换（向上/向下生长）
              color: balance >= 0 ? palette.income : palette.expense,
              borderRadius: balance >= 0 ? [7, 7, 0, 0] : [0, 0, 7, 7],
              opacity: 0.9,
            },
          }
        }),
      },
    ],
  }
}
