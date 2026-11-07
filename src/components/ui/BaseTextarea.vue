<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * 多行文本域（Element Plus 封装）
 *
 * 用于备注（≤50 字），保留 label / hint / error 的结构。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    placeholder?: string
    rows?: number
    maxlength?: number
    hint?: string
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

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const id = useId()

/** el-input type=textarea 只接受字符串 */
const value = computed({
  get: () => props.modelValue,
  set: (next: string) => emit('update:modelValue', next),
})
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label v-if="label" class="field__label" :for="id">{{ label }}</label>
    <el-input
      :id="id"
      v-model="value"
      type="textarea"
      :rows="rows"
      :placeholder="placeholder"
      :maxlength="maxlength"
      resize="vertical"
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

.field :deep(.el-textarea__inner) {
  min-height: 74px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 1px var(--line-strong) inset;
}

.field :deep(.el-textarea__inner:hover) {
  box-shadow: 0 0 0 1px var(--ink-3) inset;
}

.field :deep(.el-textarea__inner:focus) {
  box-shadow:
    0 0 0 1px var(--brand) inset,
    0 0 0 3px var(--brand-ring);
}

.field--error :deep(.el-textarea__inner) {
  box-shadow: 0 0 0 1px var(--danger) inset;
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
