<script setup lang="ts">
import { computed } from 'vue'

/**
 * 骨架占位块（Element Plus 封装）
 *
 * 数据未返回时占位，避免空状态文案闪烁；尺寸与真实内容保持一致。
 */
const props = withDefaults(
  defineProps<{
    height?: number | string
    width?: string
    radius?: string
  }>(),
  {
    height: 280,
    width: '100%',
    radius: 'var(--radius-md)',
  },
)

/** 数字转 px */
const heightValue = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height,
)
</script>

<template>
  <el-skeleton animated class="skeleton" :loading="true">
    <template #template>
      <el-skeleton-item
        variant="rect"
        :style="{ height: heightValue, width, borderRadius: radius }"
      />
    </template>
    <template #default>
      <span />
    </template>
  </el-skeleton>
</template>

<style scoped>
.skeleton {
  width: 100%;
}

.skeleton :deep(.el-skeleton__item) {
  background: var(--surface-sunken);
}
</style>
