import { AxiosError } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import type {
  Budget,
  BudgetItem,
  Category,
  CategoryStat,
  MonthlyPoint,
  PageResult,
  Summary,
  Transaction,
  TransactionType,
} from '@/types'
import { addMonths, currentMonth, endOfMonth, startOfMonth, todayISO } from '@/utils/date'
import { fromCents, roundMoney, toCents } from '@/utils/format'
import { getState, nextId, persist } from './database'

/**
 * mock 适配器
 *
 * 直接替换 axios 的 adapter，拦在请求发出之前，按真实接口的
 * 路径 / 参数 / 状态码 / 响应结构返回数据。业务代码完全无感知，
 * 关掉 VITE_USE_MOCK 后请求就真的发到 Spring Boot 了。
 */

interface HandlerResult {
  data: unknown
  headers?: Record<string, string>
}

class MockHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'MockHttpError'
    this.status = status
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ */
/* 模拟登录                                                            */
/* ------------------------------------------------------------------ */

/** 演示账号（与登录页提示、README 保持一致） */
const DEMO_USERNAME = 'admin'
const DEMO_PASSWORD = 'admin123'
/** 修改后的密码单独存一个 key，不随业务数据跨月重置 */
const PASSWORD_KEY = 'pf.mock.password'
const MOCK_USER = { username: 'admin', displayName: '管理员' }
/** 令牌有效期 7 天 */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 当前生效的密码：默认 admin123，改密后读本地存储 */
function currentPassword(): string {
  try {
    return localStorage.getItem(PASSWORD_KEY) ?? DEMO_PASSWORD
  } catch {
    return DEMO_PASSWORD
  }
}

function issueToken(): string {
  return `mock.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`
}

/** 从请求头取 Bearer Token */
function readToken(config: InternalAxiosRequestConfig): string {
  const raw = config.headers?.Authorization
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0] ?? '') : ''
  return value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

/** mock 令牌格式：mock.<签发时间戳>.<随机串> */
function isValidToken(token: string): boolean {
  if (!token.startsWith('mock.')) return false
  const issuedAt = Number(token.split('.')[1])
  return Number.isFinite(issuedAt) && Date.now() - issuedAt < TOKEN_TTL_MS
}

/** 不需要登录即可访问的接口 */
function isPublicPath(path: string): boolean {
  return path === 'auth/login'
}

/**
 * 创建 mock 适配器（替换 axios 的 adapter）
 *
 * 请求不会真的发出，而是在这里按「方法 + 路径」分发到下面的 route()，
 * 并模拟三件真实后端会做的事：
 * 1. 90-250ms 随机延迟（让 loading 状态可见）；
 * 2. 除登录外校验 Bearer Token，无效直接 401；
 * 3. 业务异常统一转成带 ProblemDetail 结构的错误响应。
 */
export function createMockAdapter(): AxiosAdapter {
  return async (config) => {
    const method = (config.method ?? 'get').toUpperCase()
    const path = String(config.url ?? '').replace(/^\/+|\/+$/g, '')
    const params = (config.params ?? {}) as Record<string, unknown>
    const body: unknown =
      typeof config.data === 'string' ? safeParse(config.data) : (config.data ?? null)
    const token = readToken(config)

    // 模拟网络延迟，便于观察 loading 状态
    await sleep(90 + Math.random() * 160)

    try {
      // 与真实后端一致：除登录外，没有有效令牌一律 401
      if (!isPublicPath(path) && !isValidToken(token)) {
        throw new MockHttpError(401, '登录状态已失效，请重新登录')
      }

      const result = route(method, path, params, body, token)
      return buildResponse(config, 200, result.data, result.headers)
    } catch (error) {
      if (error instanceof MockHttpError) {
        return Promise.reject(createAxiosError(config, error.status, error.message))
      }
      console.error('[mock] 未处理异常', error)
      return Promise.reject(createAxiosError(config, 500, '模拟服务内部错误'))
    }
  }
}

