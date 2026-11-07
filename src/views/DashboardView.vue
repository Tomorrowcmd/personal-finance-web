<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { errorMessage } from '@/api/client'
import { budgetApi } from '@/api/budgets'
import { statsApi } from '@/api/stats'
import { transactionApi } from '@/api/transactions'
import type { Budget, CategoryStat, MonthlyPoint, Summary, Transaction } from '@/types'
import { buildCategoryDonutOption, buildTrendOption } from '@/utils/chartOptions'
import {
  addMonths,
  currentMonth,
  daysInMonth,
  endOfMonth,
  formatDateLabel,
  monthLabel,
  startOfMonth,
  todayISO,
} from '@/utils/date'
import { formatCompact, formatCurrency, formatPercent } from '@/utils/format'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useSyncStore } from '@/stores/sync'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'

import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import TransactionTable from '@/components/records/TransactionTable.vue'

/**
 * 图表组件异步加载
 *
 * ECharts 单包约 540 KB（gzip 183 KB），同步 import 会阻塞首屏渲染。
 * 改成 defineAsyncComponent 后，这个 chunk 在页面挂载后并行加载，
 * KPI、预算卡、列表等文字内容可以先显示出来。
 */
const BaseChart = defineAsyncComponent(() => import('@/components/charts/BaseChart.vue'))

/**
 * 总览页
 *
 * 一次并发拉取 5 组数据（汇总 / 月度趋势 / 分类占比 / 预算 / 最近记录），
 * 任意一笔增删改都会通过 sync.version 触发整体重载。
 */
const router = useRouter()
const ui = useUiStore()
const sync = useSyncStore()
const toast = useToastStore()

/** 当前查看的月份（yyyy-MM），默认本月，可通过右上角切换历史月份 */
const month = ref(currentMonth())
/** 首次/切换月份时的加载态，用于表格骨架屏 */
const loading = ref(true)

/** 本月汇总：收入、支出、结余、笔数 */
const summary = ref<Summary>({ income: 0, expense: 0, balance: 0, count: 0 })
/** 近 6 个月序列（含当前月），用于趋势图 */
const monthly = ref<MonthlyPoint[]>([])
/** 当前月的支出分类占比（按金额降序） */
const categoryStats = ref<CategoryStat[]>([])
/** 当前月预算；null 表示还没加载完，totalAmount = 0 表示未设置 */
const budget = ref<Budget | null>(null)
/** 当前月最近 5 笔流水 */
const recent = ref<Transaction[]>([])

/** 是否处于本月（决定「下个月」按钮是否可点、剩余天数是否有意义） */
const isCurrentMonth = computed(() => month.value === currentMonth())

/** 按时间段打招呼，让页面有点温度 */
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

/** 上个月的收支点，用于计算环比 */
const previousPoint = computed<MonthlyPoint | undefined>(() => {
  const list = monthly.value
  return list.length >= 2 ? list[list.length - 2] : undefined
})

/**
 * 支出环比
 *
 * 用「当前月支出」对比「序列里倒数第二个点（上个月）」。
 * 上月支出为 0 时返回 null（没有可比基数，UI 改为显示日期）。
 */
const expenseDelta = computed<number | null>(() => {
  const previous = previousPoint.value
  if (!previous || previous.expense <= 0) return null
  return ((summary.value.expense - previous.expense) / previous.expense) * 100
})

/** 预算使用百分比；未设置预算时按 0 处理，避免除零得到 Infinity */
const budgetPercent = computed(() => {
  const value = budget.value
  if (!value || value.totalAmount <= 0) return 0
  return (value.totalSpent / value.totalAmount) * 100
})

/** 预算剩余，最低显示 0（超支时由进度条与颜色提示，不显示负数余额） */
const budgetRemaining = computed(() =>
  Math.max((budget.value?.totalAmount ?? 0) - (budget.value?.totalSpent ?? 0), 0),
)

/** 本月剩余天数（历史月份为 0） */
const daysLeft = computed(() => {
  if (!isCurrentMonth.value) return 0
  return Math.max(daysInMonth(month.value) - new Date().getDate(), 0)
})

/** 剩余天数的「日均可用」；历史月份没有剩余天数，直接展示剩余额度 */
const dailyAvailable = computed(() =>
  daysLeft.value > 0 ? budgetRemaining.value / daysLeft.value : budgetRemaining.value,
)

/** 有没有任何收支数据：全为 0 时图表换成空状态，避免画一条贴地的线 */
const hasTrend = computed(() =>
  monthly.value.some((point) => point.income > 0 || point.expense > 0),
)

/** 本月是否已有支出分类（决定环形图还是空状态） */
const hasCategory = computed(() => categoryStats.value.length > 0)

