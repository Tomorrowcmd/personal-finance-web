<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * 下拉选择（Element Plus 封装）
 *
 * 与原来一样：v-model 保留选项的原始类型（string / number），
 * 调用方不需要做 String() / Number() 转换。
 */
export interface SelectOption {
  /** 展示文案 */
  label: string
  /** 选项值 */
  value: string | number
  /** 是否禁用 */
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    options: SelectOption[]
    label?: string
    placeholder?: string
    disabled?: boolean
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

const id = useId()

/**
 * 占位文案
 *
 * Element Plus 在值为空（''）时会显示 placeholder。
 * 业务里用「空值选项」表示「全部分类」，所以当没有显式 placeholder 时，
 * 自动用该选项的文案兜底，避免出现空白的下拉框。
 */
const effectivePlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder
  const emptyOption = props.options.find((option) => option.value === '')
  return emptyOption?.label ?? '请选择'
})

/** el-select 直接支持 string | number，无需类型转换 */
const value = computed({
  get: () => props.modelValue,
  set: (next: string | number) => emit('update:modelValue', next),
})
</script>

<template>
  <div class="field">
    <label v-if="label" class="field__label" :for="id">{{ label }}</label>
    <el-select
      :id="id"
      v-model="value"
      class="field__select"
      :placeholder="effectivePlaceholder"
      :disabled="disabled"
      :size="size === 'sm' ? 'small' : 'default'"
    >
      <el-option
        v-for="option in options"
        :key="String(option.value)"
        :label="option.label"
        :value="option.value"
        :disabled="option.disabled"
      />
    </el-select>
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

.field__select {
  width: 100%;
}

.field__select :deep(.el-select__wrapper) {
  min-height: 38px;
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 1px var(--line-strong) inset;
}

.field__select :deep(.el-select__wrapper.is-focused) {
  box-shadow:
    0 0 0 1px var(--brand) inset,
    0 0 0 3px var(--brand-ring);
}
</style>