/* ------------------------------------------------------------------ */
/* 路由分发                                                            */
/* ------------------------------------------------------------------ */

/**
 * 路由分发
 *
 * 用「路径段」做简单匹配，规则与《后端接口约定》一一对应；
 * 每个分支返回 { data, headers? }，由 buildResponse 组装成 AxiosResponse。
 *
 * @param method HTTP 方法（已转大写）
 * @param path   去掉首尾斜杠的路径，如 'transactions/12'
 * @param params 查询参数
 * @param body   请求体（已解析成对象）
 * @param token  从 Authorization 头解析出的令牌
 */
function route(
  method: string,
  path: string,
  params: Record<string, unknown>,
  body: unknown,
  token: string,
): HandlerResult {
  const segments = path.split('/')
  const [root = '', second = ''] = segments

  if (root === 'auth') {
    if (method === 'POST' && second === 'login') return { data: login(body) }
    if (method === 'GET' && second === 'me') {
      if (!isValidToken(token)) throw new MockHttpError(401, '登录状态已失效，请重新登录')
      return { data: MOCK_USER }
    }
    if (method === 'POST' && second === 'logout') {
      // 无状态令牌：前端清空本地存储即可，这里只做成功响应
      return { data: null }
    }
    if (method === 'POST' && second === 'password') return { data: changePassword(body) }
    throw notFound()
  }

  if (root === 'categories') {
    if (method === 'GET' && !second) return { data: getState().categories }
    if (method === 'POST' && !second) return { data: createCategory(body) }
    const id = Number(second)
    if (method === 'PUT' && Number.isFinite(id)) return { data: updateCategory(id, body) }
    if (method === 'DELETE' && Number.isFinite(id))
      return { data: deleteCategory(id), headers: noContent() }
    throw notFound()
  }

  if (root === 'transactions') {
    if (method === 'GET' && !second) return { data: queryTransactions(params) }
    if (method === 'POST' && !second) return { data: createTransaction(body) }
    if (method === 'GET' && second === 'summary') return { data: summarize(params) }
    if (method === 'GET' && second === 'export') return exportCsv(params)

    const id = Number(second)
    if (method === 'PUT' && Number.isFinite(id)) return { data: updateTransaction(id, body) }
    if (method === 'DELETE' && Number.isFinite(id)) {
      deleteTransaction(id)
      return { data: null, headers: noContent() }
    }
    throw notFound()
  }

  if (root === 'stats' && method === 'GET') {
    if (second === 'monthly') return { data: monthlyStats(params) }
    if (second === 'categories') return { data: categoryStats(params) }
    throw notFound()
  }

  if (root === 'budgets' && second) {
    const month = second
    if (method === 'GET') return { data: getBudget(month) }
    if (method === 'PUT') return { data: saveBudget(month, body) }
    throw notFound()
  }

  throw new MockHttpError(404, `模拟接口不存在：${method} /${path}`)
}

/* ------------------------------------------------------------------ */
/* 登录                                                                */
/* ------------------------------------------------------------------ */

/**
 * 登录
 *
 * 校验演示账号；为了不把演示用户锁在门外，
 * 除了「当前密码」外也接受初始密码 admin123（仅 mock 有此后门）。
 */
function login(body: unknown): { token: string; expiresAt: string; user: typeof MOCK_USER } {
  const payload = (body ?? {}) as Record<string, unknown>
  const username = str(payload.username).trim()
  const password = str(payload.password)

  if (!username || !password) throw new MockHttpError(400, '请输入账号和密码')

  // 演示模式额外接受初始密码，避免改密后忘记导致进不去（真实后端没有这个后门）
  const accepted = password === currentPassword() || password === DEMO_PASSWORD
  if (username !== DEMO_USERNAME || !accepted) {
    throw new MockHttpError(401, '账号或密码不正确')
  }

  return {
    token: issueToken(),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    user: MOCK_USER,
  }
}

