<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { budgetApi } from '@/api/budgets'
import { errorMessage } from '@/api/client'
import { statsApi } from '@/api/stats'
import type { Budget, BudgetPayload, CategoryStat } from '@/types'
import {
  addMonths,
  currentMonth,
  daysInMonth,
  endOfMonth,
  monthLabel,
  startOfMonth,
} from '@/utils/date'
import { formatCurrency, formatPercent, roundMoney } from '@/utils/format'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useCategoryStore } from '@/stores/category'
import { useConfirmStore } from '@/stores/confirm'
import { useSyncStore } from '@/stores/sync'
import { useToastStore } from '@/stores/toast'

import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import CategoryDot from '@/components/ui/CategoryDot.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'

/**
 * 预算管理
 *
 * - 月度总预算 + 分类预算，均由用户手动填写
 * - 「已花费」不落库，实时从流水汇总（后端计算后返回）
 * - 编辑状态与已保存状态做快照比对，只有改动过才允许保存
 */
const categoryStore = useCategoryStore()
const confirm = useConfirmStore()
const sync = useSyncStore()
const toast = useToastStore()

/** 正在查看/编辑的月份（yyyy-MM） */
const month = ref(currentMonth())
/** 页面数据加载态 */
const loading = ref(true)
/** 保存请求进行中，防止重复提交 */
const saving = ref(false)

/** 当月各分类的实际支出（来自统计接口，用于展示「已花」） */
const categoryStats = ref<CategoryStat[]>([])

/** 总预算输入框的草稿值（字符串，允许用户输入中间态如 "800."） */
const draftTotal = ref('0')
/** 分类预算草稿：key 是分类 id 的字符串形式，value 是输入框原值 */
const draftItems = ref<Record<string, string>>({})
/** 载入时的快照，用于判断是否有未保存修改 */
const baseline = ref('')

/** 只有支出分类才可以设预算 */
const expenseCategories = computed(() => categoryStore.expenseCategories)
/** 是否本月：决定「下个月」按钮可用性与剩余天数 */
const isCurrentMonth = computed(() => month.value === currentMonth())

/** 分类 id -> 当月实际支出，避免在模板里反复 find */
const spentMap = computed(() => {
  const map = new Map<number, number>()
  for (const item of categoryStats.value) map.set(item.categoryId, item.amount)
  return map
})

/** 当月总支出（所有支出分类之和，不只是设了预算的分类） */
const totalSpent = computed(() =>
  roundMoney(categoryStats.value.reduce((sum, item) => sum + item.amount, 0)),
)

