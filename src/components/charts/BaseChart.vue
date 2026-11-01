<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import type { ECharts } from 'echarts/core'

// 按需注册：只打包用到的图表与组件，减小体积
echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer])

/**
 * ECharts 容器
 *
 * 职责只有三件事：
 * 1. 创建 / 销毁图表实例（避免内存泄漏）；
 * 2. option 变化时整体替换（含主题切换）；
 * 3. 通过 ResizeObserver 跟随容器尺寸变化。
 *
 * 不支持 setOption 合并模式（notMerge = true），因为主题切换时
 * 颜色是整份替换的，合并会残留旧配置。
 */
const props = withDefaults(
  defineProps<{
    /** ECharts 完整配置，由 utils/chartOptions.ts 生成 */
    option: EChartsOption
    /** 容器高度，数字按 px 处理 */
    height?: number | string
    /** 无障碍描述，读屏会读出 */
    label?: string
  }>(),
  { height: 280, label: '统计图表' },
)

/** 图表挂载节点 */
const container = ref<HTMLDivElement | null>(null)
/** ECharts 实例；用 shallowRef 避免 Vue 深度代理第三方对象 */
const chart = shallowRef<ECharts | null>(null)
/** 尺寸监听器，组件卸载时断开 */
let observer: ResizeObserver | null = null

/** 用最新 option 整体重绘 */
function render(): void {
  if (!chart.value) return
  chart.value.setOption(props.option, true)
}

onMounted(() => {
  if (!container.value) return
  chart.value = echarts.init(container.value, undefined, { renderer: 'canvas' })
  render()

  // 侧栏折叠、窗口缩放、卡片换行都会改变容器宽度，需要主动 resize
  observer = new ResizeObserver(() => chart.value?.resize())
  observer.observe(container.value)
})

// 配置变化（含主题切换）时整体替换，避免残留旧配置
watch(
  () => props.option,
  () => render(),
  { deep: true },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart.value?.dispose()
  chart.value = null
})
</script>

<template>
  <div
    ref="container"
    class="chart"
    role="img"
    :aria-label="label"
    :style="{ height: typeof height === 'number' ? `${height}px` : height }"
  />
</template>

<style scoped>
.chart {
  width: 100%;
}
</style>
