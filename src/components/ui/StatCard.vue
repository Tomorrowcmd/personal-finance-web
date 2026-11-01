<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * 指标卡
 *
 * 统计页顶部的四个数字卡片（总收入 / 总支出 / 净结余 / 储蓄率）。
 * - tone 决定左上角图标底色（品牌色 / 收入绿 / 支出红 / 预警橙）
 * - badge 是右上角的可选小标签，用于「较上月 +6%」这类提示
 * - value 由调用方格式化好再传入，组件不关心金额规则
 */
withDefaults(
  defineProps<{
    /** 指标名称，如「总收入」 */
    label: string
    /** 已格式化的指标值，如「¥12,345.67」 */
    value: string
    /** 值下方的补充说明，如「月均 ¥6,505.03」 */
    hint?: string
    /** 图标名（对应 AppIcon 的 ICONS key） */
    icon?: string
    /** 图标配色主题 */
    tone?: 'brand' | 'income' | 'expense' | 'warning'
    /** 右上角小标签：text + 语义色 */
    badge?: { text: string; tone: 'good' | 'bad' | 'neutral' }
  }>(),
  { hint: '', icon: 'wallet', tone: 'brand' },
)
</script>

<template>
  <div class="stat card">
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
  </div>
</template>

<style scoped>
.stat {
  padding: 16px 18px 15px;
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
  width: 26px;
  height: 26px;
  border-radius: 8px;
  flex: none;
}

.stat__icon--brand {
  background: var(--brand-soft);
  color: var(--brand);
}

.stat__icon--income {
  background: var(--income-soft);
  color: var(--income);
}

.stat__icon--expense {
  background: var(--expense-soft);
  color: var(--expense);
}

.stat__icon--warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.stat__label {
  font-size: 12.5px;
  color: var(--ink-2);
  font-weight: 550;
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
  font-size: 23px;
  font-weight: 660;
  letter-spacing: -0.03em;
  margin-top: 8px;
  line-height: 1.2;
}

.stat__hint {
  font-size: 11.5px;
  color: var(--ink-3);
  margin-top: 2px;
}
</style>
