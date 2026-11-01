/**
 * 领域模型定义（前端唯一的数据契约来源）
 *
 * 这些类型与后端接口一一对应，命名也与 Java 侧保持一致：
 * - 枚举使用大写字符串（EXPENSE / INCOME），对应 Java enum TransactionType
 * - 日期使用 ISO 字符串（yyyy-MM-dd），不带时区，避免跨时区解析偏移
 * - 月份使用 yyyy-MM，只到月粒度
 * - 金额单位统一为「元」，最多两位小数，后端用 BigDecimal(12,2) 承接
 *
 * 约定：所有 `xxxPayload` 都是「提交给后端的请求体」，不含主键与审计字段；
 * 所有查询条件都是可选字段，缺省表示不参与过滤（axios 层会剔除空值）。
 */

/** 收支类型：支出 / 收入。决定金额在 UI 上的正负号与颜色 */
export type TransactionType = 'EXPENSE' | 'INCOME'

/** 分类（餐饮、交通、工资……）。分类是统计与图表的基础维度 */
export interface Category {
  /** 主键，后端自增 */
  id: number
  /** 分类名，1-12 个字，同类型下不允许重名 */
  name: string
  /** 归属的收支类型：支出分类只能记支出，收入分类只能记收入 */
  type: TransactionType
  /** 十六进制颜色（#RRGGBB），用于图表扇区、图例圆点与分类标签底色 */
  color: string
  /** emoji 图标，直接用字符渲染，避免引入图标库 */
  icon: string
}

/** 新建 / 编辑分类时提交的字段（不含 id，id 由后端生成） */
export interface CategoryPayload {
  /** 分类名，前后端都会校验 1-12 字 */
  name: string
  /** 收支类型，已被流水引用的分类不允许修改该字段 */
  type: TransactionType
  /** 颜色 #RRGGBB */
  color: string
  /** emoji 图标 */
  icon: string
}

/** 一条收支流水 */
export interface Transaction {
  /** 主键 */
  id: number
  /** 收支类型，决定金额方向（支出为负向展示，收入为正向） */
  type: TransactionType
  /** 金额（元，正数；方向由 type 决定，不使用负数表示支出） */
  amount: number
  /** 所属分类 id */
  categoryId: number
  /** 分类名快照：列表渲染时直接使用，避免二次查分类（后端 join 返回） */
  categoryName: string
  /** 分类颜色快照，用于分类小圆点 */
  categoryColor: string
  /** 分类 emoji 快照 */
  categoryIcon: string
  /** 记账日期 yyyy-MM-dd（自然日，不含时间，统计按月归属） */
  date: string
  /** 备注，≤50 字，可为空串 */
  note: string
  /** 创建时间，ISO 8601 字符串（如 2026-10-26T12:30:00+08:00） */
  createdAt: string
}

/** 新建 / 编辑流水的提交体 */
export interface TransactionPayload {
  /** 收支类型，必须与所选分类的 type 一致 */
  type: TransactionType
  /** 金额（元），> 0 且 ≤ 99,999,999.99，最多两位小数 */
  amount: number
  /** 分类 id，必须存在 */
  categoryId: number
  /** 日期 yyyy-MM-dd，前端限制不能选未来日期 */
  date: string
  /** 备注，可为空串，≤50 字 */
  note: string
}

/** 流水列表的查询条件（列表、汇总、导出三处共用同一份条件） */
export interface TransactionQuery {
  /** 页码，从 1 开始；不传默认 1 */
  page?: number
  /** 每页条数，默认 10，最大 100 */
  size?: number
  /** 起始日期（含当天）yyyy-MM-dd，空串表示不限 */
  startDate?: string
  /** 结束日期（含当天）yyyy-MM-dd，空串表示不限 */
  endDate?: string
  /** 收支类型过滤，空串表示全部 */
  type?: TransactionType | ''
  /** 分类 id 过滤，空串表示全部分类 */
  categoryId?: number | ''
  /** 关键字，模糊匹配备注或分类名（后端忽略大小写） */
  keyword?: string
}

