<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'

import { errorMessage } from '@/api/client'
import { statsApi } from '@/api/stats'
import type { CategoryStat, MonthlyPoint } from '@/types'
import {
  buildBalanceOption,
  buildCategoryRankingOption,
  buildTrendOption,
} from '@/utils/chartOptions'
import { addMonths, currentMonth, endOfMonth, monthLabel, startOfMonth } from '@/utils/date'
import { formatCurrency, formatPercent, fromCents, roundMoney, toCents } from '@/utils/format'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useSyncStore } from '@/stores/sync'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'

import EmptyState from '@/components/ui/EmptyState.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StatCard from '@/components/ui/StatCard.vue'

/** ECharts 体积大，异步加载，避免统计页首屏被图表拖慢（同总览页） */
const BaseChart = defineAsyncComponent(() => import('@/components/charts/BaseChart.vue'))

/**
 * 统计分析
 *
 * 数据全部来自后端聚合接口：月度序列 + 分类占比。
 * 汇总值（总收入、总支出、储蓄率）由月度序列在前端累加，
 * 用「分」为单位相加，避免浮点误差。
 */
/** 统计区间：本月 / 上月 / 近 3 月 / 近 6 月 / 今年 */
type StatPreset = 'thisMonth' | 'lastMonth' | 'last3' | 'last6' | 'thisYear'

/** 分段控件选项，value 与 StatPreset 对齐 */
const PRESETS: Array<{ label: string; value: StatPreset }> = [
  { label: '本月', value: 'thisMonth' },
  { label: '上月', value: 'lastMonth' },
  { label: '近3月', value: 'last3' },
  { label: '近6月', value: 'last6' },
  { label: '今年', value: 'thisYear' },
]

const ui = useUiStore()
const sync = useSyncStore()
const toast = useToastStore()

/** 当前选中的区间，默认近 6 个月 */
const preset = ref<StatPreset>('last6')
/** 加载态（图表还在拉数据时用于占位） */
const loading = ref(true)
/** 区间内的月度收支序列（后端零填充） */
const monthly = ref<MonthlyPoint[]>([])
/** 区间内的支出分类统计 */
const categoryStats = ref<CategoryStat[]>([])

/** 区间的结束月份：只有「上月」需要回退一个月，其余都截止到本月 */
const endMonth = computed(() =>
  preset.value === 'lastMonth' ? addMonths(currentMonth(), -1) : currentMonth(),
)

/**
 * 需要统计的月份数量
 *
 * 「今年」的月份数 = 当前月份序号（例如 10 月就是 1-10 月），
 * 这样年初打开页面不会出现 9 个全零的月份。
 */
const monthCount = computed(() => {
  switch (preset.value) {
    case 'thisMonth':
    case 'lastMonth':
      return 1
    case 'last3':
      return 3
    case 'last6':
      return 6
    default:
      return Number(currentMonth().slice(5, 7))
  }
})

/** 区间起始月份 = 结束月份往前推 (月份数 - 1)，用于分类统计的日期范围 */
const startMonth = computed(() => addMonths(endMonth.value, -(monthCount.value - 1)))

/**
 * 区间汇总
 *
 * 月度序列里已经是「元」，这里统一转成「分」再累加，
 * 避免 0.1 + 0.2 这类浮点误差让合计对不上。
 */
const totals = computed(() => {
  let incomeCents = 0
  let expenseCents = 0
  for (const point of monthly.value) {
    incomeCents += toCents(point.income)
    expenseCents += toCents(point.expense)
  }
  const income = fromCents(incomeCents)
  const expense = fromCents(expenseCents)
  return {
    income,
    expense,
    balance: fromCents(incomeCents - expenseCents),
    // 储蓄率 = 结余 / 收入；没有收入时按 0 处理，避免出现 -Infinity
    savingRate: incomeCents > 0 ? ((incomeCents - expenseCents) / incomeCents) * 100 : 0,
  }
})

/** 区间文案：单月显示「2026年10月」，多个月显示「2026年5月 - 2026年10月」 */
const periodLabel = computed(() =>
  monthCount.value === 1
    ? monthLabel(endMonth.value)
    : `${monthLabel(startMonth.value)} - ${monthLabel(endMonth.value)}`,
)

/** 区间内是否有数据，决定画图还是显示空状态 */
const hasData = computed(() => totals.value.income > 0 || totals.value.expense > 0)

// 主题变化时重新生成图表配置
const trendOption = computed(() => buildTrendOption(monthly.value, ui.theme))
const balanceOption = computed(() => buildBalanceOption(monthly.value, ui.theme))
const rankingOption = computed(() => buildCategoryRankingOption(categoryStats.value, ui.theme))

/** 排行图高度随分类数量变化，避免柱子被压扁 */
const rankingHeight = computed(() => Math.max(categoryStats.value.length * 36 + 16, 200))

/** 月度明细表（最新月份在前）：结余与「占区间总支出」的比例在这里算好 */
const rows = computed(() =>
  [...monthly.value].reverse().map((point) => ({
    month: point.month,
    income: point.income,
    expense: point.expense,
    balance: roundMoney(point.income - point.expense),
    share: totals.value.expense > 0 ? (point.expense / totals.value.expense) * 100 : 0,
  })),
)

/** 请求竞态守卫：快速切换区间时只接受最后一次请求的结果 */
const latest = useLatestRequest()

/**
 * 拉取区间数据
 *
 * 分类统计的日期范围覆盖整个区间（首月 1 号 ~ 末月最后一天），
 * 与月度序列保持同一时间口径。
 */
