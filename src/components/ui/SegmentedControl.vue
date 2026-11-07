<script setup lang="ts">
/**
 * 分段切换器（Element Plus 封装）
 *
 * 渲染为 el-radio-group + el-radio-button，交互与视觉交给 EP；
 * 对外仍是「值 + 选项数组」的简单 API。
 */
withDefaults(
  defineProps<{
    /** 当前选中值 */
    modelValue: string
    /** 选项列表 */
    options: Array<{ label: string; value: string }>
    /** 尺寸 */
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/** el-radio-group 的值类型较宽，统一转成字符串再抛给业务层 */
function onChange(value: string | number | boolean | undefined): void {
  emit('update:modelValue', String(value ?? ''))
}
</script>

<template>
  <el-radio-group
    :model-value="modelValue"
    class="segmented"
    :size="size === 'sm' ? 'small' : 'default'"
    @update:model-value="onChange"
  >
    <el-radio-button v-for="option in options" :key="option.value" :value="option.value">
      {{ option.label }}
    </el-radio-button>
  </el-radio-group>
</template>

<style scoped>
.segmented {
  flex: none;
}

.segmented :deep(.el-radio-button__inner) {
  font-weight: 600;
  color: var(--ink-2);
  border-color: var(--line);
  background: var(--surface);
  box-shadow: none;
  padding: 0 14px;
  height: 32px;
  line-height: 30px;
}

.segmented :deep(.el-radio-button__inner:hover) {
  color: var(--brand);
}

.segmented :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background: var(--brand-soft);
  border-color: color-mix(in srgb, var(--brand) 30%, transparent);
  color: var(--brand-strong);
  box-shadow: none;
}

.segmented :deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

.segmented :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}
</style>
