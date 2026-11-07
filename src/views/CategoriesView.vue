<script setup lang="ts">
import { computed, ref } from 'vue'

import { errorMessage } from '@/api/client'
import type { Category, TransactionType } from '@/types'
import { useCategoryStore } from '@/stores/category'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'

import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import CategoryDot from '@/components/ui/CategoryDot.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import CategoryFormModal from '@/components/categories/CategoryFormModal.vue'

/**
 * 分类管理
 *
 * 分类是统计的基础：颜色会用于图表，名称会出现在流水列表。
 * 删除受限（该分类下有流水时后端返回 409），避免历史数据失去归属。
 */
const categoryStore = useCategoryStore()
const confirm = useConfirmStore()
const toast = useToastStore()

/** 当前查看的分类类型：支出 / 收入（两个 tab） */
const type = ref<TransactionType>('EXPENSE')
/** 分类表单弹窗开关 */
const formOpen = ref(false)
/** 正在编辑的分类；null 表示新建 */
const editing = ref<Category | null>(null)

/** 类型切换选项 */
const TYPE_OPTIONS = [
  { label: '支出分类', value: 'EXPENSE' },
  { label: '收入分类', value: 'INCOME' },
]

/** 当前 tab 下的分类列表（分类全局只加载一次，这里只做前端过滤） */
const list = computed(() => categoryStore.items.filter((item) => item.type === type.value))

/** 新建：清空编辑对象，默认类型跟随当前 tab */
function openCreate(): void {
  editing.value = null
  formOpen.value = true
}

/** 编辑：把当前分类传进表单做回填 */
function openEdit(category: Category): void {
  editing.value = category
  formOpen.value = true
}

/**
 * 删除分类
 *
 * 分类被流水引用时后端会返回 409，这里统一把错误文案透出，
 * 不做前端预判（前端拿不到「被引用次数」，以服务端为准）。
 */
async function remove(category: Category): Promise<void> {
  const confirmed = await confirm.ask({
    title: '删除分类',
    message: `确定删除「${category.name}」吗？\n若该分类下还有流水，系统会拒绝删除，需要先把那些记录改到别的分类。`,
    confirmText: '删除',
    tone: 'danger',
  })
  if (!confirmed) return

  try {
    await categoryStore.remove(category.id)
    toast.success(`已删除「${category.name}」`)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="categories">
    <section class="card card-pad toolbar">
      <div class="toolbar__left">
        <SegmentedControl v-model="type" :options="TYPE_OPTIONS" />
        <span class="toolbar__count">{{ list.length }} 个分类</span>
      </div>
      <BaseButton variant="primary" @click="openCreate">
        <AppIcon name="plus" :size="15" :stroke-width="2.2" />
        新增分类
      </BaseButton>
    </section>

    <!-- 骨架屏 -->
    <section v-if="categoryStore.loading && !categoryStore.loaded" class="grid">
      <div v-for="n in 6" :key="`skeleton-${n}`" class="cat-card cat-card--skeleton" />
    </section>

    <!-- 分类列表 -->
    <section v-else class="grid">
      <article v-for="category in list" :key="category.id" class="cat-card">
        <div class="cat-card__top">
          <CategoryDot :icon="category.icon" :color="category.color" size="lg" />
          <div class="cat-card__info">
            <p class="cat-card__name">{{ category.name }}</p>
            <p class="cat-card__meta">
              <span class="swatch" :style="{ background: category.color }" />
              {{ category.color.toUpperCase() }}
            </p>
          </div>
        </div>

        <div class="cat-card__actions">
          <button
            class="icon-btn"
            type="button"
            :aria-label="`编辑分类 ${category.name}`"
            title="编辑"
            @click="openEdit(category)"
          >
            <AppIcon name="edit" :size="15" />
          </button>
          <button
            class="icon-btn icon-btn--danger"
            type="button"
            :aria-label="`删除分类 ${category.name}`"
            title="删除"
            @click="remove(category)"
          >
            <AppIcon name="trash" :size="15" />
          </button>
        </div>
      </article>

      <!-- 新增占位卡 -->
      <button class="cat-card cat-card--add" type="button" @click="openCreate">
        <span class="cat-card__add-icon"><AppIcon name="plus" :size="18" /></span>
        <span class="cat-card__add-text">新增分类</span>
      </button>
    </section>

    <p class="tip">
      <AppIcon name="alert" :size="13" />
      分类颜色会同步用于统计图表；修改分类名称或颜色后，历史流水会自动跟随更新。
    </p>

    <CategoryFormModal v-model="formOpen" :category="editing" :default-type="type" />
  </div>
</template>

<style scoped>
.categories {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar__count {
  font-size: 12px;
  color: var(--ink-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

/* ---------- 分类卡 ---------- */
.cat-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  text-align: left;
  transition:
    border-color 0.18s var(--ease),
    box-shadow 0.18s var(--ease),
    transform 0.18s var(--ease);
}

.cat-card:hover {
  border-color: color-mix(in srgb, var(--brand) 22%, var(--line));
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.cat-card--skeleton {
  height: 96px;
  background: linear-gradient(
    90deg,
    var(--surface-soft) 25%,
    var(--surface-sunken) 37%,
    var(--surface-soft) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.3s ease infinite;
  border-style: dashed;
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.cat-card__top {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.cat-card__info {
  min-width: 0;
}

.cat-card__name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-card__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--ink-3);
  font-family: var(--font-num);
}

.swatch {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  display: inline-block;
}

.cat-card__actions {
  display: flex;
  gap: 4px;
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--ink-3);
}

.icon-btn:hover {
  background: var(--surface-sunken);
  color: var(--ink);
}

.icon-btn--danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

/* ---------- 新增卡 ---------- */
.cat-card--add {
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-style: dashed;
  background: transparent;
  color: var(--ink-3);
  min-height: 128px;
}

.cat-card--add:hover {
  color: var(--brand);
  border-color: var(--brand);
  background: var(--brand-soft);
}

.cat-card__add-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px dashed currentColor;
}

.cat-card__add-text {
  font-size: 12.5px;
  font-weight: 550;
}

.tip {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12px;
  color: var(--ink-3);
  padding: 0 4px;
  line-height: 1.6;
}
</style>
