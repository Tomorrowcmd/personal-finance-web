import type { Category, Transaction, TransactionType } from '@/types'
import { addMonths, currentMonth, daysInMonth } from '@/utils/date'

/**
 * 模拟数据仓库（仅开发期使用）
 *
 * 存在的意义：后端还没开工时，前端也能完整跑通「新增 → 列表 → 统计 → 导出」。
 * 数据落在 localStorage，刷新页面不丢；把 VITE_USE_MOCK 设为 false 即彻底停用。
 * 接入真实后端后，整个 src/mock 目录可以直接删除，业务代码零改动。
 */

/** localStorage 的存储 key；改数据结构时同步升级版本号（v1 → v2）即可触发重建 */
const STORAGE_KEY = 'personal-finance.mock.v1'

/** 存储中的预算：只存「设置值」，已花费由流水实时算 */
export interface StoredBudget {
  /** 月度总预算 */
  totalAmount: number
  /** 分类额度列表（只保存用户设置过的，spent 不落库） */
  items: Array<{ categoryId: number; amount: number }>
}

/** mock 的整库结构（等价于后端的几张表 + 自增序列） */
export interface MockState {
  /** 数据版本，结构变更时递增以触发重建 */
  version: number
  /** 生成数据时的月份，跨月后重新生成，保证「本月」始终有数据 */
  seedMonth: string
  /** 自增主键（分类与流水共用一个序列，保证 id 全局唯一） */
  seq: number
  /** 分类表 */
  categories: Category[]
  /** 流水表 */
  transactions: Transaction[]
  /** 预算表：key 是月份 yyyy-MM */
  budgets: Record<string, StoredBudget>
}

/** 生成示例数据用的分类模板 */
interface SeedCategory {
  /** 分类名 */
  name: string
  /** emoji */
  icon: string
  /** 颜色 */
  color: string
  /** 收支类型 */
  type: TransactionType
  /** 每月生成条数（0 表示不按月随机生成，如工资单独处理） */
  count: number
  /** 单笔金额下限 */
  min: number
  /** 单笔金额上限 */
  max: number
  /** 从这些备注里随机挑一个 */
  notes: string[]
}

const EXPENSE_SEEDS: SeedCategory[] = [
  {
    name: '餐饮',
    icon: '🍜',
    color: '#E0703C',
    type: 'EXPENSE',
    count: 12,
    min: 15,
    max: 88,
    notes: ['早餐', '午饭', '晚饭', '咖啡', '外卖', '奶茶', '夜宵'],
  },
  {
    name: '交通',
    icon: '🚇',
    color: '#3C7DBF',
    type: 'EXPENSE',
    count: 6,
    min: 3,
    max: 60,
    notes: ['地铁', '打车', '公交', '加油'],
  },
  {
    name: '购物',
    icon: '🛍️',
    color: '#B25FB0',
    type: 'EXPENSE',
    count: 4,
    min: 39,
    max: 699,
    notes: ['日用品', '衣服', '数码配件', '超市采购'],
  },
  {
    name: '居住',
    icon: '🏠',
    color: '#6B7A8F',
    type: 'EXPENSE',
    count: 1,
    min: 3200,
    max: 3200,
    notes: ['房租'],
  },
  {
    name: '娱乐',
    icon: '🎮',
    color: '#D9A13B',
    type: 'EXPENSE',
    count: 3,
    min: 25,
    max: 180,
    notes: ['电影', '会员订阅', '周末活动'],
  },
  {
    name: '医疗',
    icon: '💊',
    color: '#4C9E9E',
    type: 'EXPENSE',
    count: 1,
    min: 30,
    max: 260,
    notes: ['药品', '门诊'],
  },
  {
    name: '学习',
    icon: '📚',
    color: '#5B6BD6',
    type: 'EXPENSE',
    count: 1,
    min: 49,
    max: 199,
    notes: ['书籍', '课程'],
  },
  {
    name: '人情',
    icon: '🎁',
    color: '#D45F7C',
    type: 'EXPENSE',
    count: 1,
    min: 100,
    max: 600,
    notes: ['红包', '礼物', '聚餐 AA'],
  },
  {
    name: '其他',
    icon: '✨',
    color: '#8A94A6',
    type: 'EXPENSE',
    count: 2,
    min: 20,
    max: 150,
    notes: ['杂项', '手续费'],
  },
]

