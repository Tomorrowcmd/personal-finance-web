<script setup lang="ts">
/**
 * 分类图标块：彩色圆角底 + emoji
 *
 * 颜色直接取分类自身的 color（通过 CSS 变量注入，用 color-mix 调成 15% 透明度底色），
 * 因此同一个分类在流水列表、图例、图表里颜色始终一致。
 */
withDefaults(
  defineProps<{
    /** emoji 图标 */
    icon: string
    /** 分类颜色 #RRGGBB */
    color: string
    /** 分类名，仅用于 title 悬浮提示 */
    name?: string
    /** 尺寸：sm 24 / md 32 / lg 40 */
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { name: '', size: 'md' },
)
</script>

<template>
  <span
    class="category-dot"
    :class="`category-dot--${size}`"
    :style="{ '--dot-color': color }"
    :title="name || undefined"
  >
    {{ icon }}
  </span>
</template>

<style scoped>
.category-dot {
  display: inline-grid;
  place-items: center;
  flex: none;
  border-radius: 30%;
  background: color-mix(in srgb, var(--dot-color) 15%, transparent);
  line-height: 1;
}

.category-dot--sm {
  width: 24px;
  height: 24px;
  font-size: 12px;
}

.category-dot--md {
  width: 32px;
  height: 32px;
  font-size: 15px;
}

.category-dot--lg {
  width: 40px;
  height: 40px;
  font-size: 19px;
}
</style>
