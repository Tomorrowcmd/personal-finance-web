<script setup lang="ts">
/**
 * 空状态（Element Plus 封装）
 *
 * 用 emoji 作为插图（项目风格），标题/描述/操作按钮的插槽语义保持不变。
 */
withDefaults(
  defineProps<{
    title?: string
    description?: string
    icon?: string
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
  <el-empty class="empty" :class="{ 'empty--compact': compact }" :image-size="compact ? 52 : 74">
    <template #image>
      <span class="empty__icon" aria-hidden="true">{{ icon }}</span>
    </template>
    <template #description>
      <p class="empty__title">{{ title }}</p>
      <p v-if="description" class="empty__desc">{{ description }}</p>
    </template>
    <div v-if="$slots.action" class="empty__action">
      <slot name="action" />
    </div>
  </el-empty>
</template>

<style scoped>
.empty {
  padding: 28px 16px;
}

.empty--compact {
  padding: 16px 12px;
}

.empty__icon {
  display: block;
  font-size: 32px;
  line-height: 1;
}

.empty__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.empty__desc {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--ink-3);
}

.empty__action {
  margin-top: 12px;
}

.empty :deep(.el-empty__description) {
  margin-top: 8px;
}
</style>
