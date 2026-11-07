<script setup lang="ts">
import type { Transaction } from '@/types'
import { formatSignedAmount } from '@/utils/format'
import { formatDateLabel } from '@/utils/date'

import AppIcon from '@/components/ui/AppIcon.vue'
import CategoryDot from '@/components/ui/CategoryDot.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

/**
 * 流水表格（Element Plus 版）
 *
 * 用 el-table 承载，保留原有 props / 事件：
 * - items / loading / readonly
 * - edit / remove 事件
 * 分类图标仍是后端返回的 emoji（CategoryDot），不做替换。
 */
withDefaults(
  defineProps<{
    /** 当前页流水 */
    items: Transaction[]
    /** 加载中：渲染骨架行 */
    loading?: boolean
    /** 只读：隐藏操作列 */
    readonly?: boolean
  }>(),
  { loading: false, readonly: false },
)

/** 编辑 / 删除交给父组件 */
const emit = defineEmits<{
  edit: [transaction: Transaction]
  remove: [transaction: Transaction]
}>()

/** 取日期里的「周X」部分 */
function weekdayOf(iso: string): string {
  return formatDateLabel(iso).split(' ')[1] ?? ''
}
</script>

<template>
  <!-- 加载态：用等宽骨架行占位 -->
  <div v-if="loading" class="table-skeleton">
    <SkeletonBlock v-for="n in 5" :key="n" :height="18" radius="6px" />
  </div>

  <el-table v-else :data="items" row-key="id" class="tx-table" empty-text="当前条件下没有记录">
    <!-- 日期：月-日 + 周几 -->
    <el-table-column label="日期" width="120">
      <template #default="{ row }">
        <span class="date num">{{ row.date.slice(5) }}</span>
        <span class="week">{{ weekdayOf(row.date) }}</span>
      </template>
    </el-table-column>

    <!-- 分类：emoji（后端数据）+ 名称 -->
    <el-table-column label="分类" width="160">
      <template #default="{ row }">
        <div class="category">
          <CategoryDot :icon="row.categoryIcon" :color="row.categoryColor" size="sm" />
          <span class="category__name">{{ row.categoryName }}</span>
        </div>
      </template>
    </el-table-column>

    <!-- 备注：窄屏隐藏（见样式） -->
    <el-table-column label="备注" prop="note" min-width="180" class-name="col-note">
      <template #default="{ row }">
        <span class="note" :title="row.note">{{ row.note || '—' }}</span>
      </template>
    </el-table-column>

    <!-- 金额：右对齐、按类型着色 -->
    <el-table-column label="金额" width="132" align="right">
      <template #default="{ row }">
        <span class="amount num" :class="row.type === 'INCOME' ? 'text-income' : 'text-expense'">
          {{ formatSignedAmount(row.amount, row.type) }}
        </span>
      </template>
    </el-table-column>

    <!-- 操作 -->
    <el-table-column v-if="!readonly" label="操作" width="92" align="right">
      <template #default="{ row }">
        <div class="actions">
          <el-button
            text
            circle
            size="small"
            :aria-label="`编辑 ${row.categoryName}`"
            @click="emit('edit', row)"
          >
            <AppIcon name="edit" :size="15" />
          </el-button>
          <el-button
            text
            circle
            size="small"
            class="action-danger"
            :aria-label="`删除 ${row.categoryName}`"
            @click="emit('remove', row)"
          >
            <AppIcon name="trash" :size="15" />
          </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.table-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 4px;
}

.tx-table {
  --el-table-border-color: transparent;
  width: 100%;
}

.tx-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.tx-table :deep(th.el-table__cell) {
  padding: 0 12px 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink-3);
  border-bottom: 1px solid var(--line);
}

.tx-table :deep(td.el-table__cell) {
  padding: 11px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 62%, transparent);
}

.tx-table :deep(.el-table__row:last-child td) {
  border-bottom: none;
}

.tx-table :deep(.el-table__row:hover > td) {
  background: var(--surface-soft);
}

.date {
  font-family: var(--font-num);
  font-size: 13px;
  color: var(--ink-2);
  white-space: nowrap;
}

.week {
  margin-left: 6px;
  font-size: 11px;
  color: var(--ink-3);
  white-space: nowrap;
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

.note {
  display: block;
  color: var(--ink-2);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  font-size: 14px;
  font-weight: 600;
}

.actions {
  display: inline-flex;
  gap: 2px;
  justify-content: flex-end;
}

.action-danger:hover {
  color: var(--danger);
  background: var(--danger-soft);
}

/* 手机上隐藏备注列，保证日期/分类/金额一屏放得下 */
@media (max-width: 720px) {
  .tx-table :deep(.col-note) {
    display: none;
  }

  .tx-table :deep(th.el-table__cell),
  .tx-table :deep(td.el-table__cell) {
    padding-left: 8px;
    padding-right: 8px;
  }

  .category__name {
    max-width: 84px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