/**
 * 修改密码
 *
 * 原密码错误返回 400 而不是 401：401 会被前端当成会话失效直接登出。
 */
function changePassword(body: unknown): null {
  const payload = (body ?? {}) as Record<string, unknown>
  const oldPassword = str(payload.oldPassword)
  const newPassword = str(payload.newPassword)

  if (!oldPassword || !newPassword) throw new MockHttpError(400, '请输入原密码和新密码')
  if (oldPassword !== currentPassword()) throw new MockHttpError(400, '原密码不正确')
  if (newPassword.length < 6 || newPassword.length > 32) {
    throw new MockHttpError(400, '新密码长度需为 6-32 位')
  }
  if (newPassword === oldPassword) throw new MockHttpError(400, '新密码不能与原密码相同')

  try {
    localStorage.setItem(PASSWORD_KEY, newPassword)
  } catch {
    throw new MockHttpError(500, '本地存储不可用，修改失败')
  }
  return null
}

/* ------------------------------------------------------------------ */
/* 分类                                                                */
/* ------------------------------------------------------------------ */

/**
 * 校验分类表单（新建与编辑共用）
 *
 * @param body      请求体
 * @param currentId 编辑时传当前 id，用于把「自己」排除在重名判断之外
 * @returns 只含可变字段的对象（不含 id）
 */
function validateCategory(body: unknown, currentId?: number): Omit<Category, 'id'> {
  const payload = (body ?? {}) as Record<string, unknown>
  const name = str(payload.name).trim()
  const type = payload.type
  const color = str(payload.color) || '#8A94A6'
  const icon = str(payload.icon) || '✨'

  if (!name) throw new MockHttpError(400, '分类名称不能为空')
  if (name.length > 12) throw new MockHttpError(400, '分类名称不能超过 12 个字')
  if (type !== 'EXPENSE' && type !== 'INCOME') throw new MockHttpError(400, '收支类型不合法')
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new MockHttpError(400, '颜色格式不合法')

  const duplicated = getState().categories.some(
    (item) => item.id !== currentId && item.name === name && item.type === type,
  )
  if (duplicated) throw new MockHttpError(409, `已存在同名分类「${name}」`)

  return { name, type, color, icon }
}

/** 新建分类：校验 → 分配自增 id → 写入并持久化 */
function createCategory(body: unknown): Category {
  const payload = validateCategory(body)
  const category: Category = { id: nextId(), ...payload }
  getState().categories.push(category)
  persist()
  return category
}

/**
 * 编辑分类
 *
 * 额外规则：分类已被流水引用时不允许改类型（否则历史统计会错乱）。
 * 改名/换色后会同步更新流水里的快照字段（真实后端是 join 查询，不需要这一步）。
 */
function updateCategory(id: number, body: unknown): Category {
  const state = getState()
  const category = state.categories.find((item) => item.id === id)
  if (!category) throw new MockHttpError(404, '分类不存在')

  const payload = validateCategory(body, id)
  const used = state.transactions.some((item) => item.categoryId === id)
  if (used && payload.type !== category.type) {
    throw new MockHttpError(409, '该分类下已有流水，不能修改收支类型')
  }

  Object.assign(category, payload)
  // 同步流水里的冗余字段，避免列表显示旧名称/颜色
  for (const transaction of state.transactions) {
    if (transaction.categoryId !== id) continue
    transaction.categoryName = category.name
    transaction.categoryColor = category.color
    transaction.categoryIcon = category.icon
  }
  persist()
  return category
}

/**
 * 删除分类
 *
 * 被流水引用时拒绝（409），与真实后端保持一致；
 * 同时把各月预算里该分类的额度一并移除，避免留下孤儿数据。
 */
