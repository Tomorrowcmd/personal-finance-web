import type { ThemeMode } from '@/stores/ui'

/**
 * 图表调色板
 *
 * ECharts 用 canvas 渲染，读不到 CSS 的 var()，
 * 所以这里按主题硬编码一份颜色，取值与 main.css 的设计令牌保持一致：
 * 改主题色时，两处都要同步改。
 */

/** 一套主题下图表用到的全部颜色 */
export interface ChartPalette {
  /** 主要文字（坐标轴标题、分类名） */
  text: string
  /** 次要文字（刻度、单位） */
  subText: string
  /** 坐标轴线颜色 */
  axis: string
  /** 网格分割线颜色 */
  split: string
  /** tooltip 背景 */
  tooltipBg: string
  /** tooltip 边框 */
  tooltipBorder: string
  /** tooltip 文字 */
  tooltipText: string
  /** 收入色（绿） */
  income: string
  /** 支出色（红） */
  expense: string
  /** 品牌色（高亮、阴影） */
  brand: string
  /** 卡片底色：扇区之间用它描边形成分隔 */
  surface: string
}

/** 浅色主题 */
const LIGHT: ChartPalette = {
  text: '#141a22',
  subText: '#8b95a5',
  axis: '#e6e9ef',
  split: '#eef1f5',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e6e9ef',
  tooltipText: '#141a22',
  income: '#0f7a63',
  expense: '#cf5140',
  brand: '#0f7a63',
  surface: '#ffffff',
}

/** 深色主题（颜色整体提亮，保证在深底上有足够对比度） */
const DARK: ChartPalette = {
  text: '#e9edf3',
  subText: '#78828f',
  axis: '#2b3542',
  split: '#1f2733',
  tooltipBg: '#1b222c',
  tooltipBorder: '#2b3542',
  tooltipText: '#e9edf3',
  income: '#35a888',
  expense: '#e87a62',
  brand: '#35a888',
  surface: '#161b23',
}

/** 按主题取调色板（页面在 computed 里调用，主题切换后自动重算） */
export function getChartPalette(theme: ThemeMode): ChartPalette {
  return theme === 'dark' ? DARK : LIGHT
}

/**
 * 给十六进制颜色加透明度
 *
 * 图表里的渐变、柱状阴影需要 rgba 形式（ECharts 不识别 8 位 hex）。
 * 同时支持 #RGB 与 #RRGGBB 两种写法。
 *
 * @param hex   颜色值，如 '#0f7a63'
 * @param alpha 透明度 0-1
 */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  // #abc -> #aabbcc
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
