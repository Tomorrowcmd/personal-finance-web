<script setup lang="ts">
/**
 * 空状态占位
 *
 * 图表无数据、列表为空、未设置预算时使用。
 * 默认插槽提供「操作按钮」（如「去设置」「记一笔」），没有插槽时只显示文案。
 */
withDefaults(
  defineProps<{
    /** 主标题 */
    title?: string
    /** 补充说明 */
    description?: string
    /** emoji 图标，直接渲染字符 */
    icon?: string
    /** 紧凑模式：内嵌在卡片里时减小上下留白 */
    compact?: boolean
  }>(),
  {
    title: '暂无数据',
    description: '',
    icon: '🌱',
    compact: false,
  },
)
</script>

<template>
  <div class="empty" :class="{ 'empty--compact': compact }">
    <span class="empty__icon" aria-hidden="true">{{ icon }}</span>
    <p class="empty__title">{{ title }}</p>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <div v-if="$slots.action" class="empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 48px 20px;
  text-align: center;
}

.empty--compact {
  padding: 26px 16px;
}

.empty__icon {
  font-size: 30px;
  line-height: 1;
  margin-bottom: 4px;
  opacity: 0.9;
}

.empty__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.empty__desc {
  font-size: 12.5px;
  color: var(--ink-3);
  max-width: 280px;
}

.empty__action {
  margin-top: 10px;
}
</style>
