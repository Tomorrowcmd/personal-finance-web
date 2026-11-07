<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { errorMessage } from '@/api/client'
import { transactionApi } from '@/api/transactions'
import type { Summary, Transaction, TransactionQuery, TransactionType } from '@/types'
import {
  currentMonth,
  endOfMonth,
  getRangePreset,
  startOfMonth,
  type RangePresetKey,
} from '@/utils/date'
import { formatCurrency } from '@/utils/format'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useCategoryStore } from '@/stores/category'
import { useConfirmStore } from '@/stores/confirm'
import { useSyncStore } from '@/stores/sync'
import { useToastStore } from '@/stores/toast'

import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import TransactionFormModal from '@/components/records/TransactionFormModal.vue'
import TransactionTable from '@/components/records/TransactionTable.vue'

/**
 * 收支明细
 *
 * 筛选条件（时间区间 / 类型 / 分类 / 关键字）统一收敛成 TransactionQuery，
 * 列表、汇总、导出三处共用同一份查询条件，保证「看到什么就导出什么」。
 */
const toast = useToastStore()
const confirm = useConfirmStore()
const sync = useSyncStore()
const categoryStore = useCategoryStore()

/** 默认每页条数（与后端 size 参数对应） */
const DEFAULT_SIZE = 10

/* ---------------- 筛选状态 ---------------- */
/** 时间快捷选项：本月/上月/近30天/今年/全部，custom 时用 custom 对象里的自定义区间 */
const preset = ref<RangePresetKey>('thisMonth')
/** 自定义区间（只有 preset === 'custom' 时才生效） */
const custom = reactive({
  startDate: startOfMonth(currentMonth()),
  endDate: endOfMonth(currentMonth()),
})
/** 收支类型过滤：'' 表示全部 */
const type = ref<'' | TransactionType>('')
/** 分类过滤：下拉框的 value 统一是字符串，提交查询时再转成 number */
const categoryId = ref<string>('')
/** 关键字（备注 / 分类名），输入后防抖 320ms 再请求 */
const keyword = ref('')

/* ---------------- 列表状态 ---------------- */
/** 当前页码，从 1 开始 */
const page = ref(1)
/** 每页条数 */
const size = ref(DEFAULT_SIZE)
/** 当前页数据 */
const items = ref<Transaction[]>([])
/** 满足条件的总条数 */
const total = ref(0)
/** 总页数（后端保证至少为 1） */
const totalPages = ref(1)
/** 当前筛选条件下的汇总（收入/支出/结余/笔数） */
const summary = ref<Summary>({ income: 0, expense: 0, balance: 0, count: 0 })
/** 列表加载态（骨架屏） */
const loading = ref(true)
/** 导出按钮的独立 loading，避免导出时整张表变骨架屏 */
const exporting = ref(false)

/* ---------------- 弹窗 ---------------- */
/** 记账弹窗开关（新建与编辑共用） */
const formOpen = ref(false)
/** 正在编辑的记录；null 表示新建 */
const editing = ref<Transaction | null>(null)

/** 前端 UI 用的快捷区间文案，key 与 date.ts 的 RangePresetKey 一一对应 */
const PRESETS: Array<{ key: RangePresetKey; label: string }> = [
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'last30', label: '近30天' },
  { key: 'thisYear', label: '今年' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
]

/** 类型分段控件的选项 */
const TYPE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '支出', value: 'EXPENSE' },
  { label: '收入', value: 'INCOME' },
]

/** 实际生效的日期区间 */
const range = computed(() =>
  preset.value === 'custom'
    ? { startDate: custom.startDate, endDate: custom.endDate }
    : getRangePreset(preset.value).range,
)

/** 分类下拉：切换收支类型后只显示对应分类 */
const categoryOptions = computed(() => {
  const list = type.value
    ? categoryStore.items.filter((item) => item.type === type.value)
    : categoryStore.items
  return [
    { label: '全部分类', value: '' },
    ...list.map((item) => ({ label: `${item.icon} ${item.name}`, value: item.id })),
  ]
})

/**
 * 最终查询条件
 *
 * 列表、汇总、导出三个请求都从这里取，保证「看到的数据」与「导出的数据」一致。
 * 空值（空串）会在 api 层被 cleanParams 剔除，不会拼成 ?type=&keyword=。
 */
const query = computed<TransactionQuery>(() => ({
  ...range.value,
  type: type.value,
  // 下拉框给的是字符串，这里转成数字；空串表示不过滤
  categoryId: categoryId.value ? Number(categoryId.value) : '',
  keyword: keyword.value.trim(),
  page: page.value,
  size: size.value,
}))

