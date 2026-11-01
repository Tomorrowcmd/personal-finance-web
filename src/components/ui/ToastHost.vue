<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useToastStore } from '@/stores/toast'

import AppIcon from './AppIcon.vue'

/**
 * 全局提示容器
 *
 * 只负责渲染：消息由 useToastStore().success/error/info 推入，
 * 3.2 秒后由 store 自动移除（错误提示 4.2 秒）。
 * 挂在 App.vue 根部，登录页与业务页共用。
 */
const toast = useToastStore()
const { items } = storeToRefs(toast)

/** 不同提示类型对应的图标 */
const ICON_MAP = {
  success: 'check',
  error: 'alert',
  info: 'sparkle',
} as const
</script>

<template>
  <!-- 固定右下角（窄屏贴底），aria-live 让读屏在出现时朗读 -->
  <Teleport to="body">
    <div class="toasts" role="status" aria-live="polite">
      <TransitionGroup name="toast">
        <!-- 每条提示：类型图标 + 文案 + 手动关闭，进场/退场由 TransitionGroup 处理 -->
        <div v-for="item in items" :key="item.id" class="toast" :class="`toast--${item.type}`">
          <span class="toast__icon">
            <AppIcon :name="ICON_MAP[item.type]" :size="13" :stroke-width="2.2" />
          </span>
          <p class="toast__text">{{ item.message }}</p>
          <button
            class="toast__close"
            type="button"
            aria-label="关闭提示"
            @click="toast.dismiss(item.id)"
          >
            <AppIcon name="close" :size="12" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 240px;
  max-width: 380px;
  padding: 11px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  pointer-events: auto;
}

.toast__icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex: none;
  margin-top: 1px;
}

.toast--success .toast__icon {
  background: var(--income-soft);
  color: var(--income);
}

.toast--error .toast__icon {
  background: var(--danger-soft);
  color: var(--danger);
}

.toast--info .toast__icon {
  background: var(--brand-soft);
  color: var(--brand);
}

.toast__text {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink);
  word-break: break-word;
}

.toast__close {
  color: var(--ink-3);
  padding: 3px;
  border-radius: 6px;
  flex: none;
}

.toast__close:hover {
  background: var(--surface-sunken);
  color: var(--ink);
}

/* 进出场 */
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s var(--ease),
    transform 0.2s var(--ease-out);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

@media (max-width: 640px) {
  .toasts {
    left: 16px;
    right: 16px;
    bottom: 16px;
  }

  .toast {
    max-width: none;
  }
}
</style>
