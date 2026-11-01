<script setup lang="ts">
import { useId } from 'vue'

/**
 * 多行文本域
 *
 * 用于备注这类短文本（≤50 字），高度可拖拽调整。
 * 与 BaseInput 保持同样的 label / hint / error 结构，
 * 表单里混排时视觉一致。
 */
withDefaults(
  defineProps<{
    /** 文本值 */
    modelValue: string
    /** 字段标题 */
    label?: string
    /** 占位提示 */
    placeholder?: string
    /** 初始行数（最小高度另有 CSS 控制） */
    rows?: number
    /** 最大字符数 */
    maxlength?: number
    /** 辅助说明（有 error 时不显示） */
    hint?: string
    /** 错误文案 */
    error?: string
  }>(),
  {
    label: '',
    placeholder: '',
    rows: 3,
    hint: '',
    error: '',
  },
)

/** 输入时回传字符串 */
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// 关联 label 与 textarea
const id = useId()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label v-if="label" class="field__label" :for="id">{{ label }}</label>
    <textarea
      :id="id"
      class="field__textarea"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :maxlength="maxlength"
      @input="onInput"
    />
    <p v-if="error" class="field__error">{{ error }}</p>
    <p v-else-if="hint" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-2);
}

.field__textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  outline: none;
  resize: vertical;
  min-height: 74px;
  line-height: 1.6;
  font-size: 14px;
  transition:
    border-color 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
}

.field__textarea:hover {
  border-color: var(--ink-3);
}

.field__textarea:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-ring);
}

.field--error .field__textarea {
  border-color: var(--danger);
}

.field__textarea::placeholder {
  color: var(--ink-3);
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
