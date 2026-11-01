<script setup lang="ts">
/**
 * 按钮
 *
 * 全站统一的操作按钮，样式由 variant + size 决定：
 * - primary   主操作（保存、登录），实心品牌色
 * - secondary 次操作（取消、筛选），白底描边
 * - ghost     无边框（图标按钮、轻量操作）
 * - soft      浅色底（次要强调，如「去设置」）
 * - danger    危险操作（删除、退出）
 *
 * loading 时按钮自动 disabled 并显示转圈，业务侧无需再单独处理防重复提交。
 */
withDefaults(
  defineProps<{
    /** 视觉风格 */
    variant?: 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger'
    /** 高度：sm 30 / md 36 / lg 42 */
    size?: 'sm' | 'md' | 'lg'
    /** 原生 type，表单提交按钮需显式传 submit */
    type?: 'button' | 'submit' | 'reset'
    /** 加载中：显示 spinner 并禁用点击 */
    loading?: boolean
    /** 禁用 */
    disabled?: boolean
    /** 占满整行（登录页、弹窗底部常用） */
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
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'is-loading': loading }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-weight: 600;
  white-space: nowrap;
  transition:
    background-color 0.16s var(--ease),
    border-color 0.16s var(--ease),
    color 0.16s var(--ease),
    transform 0.08s var(--ease),
    box-shadow 0.16s var(--ease);
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 尺寸 */
.btn--sm {
  height: 30px;
  padding: 0 11px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.btn--md {
  height: 36px;
  padding: 0 14px;
  font-size: 13.5px;
}

.btn--lg {
  height: 42px;
  padding: 0 20px;
  font-size: 14.5px;
}

.btn--block {
  width: 100%;
}

/* 主按钮 */
.btn--primary {
  background: var(--brand);
  color: #fff;
  box-shadow: 0 1px 2px rgba(15, 122, 99, 0.24);
}

.btn--primary:hover:not(:disabled) {
  background: var(--brand-strong);
}

/* 次按钮 */
.btn--secondary {
  background: var(--surface);
  border-color: var(--line-strong);
  color: var(--ink);
}

.btn--secondary:hover:not(:disabled) {
  border-color: var(--ink-3);
  background: var(--surface-soft);
}

/* 无边框 */
.btn--ghost {
  color: var(--ink-2);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--surface-sunken);
  color: var(--ink);
}

/* 浅色底 */
.btn--soft {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.btn--soft:hover:not(:disabled) {
  background: var(--brand-soft);
  box-shadow: inset 0 0 0 1px var(--brand-ring);
}

/* 危险 */
.btn--danger {
  background: var(--danger);
  color: #fff;
}

.btn--danger:hover:not(:disabled) {
  filter: brightness(0.94);
}

.btn__spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: btn-spin 0.7s linear infinite;
  opacity: 0.85;
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
