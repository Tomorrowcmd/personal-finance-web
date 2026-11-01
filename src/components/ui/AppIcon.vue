<script setup lang="ts">
import { computed } from 'vue'

/**
 * 图标组件
 *
 * 统一用 24x24 描边风格，避免为几个图标引入整个图标库。
 * 新增图标只需在 ICONS 里加一条 path。
 *
 * 注意：path 必须用 computed —— 主题切换（moon/sun）、密码可见（eye/eyeOff）
 * 这类场景会动态改 name，写成普通常量会导致图标停在首次渲染的那一个。
 */
const props = withDefaults(
  defineProps<{
    /** 图标名，必须是 ICONS 里的 key；找不到时回退到 dashboard */
    name: string
    /** 宽高（px） */
    size?: number
    /** 描边宽度，细图标可调小 */
    strokeWidth?: number
  }>(),
  {
    size: 18,
    strokeWidth: 1.8,
  },
)

/**
 * 图标路径表（24x24 viewBox，描边风格）
 *
 * 全部用绝对坐标的 path，保证同一套 stroke 参数下视觉重量一致；
 * 新增图标直接加一行即可，不需要改模板。
 */
const ICONS: Record<string, string> = {
  dashboard: 'M4 4h6v6H4zM14 4h6v4h-6zM14 11h6v9h-6zM4 13h6v7H4z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M3 21h18M7 21v-9M12 21V6M17 21v-6',
  wallet: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 12h4',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  sun: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  calendar:
    'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4',
  alert: 'M12 3l9 16H3zM12 9v5M12 17h.01',
  check: 'M20 6L9 17l-5-5',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  refresh: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  trend: 'M3 17l6-6 4 4 7-7M17 8h4v4',
  user: 'M12 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM3.5 21a8.5 8.5 0 0 1 17 0',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  eyeOff:
    'M3 3l18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c6.4 0 10 6 10 6a17.6 17.6 0 0 1-3.3 4M6.2 8.2A17 17 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4-.9',
  logout: 'M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6',
}

const path = computed(() => ICONS[props.name] ?? ICONS.dashboard ?? '')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="path" />
  </svg>
</template>
