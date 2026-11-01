<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'

import AppIcon from './AppIcon.vue'

/**
 * 弹窗
 *
 * - v-model:open 控制显隐（父组件用 v-model 绑定）
 * - Esc / 点击遮罩关闭（可分别关闭）
 * - 打开时锁定 body 滚动，关闭时恢复原有 overflow
 * - 打开后自动聚焦第一个可输入元素，键盘用户可以直接输入
 * - Teleport 到 body，避免被父级 overflow / transform 裁剪
 */
const props = withDefaults(
  defineProps<{
    /** 是否显示 */
    open: boolean
    /** 标题（同时作为 aria-label） */
    title?: string
    /** 标题下的说明文字 */
    subtitle?: string
    /** 尺寸：sm 420 / md 560 / lg 760 */
    size?: 'sm' | 'md' | 'lg'
    /** 点击遮罩是否关闭（确认框一般设为 false，防误触） */
    closeOnBackdrop?: boolean
    /** 按 Esc 是否关闭 */
    closeOnEsc?: boolean
  }>(),
  {
    title: '',
    subtitle: '',
    size: 'md',
    closeOnBackdrop: true,
    closeOnEsc: true,
  },
)

/** 只向外抛 update:open，由父组件的 v-model 决定最终状态 */
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const slots = useSlots()
/** 面板节点，用于查找首个可聚焦元素 */
const panel = ref<HTMLElement | null>(null)
/** 打开前的 body overflow，关闭时原样恢复（可能被其他弹窗改过） */
let previousOverflow = ''

function close(): void {
  emit('update:open', false)
}

/** 遮罩点击：受 closeOnBackdrop 控制 */
function onBackdrop(): void {
  if (props.closeOnBackdrop) close()
}

/** 全局 Esc：只有打开状态才响应，并阻止事件继续冒泡 */
function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape' && props.closeOnEsc) {
    event.stopPropagation()
    close()
  }
}

// 打开/关闭时同步页面滚动锁定与焦点
watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      // 等 DOM 渲染完再聚焦，否则查不到元素
      await nextTick()
      const target = panel.value?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, select, button.modal__close',
      )
      target?.focus({ preventScroll: true })
    } else {
      document.body.style.overflow = previousOverflow
    }
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  // 组件被销毁时也要把滚动锁解开，避免页面再也滚不动
  document.body.style.overflow = previousOverflow || ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal">
        <div class="modal__backdrop" @click="onBackdrop" />
        <div
          ref="panel"
          class="modal__panel"
          :class="`modal__panel--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="title || '对话框'"
        >
          <header class="modal__header">
            <div class="modal__heading">
              <h2 class="modal__title">{{ title }}</h2>
              <p v-if="subtitle" class="modal__subtitle">{{ subtitle }}</p>
            </div>
            <button class="modal__close" type="button" aria-label="关闭" @click="close">
              <AppIcon name="close" :size="16" />
            </button>
          </header>

          <div class="modal__body">
            <slot />
          </div>

          <footer v-if="slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal__backdrop {
  position: absolute;
  inset: 0;
  background: var(--overlay);
  backdrop-filter: blur(2px);
}

.modal__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(88vh, 860px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}

.modal__panel--sm {
  max-width: 420px;
}

.modal__panel--md {
  max-width: 560px;
}

.modal__panel--lg {
  max-width: 760px;
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 14px;
}

.modal__title {
  font-size: 16.5px;
  font-weight: 650;
}

.modal__subtitle {
  margin-top: 3px;
  font-size: 12.5px;
  color: var(--ink-3);
}

.modal__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  color: var(--ink-3);
  transition:
    background-color 0.16s var(--ease),
    color 0.16s var(--ease);
  flex: none;
}

.modal__close:hover {
  background: var(--surface-sunken);
  color: var(--ink);
}

.modal__body {
  padding: 6px 22px 22px;
  overflow-y: auto;
}

.modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--line);
  background: var(--surface-soft);
}

/* 动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s var(--ease);
}

.modal-enter-active .modal__panel,
.modal-leave-active .modal__panel {
  transition:
    transform 0.24s var(--ease-out),
    opacity 0.2s var(--ease);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal__panel,
.modal-leave-to .modal__panel {
  transform: translateY(10px) scale(0.98);
  opacity: 0;
}
</style>
