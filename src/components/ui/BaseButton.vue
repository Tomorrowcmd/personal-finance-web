<script setup lang="ts">
import { computed } from 'vue'

/**
 * 按钮（Element Plus 封装）
 *
 * 对外 props / 事件保持不变，内部渲染 el-button：
 * - primary    → type=primary
 * - secondary  → 默认白底描边
 * - ghost      → text 按钮
 * - soft       → primary + plain（浅绿底）
 * - danger     → type=danger
 */
const props = withDefaults(
  defineProps<{
    /** 视觉风格 */
    variant?: 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger'
    /** 尺寸：sm / md / lg */
    size?: 'sm' | 'md' | 'lg'
    /** 原生 type，表单提交按钮需传 submit */
    type?: 'button' | 'submit' | 'reset'
    /** 加载中 */
    loading?: boolean
    /** 禁用 */
    disabled?: boolean
    /** 占满整行 */
    block?: boolean
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    block: false,
  },
)

/** 映射到 el-button 的 type */
const elType = computed(() => {
  if (props.variant === 'danger') return 'danger'
  if (props.variant === 'primary' || props.variant === 'soft') return 'primary'
  return 'default'
})

/** soft = 浅色底 */
const plain = computed(() => props.variant === 'soft')

/** ghost = 无边框文字按钮 */
const isText = computed(() => props.variant === 'ghost')

/** 尺寸映射：el-button 没有 md，默认即中等 */
const elSize = computed(() => {
  if (props.size === 'sm') return 'small'
  if (props.size === 'lg') return 'large'
  return 'default'
})
</script>

<template>
  <el-button
    :type="elType"
    :plain="plain"
    :text="isText"
    :size="elSize"
    :loading="loading"
    :disabled="disabled"
    :native-type="type"
    :class="{ 'btn--block': block }"
    class="app-btn"
  >
    <slot />
  </el-button>
</template>

<style scoped>
.app-btn {
  font-weight: 600;
}

.app-btn.btn--block {
  width: 100%;
}

/* 主按钮保持品牌色，与侧栏/图表一致 */
.app-btn.el-button--primary:not(.is-plain):not(.is-text) {
  --el-button-bg-color: var(--brand);
  --el-button-border-color: var(--brand);
  --el-button-hover-bg-color: var(--brand-strong);
  --el-button-hover-border-color: var(--brand-strong);
  --el-button-active-bg-color: var(--brand-strong);
  --el-button-active-border-color: var(--brand-strong);
}
</style>