function deleteCategory(id: number): null {
  const state = getState()
  const index = state.categories.findIndex((item) => item.id === id)
  if (index < 0) throw new MockHttpError(404, '分类不存在')

  const usedCount = state.transactions.filter((item) => item.categoryId === id).length
  if (usedCount > 0) {
    throw new MockHttpError(409, `该分类下还有 ${usedCount} 条流水，请先删除或迁移后再试`)
  }

  state.categories.splice(index, 1)
  for (const month of Object.keys(state.budgets)) {
    const budget = state.budgets[month]
    if (budget) budget.items = budget.items.filter((item) => item.categoryId !== id)
  }
  persist()
  return null
}

/* ------------------------------------------------------------------ */
/* 流水                                                                */
/* ------------------------------------------------------------------ */

/** 解析后的筛选条件（内部结构，字符串已归一化） */
interface Filters {
  /** 起始日期，空串表示不限 */
  startDate: string
  /** 结束日期，空串表示不限 */
  endDate: string
  /** 类型，空串表示全部 */
  type: TransactionType | ''
  /** 分类 id，undefined 表示全部 */
  categoryId: number | undefined
  /** 关键字（已转小写） */
  keyword: string
}

/**
 * 从查询参数里读出筛选条件
 *
 * 前端传的可能都是字符串，这里统一转成需要的类型：
 * type 只接受两个枚举值，非法值当作「全部」。
 */
function readFilters(params: Record<string, unknown>): Filters {
  const rawType = str(params.type).toUpperCase()
  return {
    startDate: str(params.startDate),
    endDate: str(params.endDate),
    type: rawType === 'EXPENSE' || rawType === 'INCOME' ? rawType : '',
    categoryId: toNumber(params.categoryId),
    keyword: str(params.keyword).trim().toLowerCase(),
  }
}

/**
 * 按条件筛选并排序
 *
 * 排序规则：日期倒序；同一天里 id 大的（后录入的）在前。
 * 列表、汇总、导出都复用这个函数，保证三者数据一致。
 */
function filterTransactions(params: Record<string, unknown>): Transaction[] {
  const filters = readFilters(params)
  return getState()
    .transactions.filter((item) => {
      if (filters.startDate && item.date < filters.startDate) return false
      if (filters.endDate && item.date > filters.endDate) return false
      if (filters.type && item.type !== filters.type) return false
      if (filters.categoryId !== undefined && item.categoryId !== filters.categoryId) return false
      if (filters.keyword) {
        const haystack = `${item.note}${item.categoryName}`.toLowerCase()
        if (!haystack.includes(filters.keyword)) return false
      }
      return true
    })
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
}

/**
 * 分页查询
 *
 * size 夹取到 1-100，page 最小为 1，与后端参数约束一致；
 * totalPages 至少为 1，避免前端分页器出现 0 页。
 */
function queryTransactions(params: Record<string, unknown>): PageResult<Transaction> {
  const all = filterTransactions(params)
  const size = Math.min(Math.max(toNumber(params.size) ?? 10, 1), 100)
  const page = Math.max(toNumber(params.page) ?? 1, 1)
  const totalPages = Math.max(1, Math.ceil(all.length / size))
  const start = (page - 1) * size

  return {
    items: all.slice(start, start + size),
    page,
    size,
    total: all.length,
    totalPages,
  }
}

/**
 * 汇总
 *
 * 与列表接口共用筛选条件（忽略分页），
 * 金额用「分」累加再转回「元」，避免浮点误差。
 */
function summarize(params: Record<string, unknown>): Summary {
  const list = filterTransactions(params)
  let income = 0
  let expense = 0
  for (const item of list) {
    if (item.type === 'INCOME') income += toCents(item.amount)
    else expense += toCents(item.amount)
  }
  return {
    income: fromCents(income),
    expense: fromCents(expense),
    balance: fromCents(income - expense),
    count: list.length,
  }
}

/**
 * 校验流水表单
 *
 * 规则与文档一致：类型合法、金额 > 0 且不超上限、日期格式正确、
 * 分类必须存在且与类型匹配、备注不超过 50 字。
 *
 * @returns 规整后的可变字段（金额已四舍五入到两位小数）
 */
