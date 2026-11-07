<script setup lang="ts">
import { computed } from 'vue'

/**
 * 进度条（Element Plus 封装）
 *
 * tone=auto 时按用量自动变色：<80% 品牌色，80~100% 橙色，≥100% 红色。
 * 颜色判断用原始值，宽度由 EP 自动夹取到 0-100。
 */
const props = withDefaults(
  defineProps<{
    /** 百分比，允许超过 100 表示超支 */
    value: number
    /** 颜色策略 */
    tone?: 'auto' | 'brand' | 'warn' | 'danger'
    /** 轨道高度 */
    height?: number
    /** 是否显示右侧百分比 */
    showLabel?: boolean
  }>(),
  {
    tone: 'auto',
    height: 8,
    showLabel: false,
  },
)

/** auto 模式下的颜色 */
const resolvedTone = computed(() => {
  if (props.tone !== 'auto') return props.tone
  if (props.value >= 100) return 'danger'
  if (props.value >= 80) return 'warn'
  return 'brand'
})

/** 把语义色转成实际色值（EP 支持传颜色字符串） */
const color = computed(() => {
  switch (resolvedTone.value) {
    case 'warn':
      return 'var(--warning)'
    case 'danger':
      return 'var(--danger)'
    default:
      return 'var(--brand)'
  }
})
</script>

<template>
  <el-progress
    class="progress"
    :percentage="Math.min(Math.max(value, 0), 100)"
    :stroke-width="height"
    :color="color"
    :show-text="showLabel"
    :status="value >= 100 ? 'exception' : undefined"
  />
</template>

<style scoped>
.progress {
  width: 100%;
}

.progress :deep(.el-progress-bar__outer) {
  background: var(--surface-sunken);
  border-radius: var(--radius-pill);
}

.progress :deep(.el-progress-bar__inner) {
  border-radius: var(--radius-pill);
  transition: width 0.5s var(--ease-out);
}

.progress :deep(.el-progress__text) {
  font-size: 12px;
  color: var(--ink-3);
  min-width: 34px;
}
</style>