/** 图例最多展示 6 项，多余合并成「其他」，避免卡片被撑太长 */
const legend = computed<CategoryStat[]>(() => {
  const list = categoryStats.value
  if (list.length <= 6) return list

  const head = list.slice(0, 5)
  const rest = list.slice(5)
  const restAmount = rest.reduce((sum, item) => sum + item.amount, 0)
  const total = list.reduce((sum, item) => sum + item.amount, 0)

  return [
    ...head,
    {
      categoryId: -1,
      name: '其他',
      icon: '•',
      color: '#8A94A6',
      amount: restAmount,
      percent: total > 0 ? (restAmount / total) * 100 : 0,
    },
  ]
})

// 主题变化时重新生成配置（ECharts 读不到 CSS 变量，只能整份替换）
const trendOption = computed(() => buildTrendOption(monthly.value, ui.theme))
const donutOption = computed(() => buildCategoryDonutOption(categoryStats.value, ui.theme))

/** 请求竞态守卫：连续切月时只接受最后一次请求的结果 */
const latest = useLatestRequest()

/**
 * 拉取整页数据
 *
 * 5 个请求互不依赖，用 Promise.all 并发，整体耗时取决于最慢的一个。
 * 任一失败都会走到 catch（通常是登录失效或后端未启动），失败时不覆盖旧数据。
 * 若返回时已切到别的月份（有更新的请求），丢弃本次结果。
 */
async function load(): Promise<void> {
  const seq = latest.next()
  loading.value = true
  // 当前月区间：1 号 00:00 ~ 月末，用于汇总、分类统计、最近记录
  const range = { startDate: startOfMonth(month.value), endDate: endOfMonth(month.value) }

  try {
    const [summaryData, monthlyData, categoryData, budgetData, recentPage] = await Promise.all([
      // 本月收入/支出/结余/笔数
      transactionApi.summary(range),
      // 近 6 个月趋势（包含当前选中的月份）
      statsApi.monthly(6, month.value),
      // 本月支出分类占比
      statsApi.categories({ ...range, type: 'EXPENSE' }),
      // 本月预算（未设置时返回 totalAmount = 0）
      budgetApi.get(month.value),
      // 最近 5 笔（只取第一页即可）
      transactionApi.page({ ...range, page: 1, size: 5 }),
    ])

    if (!latest.isLatest(seq)) return

    summary.value = summaryData
    monthly.value = monthlyData
    categoryStats.value = categoryData
    budget.value = budgetData
    recent.value = recentPage.items
  } catch (error) {
    if (!latest.isLatest(seq)) return
    toast.error(errorMessage(error))
  } finally {
    if (latest.isLatest(seq)) loading.value = false
  }
}

// 切换月份或任意一笔数据变更（sync.version 自增）时整体重载
// immediate: true： 页面一打开就先调用一次load, 把当前月份数据拉出来
watch([month, () => sync.version], load, { immediate: true })

/** 跳转到预算页（从预算卡片右上角「调整」进入） */
function goBudget(): void {
  void router.push('/budget')
}
</script>