/** 解析后的总预算；空值/非法值/负数一律按 0 处理 */
const totalAmount = computed(() => {
  const parsed = Number(draftTotal.value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
})

/** 剩余额度（可能为负，表示超支） */
const remaining = computed(() => roundMoney(totalAmount.value - totalSpent.value))

/** 总预算使用百分比；未设总预算时为 0 */
const totalPercent = computed(() =>
  totalAmount.value > 0 ? (totalSpent.value / totalAmount.value) * 100 : 0,
)

/** 分类预算合计，用于提示「分类之和超过总额」 */
const itemsSum = computed(() =>
  expenseCategories.value.reduce((sum, category) => {
    const value = Number(draftItems.value[String(category.id)] ?? 0)
    return sum + (Number.isFinite(value) && value > 0 ? value : 0)
  }, 0),
)

const itemsOver = computed(() => totalAmount.value > 0 && itemsSum.value > totalAmount.value)

/** 本月剩余天数，用于计算日均可用 */
const daysLeft = computed(() => {
  if (!isCurrentMonth.value) return 0
  return Math.max(daysInMonth(month.value) - new Date().getDate(), 0)
})

const dailyAvailable = computed(() => {
  const days = daysLeft.value > 0 ? daysLeft.value : daysInMonth(month.value)
  return remaining.value / Math.max(days, 1)
})

/**
 * 超支/预警提示
 *
 * 超过 100% 用红色提示具体超支金额；达到 80% 用橙色提醒；
 * 未设置总预算（0）时不提示。
 */
const alert = computed<{ tone: 'warning' | 'danger'; text: string } | null>(() => {
  if (totalAmount.value <= 0) return null
  if (totalSpent.value > totalAmount.value) {
    return {
      tone: 'danger',
      text: `本月已超支 ${formatCurrency(totalSpent.value - totalAmount.value)}，建议调高总额或收紧后面几天的支出`,
    }
  }
  if (totalPercent.value >= 80) {
    return {
      tone: 'warning',
      text: `预算已使用 ${formatPercent(totalPercent.value, 0)}，接下来注意控制`,
    }
  }
  return null
})

/**
 * 当前编辑内容的指纹
 *
 * 把「总额 + 每个分类的金额」序列化成字符串；
 * 与载入时的 baseline 比较即可判断是否有未保存修改（无需逐字段 dirty 标记）。
 */
function snapshot(): string {
  const items = expenseCategories.value.map((category) => [
    category.id,
    Number(draftItems.value[String(category.id)] ?? 0) || 0,
  ])
  return JSON.stringify({ total: Number(draftTotal.value) || 0, items })
}

/** 有改动且已载入过才允许保存 */
const dirty = computed(() => baseline.value !== '' && snapshot() !== baseline.value)

/** 读取某分类的草稿金额（空串表示用户留空 = 不单独限制） */
function amountOf(categoryId: number): string {
  return draftItems.value[String(categoryId)] ?? ''
}

/** 分类预算输入：用不可变替换触发响应式更新（对象 key 动态增删） */
function onAmountInput(categoryId: number, event: Event): void {
  const value = (event.target as HTMLInputElement).value
  draftItems.value = { ...draftItems.value, [String(categoryId)]: value }
}

/**
 * 用接口数据回填草稿
 *
 * 只回填支出分类；接口里没有的（未设置预算）保持空串，
 * 最后记录 baseline，作为「是否改动」的基准。
 */
function fillDraft(data: Budget): void {
  draftTotal.value = data.totalAmount > 0 ? String(data.totalAmount) : ''
  const next: Record<string, string> = {}
  for (const category of expenseCategories.value) {
    const matched = data.items.find((item) => item.categoryId === category.id)
    next[String(category.id)] = matched && matched.amount > 0 ? String(matched.amount) : ''
  }
  draftItems.value = next
  baseline.value = snapshot()
}

/** 请求竞态守卫：连续切月时只接受最后一次请求的结果 */
const latest = useLatestRequest()

/**
 * 加载页面数据
 *
 * 1. 先确保分类已加载（否则渲染不出分类行）；
 * 2. 并行取「预算设置」与「当月各分类支出」；
 * 3. 回填草稿并记录 baseline。
 * 若返回时已切到别的月份，丢弃本次结果，避免旧草稿覆盖新月份的输入。
 */
async function load(): Promise<void> {
  const seq = latest.next()
  loading.value = true
  try {
    await categoryStore.load()

    const range = { startDate: startOfMonth(month.value), endDate: endOfMonth(month.value) }
    const [budgetData, statsData] = await Promise.all([
      budgetApi.get(month.value),
      statsApi.categories({ ...range, type: 'EXPENSE' }),
    ])

    if (!latest.isLatest(seq)) return

    categoryStats.value = statsData
    fillDraft(budgetData)
  } catch (error) {
    if (!latest.isLatest(seq)) return
    toast.error(errorMessage(error))
  } finally {
    if (latest.isLatest(seq)) loading.value = false
  }
}

// 换月或保存成功后（sync.version 自增）重新加载，草稿随之重置
watch([month, () => sync.version], load, { immediate: true })

/**
 * 保存预算
 *
 * 提交前做两件事：
 * 1. 过滤掉金额为 0 的分类，只提交真正设了额度的；
 * 2. 若分类之和超过总额，先弹确认框让用户确认（不阻断，属于允许的操作）。
 * 保存成功后 bump 数据版本，页面会重新加载并刷新 baseline。
 */
async function save(): Promise<void> {
  if (saving.value) return

  const items = expenseCategories.value
    .map((category) => ({
      categoryId: category.id,
      amount: Number(draftItems.value[String(category.id)] ?? 0) || 0,
    }))
    .filter((item) => item.amount > 0)
    .map((item) => ({ ...item, amount: roundMoney(item.amount) }))

  if (itemsOver.value) {
    const confirmed = await confirm.ask({
      title: '分类预算超过总额',
      message: `分类预算合计 ${formatCurrency(itemsSum.value)} 已超过总额 ${formatCurrency(totalAmount.value)}，仍要保存吗？`,
      confirmText: '仍然保存',
    })
    if (!confirmed) return
  }

  const payload: BudgetPayload = {
    totalAmount: roundMoney(totalAmount.value),
    items,
  }

  saving.value = true
  try {
    await budgetApi.save(month.value, payload)
    toast.success('预算已保存')
    sync.bump()
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    saving.value = false
  }
}

/** 某分类当月已花金额 */
function spentOf(categoryId: number): number {
  return spentMap.value.get(categoryId) ?? 0
}

/** 某分类的使用百分比；未设预算（≤0）时返回 0，UI 显示「—」 */
function percentOf(categoryId: number): number {
  const budgetAmount = Number(draftItems.value[String(categoryId)] ?? 0)
  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) return 0
  return (spentOf(categoryId) / budgetAmount) * 100
}
</script>

