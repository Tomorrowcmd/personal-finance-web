<script setup lang="ts">
import { computed } from 'vue'

import { clamp } from '@/utils/format'

/**
 * 进度条
 *
 * 用于预算使用率、分类占比等场景。
 * tone=auto 时按用量自动变色：<80% 品牌色，80~100% 橙色，≥100% 红色，
 * 这样不需要每个调用方自己判断超支。
 * 传入值可能超过 100（超支），内部会夹取到 0-100 只影响宽度，
 * 但颜色判断仍用原始值，所以超支时依然是红色。
 */
const props = withDefaults(
  defineProps<{
    /** 百分比，0-100（允许超过 100 表示超支） */
    value: number
    /** 颜色策略：auto 按阈值，其余强制指定 */
    tone?: 'auto' | 'brand' | 'warn' | 'danger'
    /** 轨道高度（px） */
    height?: number
    /** 是否在右侧显示百分比数字 */
    showLabel?: boolean
  }>(),
  {
    tone: 'auto',
    height: 8,
    showLabel: false,
  },
)

/** 实际渲染的宽度百分比（夹取到 0-100） */
const percent = computed(() => clamp(props.value, 0, 100))

/** 最终颜色：auto 模式下按 80% / 100% 两个阈值切换 */
const resolvedTone = computed(() => {
  if (props.tone !== 'auto') return props.tone
  if (props.value >= 100) return 'danger'
  if (props.value >= 80) return 'warn'
  return 'brand'
})
</script>

<template>
  <div class="progress-wrap">
    <div class="progress" :style="{ height: `${height}px` }">
      <div
        class="progress__fill"
        :class="`progress__fill--${resolvedTone}`"
        :style="{ width: `${percent}%` }"
      />
    </div>
    <span v-if="showLabel" class="progress__label num">{{ Math.round(value) }}%</span>
  </div>
</template>

<style scoped>
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.progress {
  flex: 1;
  background: var(--surface-sunken);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress__fill {
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width 0.5s var(--ease-out);
}

.progress__fill--brand {
  background: var(--brand);
}

.progress__fill--warn {
  background: var(--warning);
}

.progress__fill--danger {
  background: var(--danger);
}

.progress__label {
  font-size: 12px;
  color: var(--ink-3);
  min-width: 34px;
  text-align: right;
}
</style>