/** 通用分页结构，后端对应 Spring Data 的 Page，由前端适配成扁平字段 */
export interface PageResult<T> {
  /** 当前页数据 */
  items: T[]
  /** 当前页，从 1 开始（Spring 的 page 从 0 开始，需要在后端 +1） */
  page: number
  /** 每页条数 */
  size: number
  /** 满足条件的总条数 */
  total: number
  /** 总页数，空数据时后端应返回至少 1，避免分页器计算异常 */
  totalPages: number
}

/** 区间汇总（明细页顶部汇总条使用） */
export interface Summary {
  /** 收入合计（元） */
  income: number
  /** 支出合计（元） */
  expense: number
  /** 结余 = income - expense，可能为负 */
  balance: number
  /** 记录条数 */
  count: number
}

/** 月度收支点（趋势图 / 结余图的数据源） */
export interface MonthlyPoint {
  /** 月份 yyyy-MM */
  month: string
  /** 当月收入合计（元） */
  income: number
  /** 当月支出合计（元） */
  expense: number
}

/** 分类维度统计（环形图、排行图、图例使用） */
export interface CategoryStat {
  /** 分类 id；前端把「其他」合并项固定为 -1 */
  categoryId: number
  /** 分类名 */
  name: string
  /** emoji 图标 */
  icon: string
  /** 颜色 #RRGGBB，直接用于图表扇区 */
  color: string
  /** 该分类金额合计（元） */
  amount: number
  /** 占同类型总额的百分比（0-100，保留一位小数） */
  percent: number
}

/** 预算中的单个分类额度 */
export interface BudgetItem {
  /** 分类 id（只可能是支出分类） */
  categoryId: number
  /** 用户设置的预算金额（元） */
  amount: number
  /** 已花费金额（元），由后端按当月该分类的流水实时统计，不落库 */
  spent: number
}

/** 某个月的预算 */
export interface Budget {
  /** 月份 yyyy-MM */
  month: string
  /** 本月总预算（元），0 表示未设置 */
  totalAmount: number
  /** 本月实际总支出（元），包含未单独设预算的分类 */
  totalSpent: number
  /** 已单独设置预算的分类明细；未设置时为空数组 */
  items: BudgetItem[]
}

/** 保存预算的请求体（整体覆盖，PUT 语义） */
export interface BudgetPayload {
  /** 总预算（元），≥ 0 */
  totalAmount: number
  /** 分类预算列表，只提交 amount > 0 的项；同一分类不可重复 */
  items: Array<{ categoryId: number; amount: number }>
}

/** 日期区间（快捷筛选与自定义区间共用的最小结构） */
export interface DateRange {
  /** 起始日期 yyyy-MM-dd */
  startDate: string
  /** 结束日期 yyyy-MM-dd */
  endDate: string
}

/* ------------------------------------------------------------------ */
/* 鉴权                                                                */
/* ------------------------------------------------------------------ */

/** 登录用户信息 */
export interface AuthUser {
  /** 登录账号 */
  username: string
  /** 展示名，缺省时前端回退到 username */
  displayName: string
}

/** 登录请求体 */
export interface LoginPayload {
  /** 账号 */
  username: string
  /** 明文密码，仅通过 HTTPS 传输；前端不做本地保存 */
  password: string
}

/** 登录成功响应：token 为 JWT（或后端自定义的不透明令牌） */
export interface LoginResponse {
  /** 访问令牌，前端后续请求放在 Authorization: Bearer <token> 中 */
  token: string
  /** 过期时间 ISO 8601，可选；前端目前只做展示层预留 */
  expiresAt?: string
  /** 当前登录用户 */
  user: AuthUser
}

/** 修改密码请求体 */
export interface ChangePasswordPayload {
  /** 当前密码，由后端校验；错误时应返回 400 而不是 401 */
  oldPassword: string
  /** 新密码，长度 6-32，且不能与原密码相同 */
  newPassword: string
}
