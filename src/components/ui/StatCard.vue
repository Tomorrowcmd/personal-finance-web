<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * 指标卡（Element Plus 版）
 *
 * 用 el-card 承载，保留原有 props（label / value / hint / icon / tone / badge）。
 */
withDefaults(
  defineProps<{
    /** 指标名称 */
    label: string
    /** 已格式化的指标值 */
    value: string
    /** 补充说明 */
    hint?: string
    /** 图标名（AppIcon 语义名） */
    icon?: string
    /** 图标配色 */
    tone?: 'brand' | 'income' | 'expense' | 'warning'
    /** 右上角小标签 */
    badge?: { text: string; tone: 'good' | 'bad' | 'neutral' }
  }>(),
  { hint: '', icon: 'wallet', tone: 'brand' },
)
</script>

<template>
  <el-card shadow="never" class="stat">
    <div class="stat__head">
      <span class="stat__icon" :class="`stat__icon--${tone}`">
        <AppIcon :name="icon" :size="15" />
      </span>
      <span class="stat__label">{{ label }}</span>
      <span v-if="badge" class="stat__badge" :class="`stat__badge--${badge.tone}`">
        {{ badge.text }}
      </span>
    </div>

    <p class="stat__value num">{{ value }}</p>
    <p v-if="hint" class="stat__hint">{{ hint }}</p>
  </el-card>
</template>

<style scoped>
.stat {
  border-radius: var(--radius-lg);
  border: 1px solid var(--line);
  background: var(--surface);
  transition:
    border-color 0.2s var(--ease),
    box-shadow 0.2s var(--ease),
    transform 0.2s var(--ease);
}

.stat:hover {
  border-color: color-mix(in srgb, var(--brand) 22%, var(--line));
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.stat :deep(.el-card__body) {
  padding: 17px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat__head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stat__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  flex: none;
  border: 1px solid transparent;
}

.stat__icon--brand {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--brand) 18%, transparent),
    transparent
  );
  border-color: color-mix(in srgb, var(--brand) 16%, transparent);
  color: var(--brand);
}

.stat__icon--income {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--income) 18%, transparent),
    transparent
  );
  border-color: color-mix(in srgb, var(--income) 16%, transparent);
  color: var(--income);
}

.stat__icon--expense {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--expense) 18%, transparent),
    transparent
  );
  border-color: color-mix(in srgb, var(--expense) 16%, transparent);
  color: var(--expense);
}

.stat__icon--warning {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--warning) 20%, transparent),
    transparent
  );
  border-color: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
}

.stat__label {
  font-size: 12.5px;
  color: var(--ink-2);
  font-weight: 550;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat__badge {
  margin-left: auto;
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.stat__badge--good {
  background: var(--income-soft);
  color: var(--income);
}

.stat__badge--bad {
  background: var(--expense-soft);
  color: var(--expense);
}

.stat__badge--neutral {
  background: var(--surface-sunken);
  color: var(--ink-3);
}

.stat__value {
  font-size: 24px;
  font-weight: 670;
  letter-spacing: -0.035em;
  margin-top: 9px;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.stat__hint {
  font-size: 11.5px;
  color: var(--ink-3);
  margin-top: 2px;
}
</style>
