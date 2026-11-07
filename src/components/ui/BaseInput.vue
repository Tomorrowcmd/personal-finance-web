<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * 文本输入（Element Plus 封装）
 *
 * 保持原有 API：v-model 始终是字符串，label / hint / error 的展示位置不变。
 * 内部使用 el-input，自动获得 EP 的焦点态、清空、密码可见等能力。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | number
    label?: string
    type?: string
    placeholder?: string
    hint?: string
    error?: string
    prefix?: string
    inputmode?: 'text' | 'decimal' | 'numeric' | 'search' | 'email' | 'tel' | 'url'
    maxlength?: number
    disabled?: boolean
    readonly?: boolean
    required?: boolean
    autocomplete?: string
    autofocus?: boolean
    /** 密码框是否显示「眼睛」切换 */
    showPassword?: boolean
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
    showPassword: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  enter: []
}>()

/** 关联 label 与输入框 */
const id = useId()

/** el-input 只接受字符串，这里做一层桥接，对外仍是字符串语义 */
const value = computed({
  get: () => String(props.modelValue ?? ''),
  set: (next: string) => emit('update:modelValue', next),
})
</script>

<template>
  <div class="field" :class="{ 'field--error': error, 'field--disabled': disabled }">
    <label v-if="label" class="field__label" :for="id">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>

    <el-input
      :id="id"
      v-model="value"
      class="field__input"
      :type="type"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :maxlength="maxlength"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      :autofocus="autofocus"
      :show-password="showPassword"
      :aria-invalid="Boolean(error)"
      @keyup.enter="emit('enter')"
    >
      <template v-if="prefix" #prefix>
        <span class="field__prefix">{{ prefix }}</span>
      </template>
      <template v-if="$slots.suffix" #suffix>
        <slot name="suffix" />
      </template>
    </el-input>

    <p v-if="error" class="field__error">{{ error }}</p>
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

.field__prefix {
  color: var(--ink-3);
  font-size: 13px;
}

.field__input :deep(.el-input__wrapper) {
  min-height: 38px;
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--line-strong) inset;
}

.field__input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--ink-3) inset;
}

.field__input :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--brand) inset,
    0 0 0 3px var(--brand-ring);
}

.field--error .field__input :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--danger) inset;
}

.field--error .field__input :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--danger) inset,
    0 0 0 3px var(--danger-soft);
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
</style>
