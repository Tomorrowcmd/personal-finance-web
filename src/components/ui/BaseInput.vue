<script setup lang="ts">
import { useId } from 'vue'

/**
 * 文本输入
 *
 * 统一处理 label / 前后缀 / 错误提示 / 焦点样式 / 无障碍属性。
 * 约定：v-model 始终回传字符串（数字字段由调用方自行 Number()），
 * 这样「12.」「-」这类输入中间态不会被强转破坏。
 * 金额输入建议 type="text" + inputmode="decimal"，避免滚轮误改数值。
 */
withDefaults(
  defineProps<{
    /** 输入值（字符串或数字；回传时统一转字符串） */
    modelValue: string | number
    /** 字段标题 */
    label?: string
    /** 原生 input type：text / password / date / number… */
    type?: string
    /** 占位提示 */
    placeholder?: string
    /** 字段下方的辅助说明（有 error 时不显示） */
    hint?: string
    /** 字段下方的错误文案（同时把边框标红） */
    error?: string
    /** 输入框内的前缀文字，如金额的「¥」 */
    prefix?: string
    /** 移动端键盘类型，decimal 适合金额 */
    inputmode?: 'text' | 'decimal' | 'numeric' | 'search' | 'email' | 'tel' | 'url'
    /** 最大字符数 */
    maxlength?: number
    /** 禁用 */
    disabled?: boolean
    /** 只读 */
    readonly?: boolean
    /** 是否必填（仅展示红色星号，校验由调用方负责） */
    required?: boolean
    /** 浏览器自动填充提示，登录表单建议填 username / current-password */
    autocomplete?: string
    /** 挂载后自动聚焦 */
    autofocus?: boolean
  }>(),
  {
    type: 'text',
    placeholder: '',
    hint: '',
    error: '',
    prefix: '',
    disabled: false,
    readonly: false,
    required: false,
    autocomplete: 'off',
    autofocus: false,
  },
)

/** update:modelValue 回传字符串；enter 用于「回车提交」场景 */
const emit = defineEmits<{
  'update:modelValue': [value: string]
  enter: []
}>()

// 组件唯一 id：把 <label for> 与 input 关联起来，点击标题也能聚焦
const id = useId()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function onEnter(): void {
  emit('enter')
}
</script>

<template>
  <div class="field" :class="{ 'field--error': error, 'field--disabled': disabled }">
    <label v-if="label" class="field__label" :for="id">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>

    <div class="field__control">
      <span v-if="prefix" class="field__prefix">{{ prefix }}</span>
      <input
        :id="id"
        class="field__input"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :disabled="disabled"
        :readonly="readonly"
        :autocomplete="autocomplete"
        :autofocus="autofocus"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? `${id}-error` : undefined"
        @input="onInput"
        @keydown.enter="onEnter"
      />
      <slot name="suffix" />
    </div>

    <p v-if="error" :id="`${id}-error`" class="field__error">{{ error }}</p>
    <p v-else-if="hint" class="field__hint">{{ hint }}</p>
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

.field__required {
  color: var(--expense);
  margin-left: 2px;
}

.field__control {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  transition:
    border-color 0.16s var(--ease),
    box-shadow 0.16s var(--ease),
    background-color 0.16s var(--ease);
}

.field__control:hover {
  border-color: var(--ink-3);
}

.field__control:focus-within {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-ring);
}

.field--error .field__control {
  border-color: var(--danger);
}

.field--error .field__control:focus-within {
  box-shadow: 0 0 0 3px var(--danger-soft);
}

.field--disabled .field__control {
  background: var(--surface-sunken);
  opacity: 0.7;
}

.field__prefix {
  color: var(--ink-3);
  font-size: 13px;
  flex: none;
}

.field__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
}

.field__input::placeholder {
  color: var(--ink-3);
}

.field__input:disabled {
  cursor: not-allowed;
}

.field__hint,
.field__error {
  font-size: 12px;
  line-height: 1.4;
}

.field__hint {
  color: var(--ink-3);
}

.field__error {
  color: var(--danger);
}

/* 去掉数字输入框的原生上下箭头 */
.field__input::-webkit-outer-spin-button,
.field__input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
</style>