/** 请求竞态守卫：快速切换筛选时，只接受最后一次请求的结果 */
const latest = useLatestRequest()

/**
 * 拉取列表 + 汇总
 *
 * 两个请求共用同一份筛选条件，并发执行；汇总只依赖筛选条件，与分页无关。
 * 若本次请求返回时已有更新的请求发出（用户又改了筛选），直接丢弃结果，
 * 避免旧数据覆盖新数据。
 */
async function load(): Promise<void> {
  const seq = latest.next()
  loading.value = true
  try {
    const [pageData, summaryData] = await Promise.all([
      transactionApi.page(query.value),
      transactionApi.summary(query.value),
    ])
    if (!latest.isLatest(seq)) return

    items.value = pageData.items
    total.value = pageData.total
    totalPages.value = pageData.totalPages
    summary.value = summaryData
  } catch (error) {
    if (!latest.isLatest(seq)) return
    toast.error(errorMessage(error))
  } finally {
    // 只有最新一次请求才收起 loading，避免旧请求提前关掉骨架屏
    if (latest.isLatest(seq)) loading.value = false
  }
}

/** 条件变化后回到第一页 */
function reloadFromFirstPage(): void {
  page.value = 1
  void load()
}

// 时间区间或分类变化 → 回到第一页重新查
watch([() => range.value.startDate, () => range.value.endDate, categoryId], reloadFromFirstPage)

// 切换收支类型：若已选分类不属于新类型，清空分类（清空本身会触发上面的 watcher）
watch(type, () => {
  const current = categoryId.value ? categoryStore.byId(Number(categoryId.value)) : undefined
  if (current && type.value && current.type !== type.value) {
    categoryId.value = ''
    return
  }
  reloadFromFirstPage()
})

// 任意增删改（sync.version 自增）后刷新当前页
watch(() => sync.version, load)

// 搜索防抖：停止输入 320ms 后才发请求，避免逐字请求
let searchTimer: number | undefined
watch(keyword, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(reloadFromFirstPage, 320)
})

onMounted(load)
// 组件卸载时清掉未触发的防抖定时器，避免离开页面后仍发请求
onBeforeUnmount(() => window.clearTimeout(searchTimer))

/** 翻页：页码由分页组件传入，直接按新页码请求 */
function onPageChange(next: number): void {
  page.value = next
  void load()
}

/** 打开「记一笔」：清空编辑对象 */
function openCreate(): void {
  editing.value = null
  formOpen.value = true
}

/** 打开编辑：把当前行传进表单做回填 */
function openEdit(item: Transaction): void {
  editing.value = item
  formOpen.value = true
}

/**
 * 删除一条记录
 *
 * 先二次确认（确认框返回 Promise），成功后再 bump 数据版本触发重载。
 * 如果删的是当前页最后一条，页码回退一页，避免停在空白页。
 */