const INCOME_SEEDS: SeedCategory[] = [
  {
    name: '工资',
    icon: '💼',
    color: '#0F7A63',
    type: 'INCOME',
    count: 0,
    min: 0,
    max: 0,
    notes: [],
  },
  {
    name: '奖金',
    icon: '🏆',
    color: '#2E9E7E',
    type: 'INCOME',
    count: 0,
    min: 0,
    max: 0,
    notes: [],
  },
  {
    name: '理财',
    icon: '📈',
    color: '#3C7DBF',
    type: 'INCOME',
    count: 1,
    min: 80,
    max: 320,
    notes: ['基金收益', '利息'],
  },
  {
    name: '兼职',
    icon: '🧾',
    color: '#7C6BD6',
    type: 'INCOME',
    count: 1,
    min: 300,
    max: 1200,
    notes: ['外包', '稿费'],
  },
  {
    name: '其他收入',
    icon: '💰',
    color: '#8A94A6',
    type: 'INCOME',
    count: 0,
    min: 0,
    max: 0,
    notes: [],
  },
]

/**
 * 线性同余伪随机数
 *
 * 固定种子 → 每次生成的数据一致，截图、演示、对比都不会跳来跳去。
 * 返回 [0, 1) 的浮点数。
 */
function createRandom(seed: number): () => number {
  let value = seed % 2_147_483_647
  if (value <= 0) value += 2_147_483_646
  return () => {
    value = (value * 16_807) % 2_147_483_647
    return (value - 1) / 2_147_483_646
  }
}

/**
 * 生成分类表
 *
 * id 从 1 开始按种子顺序分配，前端截图中分类顺序稳定；
 * 支出分类在前、收入分类在后，与「分类管理」页的 tab 顺序一致。
 */
function buildCategories(): Category[] {
  const categories: Category[] = []
  let id = 1
  for (const seed of [...EXPENSE_SEEDS, ...INCOME_SEEDS]) {
    categories.push({ id, name: seed.name, type: seed.type, color: seed.color, icon: seed.icon })
    id += 1
  }
  return categories
}

/** 在 [min, max] 内取一位小数的金额 */
function randomAmount(rand: () => number, min: number, max: number): number {
  return Math.round((min + rand() * (max - min)) * 10) / 10
}

/**
 * 生成示例流水
 *
 * 覆盖最近 7 个月（含本月），每月：
 * - 按 EXPENSE_SEEDS 的分类与条数随机生成支出；
 * - 固定 10 号发工资，个别月份有奖金，另有理财/兼职收入；
 * - 当月只生成「今天及以前」的数据，不会出现未来流水。
 *
 * 最后按日期倒序、同日 id 倒序排列，与列表接口的排序一致。
 */
function buildTransactions(categories: Category[]): Transaction[] {
  const thisMonth = currentMonth()
  const today = new Date()
  const todayDay = today.getDate()
  const transactions: Transaction[] = []
  let id = 1

  for (let offset = 6; offset >= 0; offset -= 1) {
    const month = addMonths(thisMonth, -offset)
    const isCurrent = month === thisMonth
    // 当月只生成「今天及以前」的流水，未来日期不出现
    const maxDay = isCurrent ? todayDay : daysInMonth(month)
    const rand = createRandom(2_026_101 + offset * 977)

    const push = (
      type: TransactionType,
      category: Category,
      amount: number,
      day: number,
      note: string,
    ) => {
      const date = `${month}-${String(Math.min(day, maxDay)).padStart(2, '0')}`
      transactions.push({
        id,
        type,
        amount,
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color,
        categoryIcon: category.icon,
        date,
        note,
        createdAt: `${date}T12:00:00.000+08:00`,
      })
      id += 1
    }

    // 支出
    for (const seed of EXPENSE_SEEDS) {
      const category = categories.find((item) => item.name === seed.name && item.type === 'EXPENSE')
      if (!category) continue
      for (let i = 0; i < seed.count; i += 1) {
        const day = 1 + Math.floor(rand() * maxDay)
        const note = seed.notes[Math.floor(rand() * seed.notes.length)] ?? ''
        push('EXPENSE', category, randomAmount(rand, seed.min, seed.max), day, note)
      }
    }

    const byName = (name: string) =>
      categories.find((item) => item.name === name && item.type === 'INCOME')

    // 工资：每月 10 号
    const salary = byName('工资')
    if (salary && (maxDay >= 10 || !isCurrent))
      push('INCOME', salary, 18_500, 10, `${Number(month.slice(5))}月工资`)

    // 奖金：5 个月前、2 个月前各一笔，让趋势图有起伏
    const bonus = byName('奖金')
    if (bonus && offset === 5) push('INCOME', bonus, 6_000, 15, '季度奖金')
    if (bonus && offset === 2) push('INCOME', bonus, 3_500, 20, '项目奖金')

    // 理财、兼职
    for (const seed of [INCOME_SEEDS[2], INCOME_SEEDS[3]]) {
      if (!seed) continue
      const category = byName(seed.name)
      if (!category) continue
      for (let i = 0; i < seed.count; i += 1) {
        const day = 1 + Math.floor(rand() * maxDay)
        const note = seed.notes[Math.floor(rand() * seed.notes.length)] ?? ''
        push('INCOME', category, randomAmount(rand, seed.min, seed.max), day, note)
      }
    }
  }

  // 按日期倒序，同一天按 id 倒序（最近录入的在前）
  return transactions.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
}

