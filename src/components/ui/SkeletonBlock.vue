<script setup lang="ts">
/**
 * 骨架占位块
 *
 * 用于「数据还在路上」的场景：图表、卡片内容还没到时不渲染空状态，
 * 而是显示同尺寸的灰色占位，避免「空状态文案闪一下又变成图表」的跳动。
 */
withDefaults(
  defineProps<{
    /** 高度：数字按 px 处理，字符串原样使用（如 '100%'） */
    height?: number | string
    /** 宽度，默认撑满 */
    width?: string
    /** 圆角 */
    radius?: string
  }>(),
  {
    height: 280,
    width: '100%',
    radius: 'var(--radius-md)',
  },
)

/** 数字转 px，字符串直接用 */
function toSize(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value
}
</script>

<template>
  <div
    class="skeleton-block"
    :style="{ height: toSize(height), width, borderRadius: radius }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton-block {
  background: linear-gradient(
    90deg,
    var(--surface-sunken) 25%,
    color-mix(in srgb, var(--surface-sunken) 55%, var(--line)) 37%,
    var(--surface-sunken) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.3s ease infinite;
}

/* 与 TransactionTable 的骨架屏保持同一节奏 */
@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