function validateTransaction(
  body: unknown,
): Omit<Transaction, 'id' | 'createdAt' | 'categoryName' | 'categoryColor' | 'categoryIcon'> {
  const payload = (body ?? {}) as Record<string, unknown>
  const type = payload.type
  const amount = Number(payload.amount)
  const categoryId = toNumber(payload.categoryId)
  const date = str(payload.date)
  const note = str(payload.note).trim()

  if (type !== 'EXPENSE' && type !== 'INCOME') throw new MockHttpError(400, '收支类型不合法')
  if (!Number.isFinite(amount) || amount <= 0) throw new MockHttpError(400, '金额必须大于 0')
  if (amount > 99_999_999.99) throw new MockHttpError(400, '金额超出上限')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new MockHttpError(400, '日期格式应为 yyyy-MM-dd')
  if (categoryId === undefined) throw new MockHttpError(400, '请选择分类')
  if (note.length > 50) throw new MockHttpError(400, '备注不能超过 50 个字')

  const category = getState().categories.find((item) => item.id === categoryId)
  if (!category) throw new MockHttpError(400, '分类不存在')
  if (category.type !== type) throw new MockHttpError(400, '分类与收支类型不匹配')

  return { type, amount: roundMoney(amount), categoryId, date, note }
}

/** 新增流水：校验后补上主键、分类快照与创建时间 */
function createTransaction(body: unknown): Transaction {
  const payload = validateTransaction(body)
  const category = getState().categories.find((item) => item.id === payload.categoryId)
  if (!category) throw new MockHttpError(400, '分类不存在')

  const transaction: Transaction = {
    id: nextId(),
    ...payload,
    categoryName: category.name,
    categoryColor: category.color,
    categoryIcon: category.icon,
    createdAt: new Date().toISOString(),
  }
  getState().transactions.push(transaction)
  persist()
  return transaction
}

/** 编辑流水：整体覆盖可变字段，并同步分类快照（分类可能被改选） */
function updateTransaction(id: number, body: unknown): Transaction {
  const state = getState()
  const transaction = state.transactions.find((item) => item.id === id)
  if (!transaction) throw new MockHttpError(404, '流水不存在')

  const payload = validateTransaction(body)
  const category = state.categories.find((item) => item.id === payload.categoryId)
  if (!category) throw new MockHttpError(400, '分类不存在')

  Object.assign(transaction, payload, {
    categoryName: category.name,
    categoryColor: category.color,
    categoryIcon: category.icon,
  })
  persist()
  return transaction
}

/** 删除流水：不存在返回 404 */
function deleteTransaction(id: number): void {
  const state = getState()
  const index = state.transactions.findIndex((item) => item.id === id)
  if (index < 0) throw new MockHttpError(404, '流水不存在')
  state.transactions.splice(index, 1)
  persist()
}

/**
 * 导出 CSV（mock 专用）
 *
 * 真实后端返回的是 Apache POI 生成的 xlsx，这里用 CSV 代替，
 * 保证「导出 → 下载」整条链路在无后端时也能验证。
 * 细节：带 UTF-8 BOM，Excel 直接打开中文不乱码；单元格做转义。
 */
