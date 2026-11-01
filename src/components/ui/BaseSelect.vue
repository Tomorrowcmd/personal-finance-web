<script setup lang="ts">
import { useId } from 'vue'

import AppIcon from './AppIcon.vue'

/**
 * 下拉选择
 *
 * 基于原生 <select>，保留键盘操作与移动端原生滚轮体验；
 * 只负责样式与「值类型保持」，不处理业务逻辑。
 */
export interface SelectOption {
  /** 展示文案 */
  label: string
  /** 选项值：字符串或数字，onChange 会原样回传该类型 */
  value: string | number
  /** 是否禁用该项 */
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** 当前选中值 */
    modelValue: string | number
    /** 选项列表 */
    options: SelectOption[]
    /** 字段标题 */
    label?: string
    /** 占位项文案；传空串则不渲染占位项 */
    placeholder?: string
    /** 禁用 */
    disabled?: boolean
    /** 尺寸：sm 32px / md 38px，用于和工具条里的其它控件对齐 */
    size?: 'sm' | 'md'
  }>(),
  {
    label: '',
    placeholder: '请选择',
    disabled: false,
    size: 'md',
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

// 关联 label 与 select
const id = useId()

/**
 * 原生 select 的 value 永远是字符串，
 * 这里按「字符串相等」找回原始选项，把 number 原样抛回去，
 * 避免调用方到处 Number() 转换。
 */
function onChange(event: Event): void {
  const raw = (event.target as HTMLSelectElement).value
  const matched = props.options.find((option) => String(option.value) === raw)
  emit('update:modelValue', matched ? matched.value : raw)
}
</script>

<template>
  <div class="field">
    <label v-if="label" class="field__label" :for="id">{{ label }}</label>
    <div class="field__control" :class="`field__control--${size}`">
      <select
        :id="id"
        class="field__select"
        :value="String(modelValue)"
        :disabled="disabled"
        @change="onChange"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="String(option.value)"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <AppIcon name="chevronDown" :size="14" class="field__chevron" />
    </div>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-2);
}

.field__control {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  transition:
    border-color 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
}

.field__control--md {
  height: 38px;
}

.field__control--sm {
  height: 32px;
}

.field__control:hover {
  border-color: var(--ink-3);
}

.field__control:focus-within {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-ring);
}

.field__select {
  appearance: none;
  width: 100%;
  height: 100%;
  padding: 0 32px 0 12px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  border-radius: inherit;
  cursor: pointer;
}

.field__select:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.field__chevron {
  position: absolute;
  right: 11px;
  pointer-events: none;
  color: var(--ink-3);
}
</style>
