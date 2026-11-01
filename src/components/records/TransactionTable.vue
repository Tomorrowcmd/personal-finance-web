<script setup lang="ts">
import type { Transaction } from '@/types'
import { formatSignedAmount } from '@/utils/format'
import { formatDateLabel } from '@/utils/date'

import AppIcon from '@/components/ui/AppIcon.vue'
import CategoryDot from '@/components/ui/CategoryDot.vue'

/**
 * 流水表格
 *
 * 纯展示组件：不发请求，数据由父组件传入。
 * readonly 用于总览页（只看不改），明细页则显示编辑/删除操作列。
 */
withDefaults(
  defineProps<{
    /** 当前页流水 */
    items: Transaction[]
    /** 加载中：渲染骨架屏，而不是空状态 */
    loading?: boolean
    /** 只读：隐藏操作列 */
    readonly?: boolean
  }>(),
  { loading: false, readonly: false },
)

/** 编辑 / 删除由父组件处理（打开弹窗、二次确认都放在页面层） */
const emit = defineEmits<{
  edit: [transaction: Transaction]
  remove: [transaction: Transaction]
}>()
</script>

<template>
  <!-- 外层允许横向滚动：窄屏时隐藏备注列（见样式），仍保留滚动兜底 -->
  <div class="table-wrap">
    <table class="table">
      <!-- 表头：操作列在只读模式下不渲染，与 tbody 的列数保持一致 -->
      <thead>
        <tr>
          <th class="col-date">日期</th>
          <th class="col-category">分类</th>
          <th class="col-note">备注</th>
          <th class="col-amount ta-r">金额</th>
          <th v-if="!readonly" class="col-actions ta-r">操作</th>
        </tr>
      </thead>

      <!-- 加载态：用 5 行骨架屏占位，避免页面高度跳动 -->
      <tbody v-if="loading">
        <tr v-for="n in 5" :key="`skeleton-${n}`" class="is-skeleton">
          <td><span class="skeleton skeleton--sm" /></td>
          <td><span class="skeleton skeleton--md" /></td>
          <td><span class="skeleton skeleton--lg" /></td>
          <td class="ta-r"><span class="skeleton skeleton--sm" /></td>
          <td v-if="!readonly" />
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="item in items" :key="item.id" class="record-row">
          <td class="col-date">
            <span class="date">{{ item.date.slice(5) }}</span>
            <span class="week">{{ formatDateLabel(item.date).split(' ')[1] }}</span>
          </td>

          <td class="col-category">
            <div class="category">
              <CategoryDot :icon="item.categoryIcon" :color="item.categoryColor" size="sm" />
              <span class="category__name">{{ item.categoryName }}</span>
            </div>
          </td>

          <td class="col-note">
            <span class="note truncate" :title="item.note">{{ item.note || '—' }}</span>
          </td>

          <td class="col-amount ta-r">
            <span
              class="amount num"
              :class="item.type === 'INCOME' ? 'text-income' : 'text-expense'"
            >
              {{ formatSignedAmount(item.amount, item.type) }}
            </span>
          </td>

          <td v-if="!readonly" class="col-actions ta-r">
            <div class="actions">
              <button
                class="action-btn"
                type="button"
                :aria-label="`编辑 ${item.categoryName} ${item.amount} 元`"
                title="编辑"
                @click="emit('edit', item)"
              >
                <AppIcon name="edit" :size="15" />
              </button>
              <button
                class="action-btn action-btn--danger"
                type="button"
                :aria-label="`删除 ${item.categoryName} ${item.amount} 元`"
                title="删除"
                @click="emit('remove', item)"
              >
                <AppIcon name="trash" :size="15" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="!loading && items.length === 0" class="table-empty">当前条件下没有记录</p>
  </div>
</template>

<style scoped>
.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 560px;
}

thead th {
  padding: 0 12px 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink-3);
  text-align: left;
  letter-spacing: 0.02em;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

tbody td {
  padding: 11px 12px;
  font-size: 13.5px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 62%, transparent);
  vertical-align: middle;
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr.record-row {
  transition: background-color 0.14s var(--ease);
}

tbody tr.record-row:hover {
  background: var(--surface-soft);
}

.ta-r {
  text-align: right;
}

.col-date {
  width: 96px;
  white-space: nowrap;
}

.col-category {
  width: 168px;
}

.date {
  font-family: var(--font-num);
  font-size: 13px;
  color: var(--ink-2);
}

.week {
  margin-left: 6px;
  font-size: 11px;
  color: var(--ink-3);
}

.category {
  display: flex;
  align-items: center;
  gap: 9px;
}

.category__name {
  font-weight: 550;
  white-space: nowrap;
}

.col-note {
  max-width: none;
}

.note {
  display: block;
  color: var(--ink-2);
  font-size: 13px;
}

.col-amount {
  width: 130px;
  white-space: nowrap;
}

.amount {
  font-size: 14px;
  font-weight: 600;
}

.col-actions {
  width: 84px;
}

.actions {
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.14s var(--ease);
}

tbody tr:hover .actions,
.actions:focus-within {
  opacity: 1;
}

.action-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--ink-3);
  transition:
    background-color 0.14s var(--ease),
    color 0.14s var(--ease);
}

.action-btn:hover {
  background: var(--surface-sunken);
  color: var(--ink);
}

.action-btn--danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.table-empty {
  padding: 28px 0 8px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-3);
}

/* 骨架屏 */
.skeleton {
  display: inline-block;
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--surface-sunken) 25%,
    color-mix(in srgb, var(--surface-sunken) 55%, var(--line)) 37%,
    var(--surface-sunken) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.3s ease infinite;
}

.skeleton--sm {
  width: 48px;
}

.skeleton--md {
  width: 80px;
}

.skeleton--lg {
  width: 150px;
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

@media (max-width: 720px) {
  .actions {
    opacity: 1;
    gap: 0;
  }

  /* 手机上隐藏备注列、收紧内边距，保证「日期 / 分类 / 金额 / 操作」一屏放得下 */
  .table {
    min-width: 0;
  }

  thead th {
    padding: 0 8px 9px;
    font-size: 11px;
  }

  tbody td {
    padding: 10px 8px;
  }

  .col-note {
    display: none;
  }

  .col-date {
    width: 62px;
  }

  .date {
    font-size: 12px;
  }

  /* 周几在窄屏上省略，日期本身已足够定位 */
  .week {
    display: none;
  }

  .category {
    gap: 6px;
  }

  .category__name {
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
  }

  .col-amount {
    width: 88px;
  }

  .amount {
    font-size: 13px;
  }

  .col-actions {
    width: 70px;
  }

  .action-btn {
    width: 26px;
    height: 26px;
  }
}
</style>
