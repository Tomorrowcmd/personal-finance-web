<script setup lang="ts">
/**
 * 分段切换器（单选）
 *
 * 用于「全部 / 支出 / 收入」「本月 / 上月 / 近3月」这类互斥过滤。
 * 值统一是字符串，调用方需要联合类型时自行断言（如统计页的 StatPreset）。
 */
withDefaults(
  defineProps<{
    /** 当前选中值 */
    modelValue: string
    /** 选项列表，value 必须唯一 */
    options: Array<{ label: string; value: string }>
    /** 尺寸：sm 26px / md 30px */
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

/** 选中项变化时抛出，配合 v-model 使用 */
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="segmented" :class="`segmented--${size}`" role="group">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="segmented__item"
      :class="{ 'is-active': modelValue === option.value }"
      :aria-pressed="modelValue === option.value"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--surface-sunken);
  border-radius: var(--radius-md);
}

.segmented__item {
  border-radius: 8px;
  font-weight: 600;
  color: var(--ink-2);
  transition:
    background-color 0.16s var(--ease),
    color 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
  white-space: nowrap;
}

.segmented--md .segmented__item {
  height: 30px;
  padding: 0 14px;
  font-size: 13px;
}

.segmented--sm .segmented__item {
  height: 26px;
  padding: 0 11px;
  font-size: 12.5px;
}

.segmented__item:hover {
  color: var(--ink);
}

.segmented__item.is-active {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-xs);
}
</style>