function exportCsv(params: Record<string, unknown>): HandlerResult {
  const rows = filterTransactions(params)
  const header = ['日期', '类型', '分类', '金额', '备注']
  const lines = [header.join(',')]
  for (const item of rows) {
    lines.push(
      [
        item.date,
        item.type === 'INCOME' ? '收入' : '支出',
        item.categoryName,
        item.amount.toFixed(2),
        item.note,
      ]
        .map(csvCell)
        .join(','),
    )
  }

  const content = `\uFEFF${lines.join('\r\n')}`
  const filename = `收支明细-${todayISO()}.csv`
  return {
    data: new Blob([content], { type: 'text/csv;charset=utf-8' }),
    headers: {
      'content-type': 'text/csv;charset=utf-8',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  }
}

/** CSV 单元格转义：含逗号/引号/换行时用双引号包裹，内部引号翻倍 */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/* ------------------------------------------------------------------ */
/* 统计                                                                */
/* ------------------------------------------------------------------ */

/**
 * 月度收支序列
 *
 * 按 endMonth 往前推 months 个月，逐月累加（没有数据的月份补 0），
 * 返回顺序是升序，与趋势图横轴一致。
 */
function monthlyStats(params: Record<string, unknown>): MonthlyPoint[] {
  const months = Math.min(Math.max(toNumber(params.months) ?? 6, 1), 24)
  const endMonth = str(params.endMonth) || currentMonth()
  const state = getState()

  const points: MonthlyPoint[] = []
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const month = addMonths(endMonth, -offset)
    let income = 0
    let expense = 0
    for (const item of state.transactions) {
      if (!item.date.startsWith(month)) continue
      if (item.type === 'INCOME') income += toCents(item.amount)
      else expense += toCents(item.amount)
    }
    points.push({ month, income: fromCents(income), expense: fromCents(expense) })
  }
  return points
}

/**
 * 分类占比
 *
 * 先按分类把金额累加（用「分」避免浮点误差），再算占总金额的百分比；
 * 结果按金额降序，前端环形图与图例直接使用这个顺序。
 */
function categoryStats(params: Record<string, unknown>): CategoryStat[] {
  const month = currentMonth()
  const startDate = str(params.startDate) || startOfMonth(month)
  const endDate = str(params.endDate) || endOfMonth(month)
  const type: TransactionType = str(params.type).toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE'

  const buckets = new Map<number, { amount: number; category?: Category }>()
  for (const item of getState().transactions) {
    if (item.type !== type) continue
    if (item.date < startDate || item.date > endDate) continue
    const bucket = buckets.get(item.categoryId) ?? { amount: 0 }
    bucket.amount += toCents(item.amount)
    bucket.category ??= getState().categories.find((category) => category.id === item.categoryId)
    buckets.set(item.categoryId, bucket)
  }

  const total = [...buckets.values()].reduce((sum, item) => sum + item.amount, 0)
  return [...buckets.entries()]
    .map(([categoryId, bucket]) => ({
      categoryId,
      name: bucket.category?.name ?? '未分类',
      icon: bucket.category?.icon ?? '❓',
      color: bucket.category?.color ?? '#8A94A6',
      amount: fromCents(bucket.amount),
      percent: total === 0 ? 0 : Math.round((bucket.amount / total) * 1000) / 10,
    }))
    .sort((a, b) => b.amount - a.amount)
}

/* ------------------------------------------------------------------ */
/* 预算                                                                */
/* ------------------------------------------------------------------ */

/**
 * 统计某月支出合计
 *
 * @param month      月份 yyyy-MM
 * @param categoryId 传了则只算该分类，不传算当月全部支出
 */
function sumSpent(month: string, categoryId?: number): number {
  let cents = 0
  for (const item of getState().transactions) {
    if (item.type !== 'EXPENSE' || !item.date.startsWith(month)) continue
    if (categoryId !== undefined && item.categoryId !== categoryId) continue
    cents += toCents(item.amount)
  }
  return fromCents(cents)
}

/**
 * 读取某月预算
 *
 * 设置值来自 localStorage，已花金额实时从流水汇总（不落库），
 * 因此 budget items 里的 spent 每次都可能是最新值。
 * 未设置预算的月份返回 totalAmount = 0、items = []。
 */
function getBudget(month: string): Budget {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new MockHttpError(400, '月份格式应为 yyyy-MM')
  const stored = getState().budgets[month]

  const items: BudgetItem[] = (stored?.items ?? []).map((item) => ({
    categoryId: item.categoryId,
    amount: item.amount,
    spent: sumSpent(month, item.categoryId),
  }))

  return {
    month,
    totalAmount: stored?.totalAmount ?? 0,
    totalSpent: sumSpent(month),
    items,
  }
}