/**
 * 生成示例预算
 *
 * 本月总预算 8000、上月 7500，并给餐饮/交通/购物/娱乐/居住单独设额度，
 * 让预算页一打开就有进度条可看（分类合计略高于总额，顺带演示「超总额」提示）。
 */
function buildBudgets(categories: Category[]): Record<string, StoredBudget> {
  const byName = (name: string) =>
    categories.find((item) => item.name === name && item.type === 'EXPENSE')
  const pick = (name: string, amount: number) => {
    const category = byName(name)
    return category ? { categoryId: category.id, amount } : null
  }

  const items = [
    pick('餐饮', 2_000),
    pick('交通', 500),
    pick('购物', 1_500),
    pick('娱乐', 600),
    pick('居住', 3_500),
  ].filter((item): item is { categoryId: number; amount: number } => item !== null)

  const thisMonth = currentMonth()
  const budget = { totalAmount: 8_000, items }

  return {
    [thisMonth]: budget,
    [addMonths(thisMonth, -1)]: { totalAmount: 7_500, items },
  }
}

/** 组装一份全新的 mock 数据（分类 + 流水 + 预算 + 自增序列） */
function buildInitialState(): MockState {
  const categories = buildCategories()
  const transactions = buildTransactions(categories)
  // 自增序列必须从已有最大 id 之后开始，否则新增记录会与种子数据主键冲突
  const maxId = Math.max(
    0,
    ...categories.map((item) => item.id),
    ...transactions.map((item) => item.id),
  )

  return {
    version: 2,
    seedMonth: currentMonth(),
    seq: maxId,
    categories,
    transactions,
    budgets: buildBudgets(categories),
  }
}

let state: MockState | null = null

/**
 * 读取（或初始化）mock 数据
 *
 * 内存里已有则直接返回；否则：
 * 1. 尝试从 localStorage 恢复；
 * 2. 结构版本不符或跨月 → 重新生成示例数据并写回。
 * 跨月重播是为了保证「本月」永远有数据，演示不会开天窗。
 */
export function getState(): MockState {
  if (state) return state

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockState
      if (parsed.version === 2 && parsed.seedMonth === currentMonth()) {
        state = parsed
        return state
      }
    }
  } catch {
    // 解析失败按首次访问处理
  }

  state = buildInitialState()
  persist()
  return state
}

/**
 * 把内存状态写回 localStorage
 *
 * 写入失败（如隐私模式、配额满）只打警告，不影响当前会话的内存数据。
 */
export function persist(): void {
  if (!state) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    console.warn('[mock] 本地存储写入失败，数据仅保留在内存中')
  }
}

/** 重置为初始示例数据（开发调试用，页面上没有入口） */
export function resetMockData(): void {
  state = buildInitialState()
  persist()
}

/**
 * 取下一个自增主键
 *
 * 分类与流水共用同一个序列：id 全局唯一，
 * 避免出现「分类 id 和流水 id 相同」这类只在 mock 里才有的怪现象。
 */
export function nextId(): number {
  const current = getState()
  current.seq += 1
  return current.seq
}