<template>
  <div class="budget">
    <!-- 总额与进度 -->
    <section class="card card-pad head-card">
      <div class="head-card__top">
        <div class="month-nav">
          <button
            class="month-nav__btn"
            type="button"
            aria-label="上一个月"
            @click="month = addMonths(month, -1)"
          >
            <AppIcon name="chevronLeft" :size="15" />
          </button>
          <span class="month-nav__label">{{ monthLabel(month) }}</span>
          <button
            class="month-nav__btn"
            type="button"
            aria-label="下一个月"
            :disabled="isCurrentMonth"
            @click="month = addMonths(month, 1)"
          >
            <AppIcon name="chevronRight" :size="15" />
          </button>
        </div>

        <BaseButton variant="primary" :disabled="!dirty" :loading="saving" @click="save">
          保存预算
        </BaseButton>
      </div>

      <div class="head-card__body">
        <div class="total-field">
          <p class="total-field__label">本月预算总额</p>
          <div class="total-field__control">
            <span class="total-field__symbol">¥</span>
            <input
              v-model="draftTotal"
              class="total-field__input num"
              inputmode="decimal"
              placeholder="0"
              aria-label="本月预算总额"
            />
          </div>
        </div>

        <div class="head-card__stats">
          <div class="mini-stat">
            <span class="mini-stat__label">已支出</span>
            <b class="mini-stat__value num text-expense">{{ formatCurrency(totalSpent) }}</b>
          </div>
          <div class="mini-stat">
            <span class="mini-stat__label">剩余</span>
            <b class="mini-stat__value num" :class="{ 'text-expense': remaining < 0 }">
              {{ formatCurrency(remaining) }}
            </b>
          </div>
          <div class="mini-stat">
            <span class="mini-stat__label">日均可用</span>
            <b class="mini-stat__value num">{{ formatCurrency(dailyAvailable) }}</b>
          </div>
        </div>
      </div>

      <ProgressBar :value="totalPercent" :height="10" />

      <p v-if="totalAmount > 0" class="head-card__foot">
        已使用 {{ formatPercent(totalPercent, 1) }}
        <template v-if="daysLeft > 0"> · 本月还剩 {{ daysLeft }} 天</template>
        <template v-else> · 历史月份</template>
      </p>
    </section>

    <!-- 超支提示 -->
    <Transition name="fade">
      <div v-if="alert" class="alert" :class="`alert--${alert.tone}`">
        <AppIcon name="alert" :size="16" />
        <span>{{ alert.text }}</span>
      </div>
    </Transition>

    <!-- 分类预算 -->
    <section class="card card-pad">
      <div class="card-head">
        <div>
          <p class="card-title">分类预算</p>
          <p class="card-subtitle">留空表示不单独限制，分类合计需低于总额</p>
        </div>
        <span v-if="itemsOver" class="over-hint">
          合计 {{ formatCurrency(itemsSum) }} 已超过总额
        </span>
      </div>

      <EmptyState
        v-if="expenseCategories.length === 0"
        icon="🏷️"
        title="还没有支出分类"
        description="先到分类管理里创建几个分类"
      >
        <template #action>
          <RouterLink to="/categories">
            <BaseButton variant="soft" size="sm">去创建分类</BaseButton>
          </RouterLink>
        </template>
      </EmptyState>

      <div v-else class="rows">
        <div class="row-head" aria-hidden="true">
          <span>分类</span>
          <span>预算金额</span>
          <span>本月已花</span>
          <span>使用进度</span>
        </div>

        <div v-for="category in expenseCategories" :key="category.id" class="brow">
          <div class="brow__cat">
            <CategoryDot :icon="category.icon" :color="category.color" size="sm" />
            <span class="brow__name">{{ category.name }}</span>
          </div>

          <div class="brow__input">
            <span class="brow__symbol">¥</span>
            <input
              class="brow__field num"
              inputmode="decimal"
              placeholder="不限"
              :value="amountOf(category.id)"
              :aria-label="`${category.name}预算金额`"
              @input="onAmountInput(category.id, $event)"
            />
          </div>

          <div class="brow__spent num">{{ formatCurrency(spentOf(category.id)) }}</div>

          <div class="brow__progress">
            <ProgressBar :value="percentOf(category.id)" :height="6" />
            <span class="brow__percent num">
              {{ percentOf(category.id) > 0 ? formatPercent(percentOf(category.id), 0) : '—' }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.budget {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- 头部卡 ---------- */
.head-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.head-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.month-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
}

.month-nav__btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: var(--ink-2);
}