/**
 * 保存某月预算（整体覆盖）
 *
 * 校验：总额 ≥ 0、分类金额 ≥ 0、分类必须存在且为支出类型、
 * 同一分类不能重复出现。保存后立刻回读一次，返回带 spent 的完整结构。
 */
function saveBudget(month: string, body: unknown): Budget {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new MockHttpError(400, '月份格式应为 yyyy-MM')

  const payload = (body ?? {}) as Record<string, unknown>
  const totalAmount = Number(payload.totalAmount ?? 0)
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new MockHttpError(400, '预算总额不能为负数')
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : []
  const seen = new Set<number>()
  const items: StoredBudgetItems = []

  for (const raw of rawItems) {
    const entry = (raw ?? {}) as Record<string, unknown>
    const categoryId = toNumber(entry.categoryId)
    const amount = Number(entry.amount ?? 0)
    if (categoryId === undefined) throw new MockHttpError(400, '分类 id 不合法')
    if (!Number.isFinite(amount) || amount < 0) throw new MockHttpError(400, '分类预算不能为负数')
    if (seen.has(categoryId)) throw new MockHttpError(400, '同一分类不能重复设置预算')
    const category = getState().categories.find((item) => item.id === categoryId)
    if (!category) throw new MockHttpError(400, '分类不存在')
    if (category.type !== 'EXPENSE') throw new MockHttpError(400, '只有支出分类可以设置预算')

    seen.add(categoryId)
    items.push({ categoryId, amount: roundMoney(amount) })
  }

  getState().budgets[month] = { totalAmount: roundMoney(totalAmount), items }
  persist()
  return getBudget(month)
}

/** 预算里存储的分类额度结构（只有设置值，不含实时统计的 spent） */
type StoredBudgetItems = Array<{ categoryId: number; amount: number }>

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

/** 组装 AxiosResponse（响应体统一深拷贝，模拟真实 HTTP 的 JSON 反序列化） */
function buildResponse(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
): AxiosResponse {
  return {
    data: clonePayload(data),
    status,
    statusText: 'OK',
    headers,
    config,
    request: {},
  }
}

/**
 * 深拷贝响应体
 *
 * 真实后端每次响应都是全新的 JSON 对象，而 mock 直接返回内部引用会导致：
 * 1. 后续 push/splice 绕过 Vue 的响应式追踪；
 * 2. 刷新拿到同一个数组引用，ref 赋同值不触发更新。
 * 这里用 structuredClone 模拟「反序列化出新对象」的行为。
 */
function clonePayload(data: unknown): unknown {
  if (data === null || typeof data !== 'object') return data
  if (data instanceof Blob) return data
  try {
    return structuredClone(data)
  } catch {
    return data
  }
}

/**
 * 构造一个「像真实后端返回」的 AxiosError
 *
 * body 用 ProblemDetail 结构（status/title/detail），
 * 这样 client.ts 的响应拦截器能按统一逻辑解析出提示文案。
 */
function createAxiosError(
  config: InternalAxiosRequestConfig,
  status: number,
  message: string,
): AxiosError {
  return new AxiosError(message, String(status), config, null, {
    data: { status, title: message, detail: message },
    status,
    statusText: message,
    headers: {},
    config,
    request: {},
  })
}

/** 404：路径没匹配到任何 mock 路由 */
function notFound(): MockHttpError {
  return new MockHttpError(404, '接口不存在')
}

/** 空响应体的 content-type 头（DELETE 等返回 null 的接口用） */
function noContent(): Record<string, string> {
  return { 'content-type': 'application/json' }
}

/** 安全转字符串：null/undefined 统一成空串 */
function str(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/** 安全转数字：空值/非数字返回 undefined（用于区分「没传」和「传了 0」） */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** 安全 JSON 解析：解析失败返回 null，不抛异常 */
function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}