<template>
  <div class="dashboard">
    <!-- 结余概览 -->
    <section class="hero">
      <div class="hero__main">
        <p class="hero__greeting">{{ greeting }}，这是 {{ monthLabel(month) }} 的账</p>
        <p class="hero__label">本月结余</p>
        <p class="hero__value num">{{ formatCurrency(summary.balance) }}</p>

        <div class="hero__meta">
          <span class="hero__meta-item">
            <i class="dot dot--income" />收入
            <b class="num">{{ formatCurrency(summary.income) }}</b>
          </span>
          <span class="hero__meta-item">
            <i class="dot dot--expense" />支出
            <b class="num">{{ formatCurrency(summary.expense) }}</b>
          </span>
          <span class="hero__meta-item">
            共 <b class="num">{{ summary.count }}</b> 笔
          </span>
        </div>
      </div>

      <div class="hero__side">
        <div class="month-nav">
          <button
            class="month-nav__btn"
            type="button"
            aria-label="上一个月"
            @click="month = addMonths(month, -1)"
          >
            <AppIcon name="chevronLeft" :size="15" />
          </button>
          <span class="month-nav__label num">{{ monthLabel(month) }}</span>
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

        <p v-if="expenseDelta !== null" class="hero__delta" :class="{ 'is-up': expenseDelta > 0 }">
          支出较上月 {{ expenseDelta > 0 ? '+' : '' }}{{ formatPercent(expenseDelta) }}
        </p>
        <p v-else class="hero__delta hero__delta--muted">今天 {{ formatDateLabel(todayISO()) }}</p>
      </div>
    </section>

    <!-- 预算进度 -->
    <section class="card card-pad budget-card">
      <div class="card-head">
        <div>
          <p class="card-title">本月预算</p>
          <p class="card-subtitle">
            {{
              budget && budget.totalAmount > 0
                ? `已用 ${formatPercent(budgetPercent, 0)}`
                : '还没有设置'
            }}
          </p>
        </div>
        <BaseButton variant="ghost" size="sm" @click="goBudget">调整</BaseButton>
      </div>

      <!-- 加载中先占位，避免「尚未设置本月预算」闪一下 -->
      <SkeletonBlock v-if="loading" :height="112" />

      <template v-else-if="budget && budget.totalAmount > 0">
        <p class="budget-card__remaining num">
          {{ formatCurrency(budgetRemaining) }}
          <span class="budget-card__remaining-label">可用</span>
        </p>

        <ProgressBar :value="budgetPercent" :height="9" />

        <div class="budget-card__meta">
          <span>预算 {{ formatCurrency(budget.totalAmount) }}</span>
          <span>已花 {{ formatCurrency(budget.totalSpent) }}</span>
        </div>

        <p class="budget-card__hint">
          日均可用 {{ formatCurrency(dailyAvailable) }}
          <template v-if="daysLeft > 0"> · 还剩 {{ daysLeft }} 天</template>
        </p>
      </template>

      <EmptyState
        v-else
        compact
        icon="🎯"
        title="尚未设置本月预算"
        description="设个上限，花钱更有数"
      >
        <template #action>
          <BaseButton variant="soft" size="sm" @click="goBudget">去设置</BaseButton>
        </template>
      </EmptyState>
    </section>

    <!-- 趋势 -->
    <section class="card card-pad trend-card">
      <div class="card-head">
        <div>
          <p class="card-title">近 6 个月收支</p>
          <p class="card-subtitle">柱状为支出，折线为收入</p>
        </div>
        <div class="legend">
          <span class="legend__item"><i class="legend__dot legend__dot--expense" />支出</span>
          <span class="legend__item"><i class="legend__dot legend__dot--income" />收入</span>
        </div>
      </div>

      <!-- 三态：加载中 → 骨架；有数据 → 图表；无数据 → 空状态 -->
      <SkeletonBlock v-if="loading" :height="282" />
      <BaseChart
        v-else-if="hasTrend"
        :option="trendOption"
        :height="282"
        label="近六个月收支趋势图"
      />
      <EmptyState
        v-else
        compact
        icon="📈"
        title="还没有足够数据"
        description="记下第一笔，趋势就出来了"
      />
    </section>

    <!-- 支出构成 -->
    <section class="card card-pad donut-card">
      <div class="card-head">
        <div>
          <p class="card-title">支出构成</p>
          <p class="card-subtitle">{{ monthLabel(month) }} 分类占比</p>
        </div>
      </div>

      <!-- 加载中：用环形占位，避免空状态闪烁 -->
      <SkeletonBlock
        v-if="loading"
        :height="190"
        radius="50%"
        width="190px"
        class="donut-skeleton"
      />

      <template v-else-if="hasCategory">
        <div class="donut">
          <BaseChart :option="donutOption" :height="190" label="支出分类占比环形图" />
          <div class="donut__center">
            <span class="donut__center-label">总支出</span>
            <span class="donut__center-value num">¥{{ formatCompact(summary.expense) }}</span>
          </div>
        </div>

        <ul class="legend-list">
          <li v-for="item in legend" :key="item.categoryId" class="legend-list__item">
            <span class="legend-list__dot" :style="{ background: item.color }" />
            <span class="legend-list__name">{{ item.name }}</span>
            <span class="legend-list__percent num">{{ formatPercent(item.percent, 0) }}</span>
            <span class="legend-list__amount num">{{ formatCurrency(item.amount) }}</span>
          </li>
        </ul>
      </template>

      <EmptyState
        v-else
        compact
        icon="🧾"
        title="本月还没有支出"
        description="记一笔就能看到分布"
      />
    </section>

    <!-- 最近记录 -->
    <section class="card card-pad recent-card">
      <div class="card-head">
        <div>
          <p class="card-title">最近记录</p>
          <p class="card-subtitle">最新 5 笔流水</p>
        </div>
        <RouterLink to="/records" class="link">
          查看全部
          <AppIcon name="arrowRight" :size="14" />
        </RouterLink>
      </div>

      <TransactionTable :items="recent" :loading="loading" readonly />
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}

