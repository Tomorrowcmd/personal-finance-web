<script setup lang="ts">
import { computed, useSlots } from 'vue'

/**
 * 弹窗（Element Plus 封装）
 *
 * 对外保持 `v-model:open` + `title/subtitle/size` + footer 插槽的 API，
 * 页面里的用法完全不用改，内部换成 el-dialog：
 * - 自动获得 ESC / 遮罩关闭、焦点管理、滚动锁、层级管理
 * - 关闭按钮由 EP 提供
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg'
    closeOnBackdrop?: boolean
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

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const slots = useSlots()

/** el-dialog 的 v-model 是 show，这里做双向桥接 */
const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

/** 尺寸映射 */
const width = computed(() => {
  if (props.size === 'sm') return '440px'
  if (props.size === 'lg') return '820px'
  return '600px'
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :width="width"
    :close-on-click-modal="closeOnBackdrop"
    :close-on-press-escape="closeOnEsc"
    append-to-body
    align-center
    destroy-on-close
    class="app-dialog"
  >
    <!-- 自定义头部：标题 + 副标题 -->
    <template #header>
      <div class="modal__heading">
        <h2 class="modal__title">{{ title }}</h2>
        <p v-if="subtitle" class="modal__subtitle">{{ subtitle }}</p>
      </div>
    </template>

    <slot />

    <template v-if="slots.footer" #footer>
      <div class="modal__footer">
        <slot name="footer" />
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.modal__heading {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-right: 16px;
}

.modal__title {
  font-size: 16.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.modal__subtitle {
  font-size: 12.5px;
  color: var(--ink-3);
  line-height: 1.5;
}

.modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
</style>

<style>
/* el-dialog 的 body/footer 是全局结构，这里统一内边距 */
.app-dialog .el-dialog__header {
  padding: 20px 22px 10px;
  margin-right: 0;
}

.app-dialog .el-dialog__body {
  padding: 4px 22px 18px;
}

.app-dialog .el-dialog__footer {
  padding: 14px 22px;
  border-top: 1px solid var(--line);
  background: var(--surface-soft);
}

.app-dialog .el-dialog__headerbtn {
  top: 18px;
  right: 16px;
}

.app-dialog .el-dialog {
  border-radius: var(--radius-xl);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-pop);
}
</style>
