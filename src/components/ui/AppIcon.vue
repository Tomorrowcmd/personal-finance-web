<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Close,
  Delete,
  Download,
  Edit,
  Filter,
  Hide,
  List,
  Lock,
  MagicStick,
  Moon,
  Odometer,
  Plus,
  PriceTag,
  Refresh,
  Right,
  Search,
  Sunny,
  SwitchButton,
  TrendCharts,
  User,
  View,
  Wallet,
  Warning,
} from '@element-plus/icons-vue'

/**
 * 图标门面
 *
 * 业务代码里一直用 `<AppIcon name="wallet" />` 这种语义化名字，
 * 这里把名字映射到 Element Plus 的图标组件，模板一行都不用改。
 *
 * 注意：分类图标（餐饮/交通…）是后端返回的 emoji，直接渲染在 CategoryDot 里，
 * 不经过这个组件，所以后端数据不受影响。
 */
const props = withDefaults(
  defineProps<{
    /** 语义化图标名 */
    name: string
    /** 尺寸（px） */
    size?: number
    /** 兼容旧 API，Element Plus 图标为描边+填充风格，此参数不再生效 */
    strokeWidth?: number
  }>(),
  {
    size: 18,
    strokeWidth: 1.8,
  },
)

/** 语义名 → Element Plus 图标组件 */
const ICONS: Record<string, unknown> = {
  dashboard: Odometer,
  list: List,
  chart: TrendCharts,
  wallet: Wallet,
  tag: PriceTag,
  plus: Plus,
  close: Close,
  chevronLeft: ArrowLeft,
  chevronRight: ArrowRight,
  chevronDown: ArrowDown,
  sun: Sunny,
  moon: Moon,
  search: Search,
  download: Download,
  edit: Edit,
  trash: Delete,
  calendar: Calendar,
  alert: Warning,
  check: Check,
  filter: Filter,
  refresh: Refresh,
  arrowRight: Right,
  sparkle: MagicStick,
  trend: TrendCharts,
  user: User,
  lock: Lock,
  eye: View,
  eyeOff: Hide,
  logout: SwitchButton,
}

/** 找不到时回退到仪表盘图标，避免页面报错 */
const icon = computed(() => ICONS[props.name] ?? Odometer)
</script>

<template>
  <el-icon :size="size" class="app-icon">
    <component :is="icon" />
  </el-icon>
</template>

<style scoped>
.app-icon {
  flex: none;
  vertical-align: middle;
}
</style>