.month-nav__btn:hover:not(:disabled) {
  background: var(--surface);
  color: var(--ink);
}

.month-nav__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.month-nav__label {
  padding: 0 8px;
  font-size: 13px;
  font-weight: 620;
  white-space: nowrap;
}

.head-card__body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.total-field__label {
  font-size: 12px;
  color: var(--ink-3);
  margin-bottom: 2px;
}

.total-field__control {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.total-field__symbol {
  font-size: 20px;
  color: var(--ink-3);
}

.total-field__input {
  width: 190px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 32px;
  font-weight: 650;
  letter-spacing: -0.03em;
  padding: 0;
  border-bottom: 2px solid var(--line);
  transition: border-color 0.16s var(--ease);
}

.total-field__input:focus {
  border-color: var(--brand);
}

.head-card__stats {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
}

.mini-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mini-stat__label {
  font-size: 11.5px;
  color: var(--ink-3);
}

.mini-stat__value {
  font-size: 16px;
  font-weight: 620;
  letter-spacing: -0.02em;
}

.head-card__foot {
  font-size: 11.5px;
  color: var(--ink-3);
}

/* ---------- 提示条 ---------- */
.alert {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.alert--warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.alert--danger {
  background: var(--danger-soft);
  color: var(--danger);
}

/* ---------- 分类行 ---------- */
.rows {
  display: flex;
  flex-direction: column;
}

.row-head,
.brow {
  display: grid;
  grid-template-columns: minmax(140px, 1.2fr) 150px 130px minmax(160px, 1.6fr);
  align-items: center;
  gap: 14px;
}

.row-head {
  padding: 0 4px 9px;
  font-size: 11px;
  color: var(--ink-3);
  border-bottom: 1px solid var(--line);
}

.brow {
  padding: 11px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
}

.brow:last-child {
  border-bottom: none;
}

.brow__cat {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.brow__name {
  font-size: 13.5px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brow__input {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  transition:
    border-color 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
}

.brow__input:focus-within {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-ring);
}

.brow__symbol {
  font-size: 12px;
  color: var(--ink-3);
}

.brow__field {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
}

.brow__field::placeholder {
  color: var(--ink-3);
  font-size: 12px;
}

.brow__spent {
  font-size: 13px;
  color: var(--ink-2);
}

.brow__progress {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brow__percent {
  font-size: 11.5px;
  color: var(--ink-3);
  min-width: 34px;
  text-align: right;
}

.over-hint {
  font-size: 11.5px;
  color: var(--warning);
  background: var(--warning-soft);
  padding: 3px 9px;
  border-radius: var(--radius-pill);
}

@media (max-width: 860px) {
  .row-head {
    display: none;
  }

  .brow {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'cat input'
      'spent progress';
    gap: 8px 12px;
    padding: 14px 2px;
  }

  .brow__cat {
    grid-area: cat;
  }

  .brow__input {
    grid-area: input;
    width: 130px;
  }

  .brow__spent {
    grid-area: spent;
    font-size: 12px;
  }

  .brow__progress {
    grid-area: progress;
    justify-content: flex-end;
  }

  .head-card__stats {
    gap: 20px;
  }

  .total-field__input {
    width: 140px;
    font-size: 27px;
  }
}
</style>