async function load(): Promise<void> {
  const seq = latest.next()
  loading.value = true
  try {
    const range = { startDate: startOfMonth(startMonth.value), endDate: endOfMonth(endMonth.value) }
    const [monthlyData, categoryData] = await Promise.all([
      statsApi.monthly(monthCount.value, endMonth.value),
      statsApi.categories({ ...range, type: 'EXPENSE' }),
    ])
    if (!latest.isLatest(seq)) return

    monthly.value = monthlyData
    categoryStats.value = categoryData
  } catch (error) {
    if (!latest.isLatest(seq)) return
    toast.error(errorMessage(error))
  } finally {
    if (latest.isLatest(seq)) loading.value = false
  }
}

// 切换区间或数据变更时重新拉取
watch([preset, () => sync.version], load, { immediate: true })

/** 分段控件回传的是 string，这里收敛回联合类型 */
function onPresetChange(value: string): void {
  preset.value = value as StatPreset
}
</script>

<template>
  <div class="statistics">
    <!-- 区间切换 -->
    <section class="card card-pad range-bar">
      <div>
        <p class="range-bar__label">统计区间</p>
        <p class="range-bar__period">{{ periodLabel }}</p>
      </div>
      <SegmentedControl
        :model-value="preset"
        :options="PRESETS"
        @update:model-value="onPresetChange"
      />
    </section>

    <!-- 指标 -->
    <section class="stat-grid">
      <StatCard
        label="总收入"
        icon="wallet"
        tone="income"
        :value="formatCurrency(totals.income)"
        :hint="`共 ${monthCount} 个月`"
      />
      <StatCard
        label="总支出"
        icon="chart"
        tone="expense"
        :value="formatCurrency(totals.expense)"
        :hint="`月均 ${formatCurrency(totals.expense / Math.max(monthCount, 1))}`"
      />
      <StatCard
        label="净结余"
        icon="sparkle"
        tone="brand"
        :value="formatCurrency(totals.balance)"
        :hint="totals.balance >= 0 ? '收大于支' : '支大于收'"
      />
      <StatCard
        label="储蓄率"
        icon="trend"
        tone="warning"
        :value="formatPercent(totals.savingRate)"
        :hint="totals.savingRate >= 30 ? '表现不错' : '还有提升空间'"
      />
    </section>

    <!-- 趋势 -->
    <section class="card card-pad">
      <div class="card-head">
        <div>
          <p class="card-title">收支趋势</p>
          <p class="card-subtitle">柱状为支出，折线为收入</p>
        </div>
      </div>
      <!-- 三态：加载中 → 骨架；有数据 → 图表；无数据 → 空状态 -->
      <SkeletonBlock v-if="loading" :height="300" />
      <BaseChart v-else-if="hasData" :option="trendOption" :height="300" label="收支趋势图" />
      <EmptyState v-else icon="📊" title="区间内还没有数据" description="先记录几笔再来看统计" />
    </section>

    <!-- 排行 + 结余 -->
    <section class="split">
      <article class="card card-pad">
        <div class="card-head">
          <div>
            <p class="card-title">支出分类排行</p>
            <p class="card-subtitle">按金额从高到低</p>
          </div>
        </div>
        <SkeletonBlock v-if="loading" :height="rankingHeight" />
        <BaseChart
          v-else-if="categoryStats.length > 0"
          :option="rankingOption"
          :height="rankingHeight"
          label="支出分类排行图"
        />
        <EmptyState v-else compact icon="🏷️" title="暂无支出分类数据" />
      </article>

      <article class="card card-pad">
        <div class="card-head">
          <div>
            <p class="card-title">每月结余</p>
            <p class="card-subtitle">收入 - 支出</p>
          </div>
        </div>
        <SkeletonBlock v-if="loading" :height="300" />
        <BaseChart v-else-if="hasData" :option="balanceOption" :height="300" label="每月结余图" />
        <EmptyState v-else compact icon="💤" title="暂无数据" />
      </article>
    </section>

    <!-- 月度明细 -->
    <section class="card card-pad">
      <div class="card-head">
        <div>
          <p class="card-title">月度明细</p>
          <p class="card-subtitle">支出占比以区间总支出为基准</p>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>月份</th>
              <th class="ta-r">收入</th>
              <th class="ta-r">支出</th>
              <th class="ta-r">结余</th>
              <th class="col-share">支出占比</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.month">
              <td class="month">{{ monthLabel(row.month) }}</td>
              <td class="ta-r num text-income">{{ formatCurrency(row.income) }}</td>
              <td class="ta-r num text-expense">{{ formatCurrency(row.expense) }}</td>
              <td class="ta-r num" :class="{ 'text-expense': row.balance < 0 }">
                {{ formatCurrency(row.balance) }}
              </td>
              <td class="col-share">
                <div class="share">
                  <ProgressBar :value="row.share" :height="6" />
                  <span class="share__value num">{{ formatPercent(row.share, 0) }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.statistics {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.range-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.range-bar__label {
  font-size: 11.5px;
  color: var(--ink-3);
}

.range-bar__period {
  font-size: 14px;
  font-weight: 620;
  margin-top: 1px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.split {
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: 16px;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 620px;
}

.table th {
  padding: 0 12px 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink-3);
  text-align: left;
  border-bottom: 1px solid var(--line);
}

.table td {
  padding: 11px 12px;
  font-size: 13.5px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 62%, transparent);
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.ta-r {
  text-align: right;
}

.month {
  font-weight: 550;
}

.col-share {
  width: 200px;
}

.share {
  display: flex;
  align-items: center;
  gap: 10px;
}

.share__value {
  font-size: 11.5px;
  color: var(--ink-3);
  min-width: 32px;
  text-align: right;
}

@media (max-width: 1080px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
