<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from './AppIcon.vue'

/**
 * 分页条
 *
 * 只负责「显示页码 + 抛出翻页事件」，请求由父组件发起。
 * 页码策略：总页数 ≤ 7 全部展示；超过 7 页时首尾固定 + 当前页左右各 1 页，
 * 中间用省略号收拢，避免页码把工具栏撑爆。
 */
const props = withDefaults(
  defineProps<{
    /** 当前页，从 1 开始 */
    page: number
    /** 总页数（后端保证 ≥ 1） */
    totalPages: number
    /** 总条数，用于展示「共 N 条」 */
    total: number
    /** 每页条数（保留字段，便于将来展示「每页 N 条」） */
    size?: number
  }>(),
  { size: 10 },
)

/** 页码变化事件，父组件据此重新请求 */
const emit = defineEmits<{ 'update:page': [page: number] }>()

/** 计算要渲染的页码序列，'...' 表示省略号 */
const pageItems = computed<Array<number | '...'>>(() => {
  const total = Math.max(props.totalPages, 1)
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const current = props.page
  const items: Array<number | '...'> = [1]
  // 当前页离首页较远时，用一个省略号代替中间页
  if (current > 4) items.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let page = start; page <= end; page += 1) items.push(page)

  // 离末页较远时同理
  if (current < total - 3) items.push('...')
  items.push(total)
  return items
})

/** 翻页：越界与「点当前页」都直接忽略 */
function go(page: number): void {
  if (page < 1 || page > props.totalPages || page === props.page) return
  emit('update:page', page)
}
</script>

<template>
  <div class="pager">
    <span class="pager__total">共 {{ total }} 条</span>

    <div class="pager__controls">
      <button
        class="pager__btn"
        type="button"
        aria-label="上一页"
        :disabled="page <= 1"
        @click="go(page - 1)"
      >
        <AppIcon name="chevronLeft" :size="15" />
      </button>

      <template v-for="(item, index) in pageItems" :key="`${item}-${index}`">
        <span v-if="item === '...'" class="pager__ellipsis">…</span>
        <button
          v-else
          class="pager__btn pager__btn--num"
          type="button"
          :class="{ 'is-active': item === page }"
          :aria-current="item === page ? 'page' : undefined"
          @click="go(item)"
        >
          {{ item }}
        </button>
      </template>

      <button
        class="pager__btn"
        type="button"
        aria-label="下一页"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      >
        <AppIcon name="chevronRight" :size="15" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 2px 2px;
}

.pager__total {
  font-size: 12.5px;
  color: var(--ink-3);
}

.pager__controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pager__btn {
  display: grid;
  place-items: center;
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--ink-2);
  transition:
    background-color 0.16s var(--ease),
    color 0.16s var(--ease);
}

.pager__btn:hover:not(:disabled) {
  background: var(--surface-sunken);
  color: var(--ink);
}

.pager__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pager__btn--num {
  font-family: var(--font-num);
}

.pager__btn--num.is-active {
  background: var(--brand);
  color: #fff;
  font-weight: 600;
}

.pager__ellipsis {
  padding: 0 2px;
  color: var(--ink-3);
  font-size: 13px;
}
</style>