/* ---------- 结余卡片 ---------- */
.hero {
  grid-column: span 8;
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 26px 28px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    radial-gradient(120% 140% at 100% 0%, rgba(242, 193, 78, 0.26) 0%, transparent 55%),
    radial-gradient(90% 120% at 0% 100%, rgba(0, 0, 0, 0.22) 0%, transparent 60%),
    linear-gradient(135deg, #0f7a63 0%, #0a5a49 55%, #094438 100%);
  box-shadow:
    0 22px 44px -30px rgba(9, 68, 56, 0.85),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

/* 右上角的柔光 */
.hero::after {
  content: '';
  position: absolute;
  right: -80px;
  top: -110px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.18), transparent 66%);
  pointer-events: none;
}

/* 细点阵纹理，增加质感（右下角淡出） */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1px);
  background-size: 18px 18px;
  opacity: 0.22;
  -webkit-mask-image: linear-gradient(120deg, transparent 35%, #000 100%);
  mask-image: linear-gradient(120deg, transparent 35%, #000 100%);
  pointer-events: none;
}

/* 深色主题下整体压暗，避免刺眼 */
:global([data-theme='dark']) .hero {
  background:
    radial-gradient(120% 140% at 100% 0%, rgba(242, 193, 78, 0.16) 0%, transparent 55%),
    linear-gradient(135deg, #10493d 0%, #0c382f 55%, #072722 100%);
  box-shadow: 0 18px 40px -26px rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.hero__main {
  min-width: 0;
}

.hero__greeting {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
  margin-bottom: 14px;
}

.hero__label {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.72);
  letter-spacing: 0.02em;
}

.hero__value {
  margin-top: 4px;
  font-size: 40px;
  font-weight: 660;
  letter-spacing: -0.04em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 16px;
}

.hero__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.72);
}

.hero__meta-item b {
  color: #fff;
  font-weight: 600;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.dot--income {
  background: #7fe0c2;
}

.dot--expense {
  background: #ffb3a2;
}

.hero__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  flex: none;
}

.month-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.month-nav__btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.85);
  transition: background-color 0.16s var(--ease);
}

.month-nav__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
}

.month-nav__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.month-nav__label {
  padding: 0 6px;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.hero__delta {
  font-size: 11.5px;
  color: #a8e8d3;
  background: rgba(255, 255, 255, 0.1);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
}

.hero__delta.is-up {
  color: #ffc4b6;
}

.hero__delta--muted {
  color: rgba(255, 255, 255, 0.6);
}

/* ---------- 预算卡 ---------- */
.budget-card {
  grid-column: span 4;
  display: flex;
  flex-direction: column;
}

.budget-card__remaining {
  font-size: 26px;
  font-weight: 660;
  letter-spacing: -0.03em;
  line-height: 1.2;
  margin-bottom: 12px;
}

.budget-card__remaining-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-3);
  margin-left: 4px;
  letter-spacing: 0;
}

.budget-card__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--ink-3);
}

.budget-card__hint {
  margin-top: auto;
  padding-top: 12px;
  font-size: 11.5px;
  color: var(--ink-3);
}

/* ---------- 图表卡 ---------- */
.trend-card {
  grid-column: span 8;
}

.donut-card {
  grid-column: span 4;
  display: flex;
  flex-direction: column;
}

.donut {
  position: relative;
}

/* 加载态的环形占位：居中，与真实图表同尺寸 */
.donut-skeleton {
  margin: 0 auto;
}

.donut__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  pointer-events: none;
}

.donut__center-label {
  font-size: 11px;
  color: var(--ink-3);
}

.donut__center-value {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.legend {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
}

.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--ink-3);
}

.legend__dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  display: inline-block;
}

.legend__dot--expense {
  background: var(--expense);
}

.legend__dot--income {
  background: var(--income);
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 6px;
}

.legend-list__item {
  display: grid;
  grid-template-columns: 8px 1fr auto auto;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.legend-list__dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
}

.legend-list__name {
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-list__percent {
  color: var(--ink-3);
  font-size: 11.5px;
}

.legend-list__amount {
  color: var(--ink);
  font-weight: 550;
  min-width: 62px;
  text-align: right;
}

/* ---------- 最近记录 ---------- */
.recent-card {
  grid-column: span 12;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--brand);
  white-space: nowrap;
}

.link:hover {
  color: var(--brand-strong);
}

/* ---------- 响应式 ---------- */
@media (max-width: 1080px) {
  .hero,
  .budget-card,
  .trend-card,
  .donut-card {
    grid-column: span 12;
  }

  .hero {
    flex-direction: column;
  }

  .hero__side {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .hero {
    padding: 20px;
  }

  .hero__value {
    font-size: 31px;
  }

  .card-pad {
    padding: 16px;
  }
}
</style>