async function remove(item: Transaction): Promise<void> {
  const confirmed = await confirm.ask({
    title: '删除记录',
    message: `确定删除 ${item.date} 的「${item.categoryName}」${formatCurrency(item.amount)} 吗？删除后无法恢复。`,
    confirmText: '删除',
    tone: 'danger',
  })
  if (!confirmed) return

  try {
    await transactionApi.remove(item.id)
    toast.success('记录已删除')
    if (items.value.length === 1 && page.value > 1) page.value -= 1
    sync.bump()
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/**
 * 导出当前筛选结果
 *
 * 复用 query（去掉分页参数由 api 层处理），后端返回 xlsx 二进制流，
 * 前端只负责触发下载并提示文件名。
 */
async function exportExcel(): Promise<void> {
  exporting.value = true
  try {
    const filename = await transactionApi.exportExcel(query.value)
    toast.success(`已导出 ${filename}`)
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="records">
    <!-- 筛选工具条 -->
    <section class="card card-pad toolbar">
      <div class="toolbar__row">
        <SegmentedControl v-model="type" :options="TYPE_OPTIONS" />

        <div class="toolbar__search">
          <BaseInput v-model="keyword" placeholder="搜索备注或分类…" inputmode="search">
            <template #suffix>
              <AppIcon name="search" :size="15" class="search-icon" />
            </template>
          </BaseInput>
        </div>

        <div class="toolbar__actions">
          <BaseButton variant="secondary" :loading="exporting" @click="exportExcel">
            <AppIcon name="download" :size="15" />
            导出 Excel
          </BaseButton>
          <BaseButton variant="primary" @click="openCreate">
            <AppIcon name="plus" :size="15" :stroke-width="2.2" />
            记一笔
          </BaseButton>
        </div>
      </div>

      <div class="toolbar__row toolbar__row--filters">
        <div class="presets">
          <button
            v-for="item in PRESETS"
            :key="item.key"
            type="button"
            class="preset"
            :class="{ 'is-active': preset === item.key }"
            @click="preset = item.key"
          >
            {{ item.label }}
          </button>
        </div>

        <BaseSelect
          v-model="categoryId"
          :options="categoryOptions"
          placeholder=""
          size="sm"
          class="category-select"
        />

        <div v-if="preset === 'custom'" class="custom-range">
          <el-date-picker
            v-model="custom.startDate"
            type="date"
            size="small"
            value-format="YYYY-MM-DD"
            placeholder="开始日期"
            :clearable="false"
            aria-label="开始日期"
          />
          <span class="custom-range__sep">至</span>
          <el-date-picker
            v-model="custom.endDate"
            type="date"
            size="small"
            value-format="YYYY-MM-DD"
            placeholder="结束日期"
            :clearable="false"
            aria-label="结束日期"
          />
        </div>
      </div>
    </section>

    <!-- 结果汇总 -->
    <section class="summary card">
      <div class="summary__item">
        <span class="summary__label">收入</span>
        <b class="summary__value num text-income">{{ formatCurrency(summary.income) }}</b>
      </div>
      <div class="summary__item">
        <span class="summary__label">支出</span>
        <b class="summary__value num text-expense">{{ formatCurrency(summary.expense) }}</b>
      </div>
      <div class="summary__item">
        <span class="summary__label">结余</span>
        <b class="summary__value num">{{ formatCurrency(summary.balance) }}</b>
      </div>
      <div class="summary__item">
        <span class="summary__label">笔数</span>
        <b class="summary__value num">{{ summary.count }}</b>
      </div>
    </section>

    <!-- 列表 -->
    <section class="card card-pad list-card">
      <div class="card-head">
        <div>
          <p class="card-title">流水列表</p>
          <p class="card-subtitle">按日期倒序 · 每页 {{ size }} 条</p>
        </div>
      </div>

      <EmptyState
        v-if="!loading && items.length === 0"
        icon="🔍"
        title="没有符合条件的记录"
        description="换个时间范围或关键字试试，也可以直接记一笔"
      >
        <template #action>
          <BaseButton variant="soft" size="sm" @click="openCreate">记一笔</BaseButton>
        </template>
      </EmptyState>

      <template v-else>
        <TransactionTable :items="items" :loading="loading" @edit="openEdit" @remove="remove" />
        <PaginationBar
          v-if="total > 0"
          :page="page"
          :total-pages="totalPages"
          :total="total"
          :size="size"
          @update:page="onPageChange"
        />
      </template>
    </section>

    <TransactionFormModal v-model="formOpen" :transaction="editing" />
  </div>
</template>

<style scoped>
.records {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- 工具条 ---------- */
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar__row--filters {
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.toolbar__search {
  flex: 1;
  min-width: 180px;
  max-width: 340px;
}

.search-icon {
  color: var(--ink-3);
}

.toolbar__actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.presets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.preset {
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  font-size: 12.5px;
  color: var(--ink-2);
  border: 1px solid transparent;
  transition:
    background-color 0.16s var(--ease),
    color 0.16s var(--ease),
    border-color 0.16s var(--ease);
}

.preset:hover {
  background: var(--surface-soft);
  color: var(--ink);
}

.preset.is-active {
  background: var(--brand-soft);
  color: var(--brand-strong);
  border-color: color-mix(in srgb, var(--brand) 22%, transparent);
  font-weight: 600;
}

.category-select {
  width: 150px;
}

.custom-range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.custom-range :deep(.el-date-editor) {
  width: 140px;
}

.custom-range__sep {
  font-size: 12px;
  color: var(--ink-3);
}

/* ---------- 汇总条 ---------- */
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 14px 20px;
}

.summary__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.summary__label {
  font-size: 11.5px;
  color: var(--ink-3);
}

.summary__value {
  font-size: 16px;
  font-weight: 640;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-card {
  min-height: 320px;
}

@media (max-width: 720px) {
  .toolbar__search {
    max-width: none;
    order: 3;
    flex-basis: 100%;
  }

  .toolbar__actions {
    margin-left: auto;
  }

  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 8px;
  }
}
</style>
