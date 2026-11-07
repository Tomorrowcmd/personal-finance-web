<script setup lang="ts">
/**
 * 分页条（Element Plus 封装）
 *
 * 保留原有 props / 事件（page / totalPages / total / size），
 * 内部用 el-pagination，页码折叠、键盘操作交给 EP。
 */
withDefaults(
  defineProps<{
    /** 当前页，从 1 开始 */
    page: number
    /** 总页数（EP 由 total + page-size 计算，这里保留以兼容原有调用） */
    totalPages: number
    /** 总条数 */
    total: number
    /** 每页条数 */
    size?: number
  }>(),
  { size: 10 },
)

const emit = defineEmits<{ 'update:page': [page: number] }>()

/** 翻页：把 EP 的 current-change 转发成原有事件 */
function onCurrentChange(next: number): void {
  emit('update:page', next)
}
</script>

<template>
  <div class="pager">
    <el-pagination
      :current-page="page"
      :page-size="size"
      :total="total"
      :pager-count="7"
      layout="total, prev, pager, next"
      background
      @current-change="onCurrentChange"
    />
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 14px 2px 2px;
}

.pager :deep(.el-pagination) {
  --el-pagination-button-bg-color: transparent;
  --el-pagination-hover-color: var(--brand);
  font-weight: 500;
}

/* 当前页：品牌色实心 */
.pager :deep(.el-pager li.is-active) {
  background: var(--brand);
  color: #fff;
  font-weight: 600;
}

.pager :deep(.el-pagination__total) {
  color: var(--ink-3);
  font-size: 12.5px;
  margin-right: 8px;
}

@media (max-width: 720px) {
  .pager {
    justify-content: center;
  }

  .pager :deep(.el-pagination__total) {
    display: none;
  }
}
</style>
