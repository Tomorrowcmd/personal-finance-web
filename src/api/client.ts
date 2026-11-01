import axios, { AxiosError, type AxiosInstance } from 'axios'

import { getToken } from '@/utils/session'

/**
 * 统一的 axios 实例
 *
 * 设计要点：
 * - baseURL 取 VITE_API_BASE_URL，开发环境是 /api（由 Vite 代理转发到 Spring Boot）
 * - 请求拦截器自动附加 Bearer Token，业务代码不用关心鉴权头
 * - 响应拦截器把「网络错误 / 超时 / HTTP 错误 / ProblemDetail」统一收敛成 ApiError，
 *   页面只需要 `toast.error(errorMessage(e))`
 * - 后端错误格式采用 RFC 7807 ProblemDetail（Spring Boot 默认）：{ title, status, detail }
 */
export const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  // 20s：导出 Excel 或首次冷启动后端可能略慢，但也不至于让用户干等
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
  },
})

/**
 * 业务错误
 *
 * status = 0 表示「没拿到响应」（断网、超时、后端未启动），其余为 HTTP 状态码。
 * 页面通过 errorMessage(error) 取可展示文案，不需要自己判断类型。
 */
export class ApiError extends Error {
  /** HTTP 状态码；0 表示网络层失败 */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 后端 ProblemDetail 结构（字段按需取用，不同版本 Spring 字段略有差异） */
interface ProblemDetail {
  title?: string
  detail?: string
  message?: string
  status?: number
}

/**
 * 从响应体里解析错误描述
 *
 * 需要兼容几种情况：
 * - 导出接口的 responseType 是 blob，错误体也会是 Blob；
 * - 网关/代理返回的可能是纯文本；
 * - 正常 Spring 返回的是 JSON（ProblemDetail）。
 * 解析失败一律返回 null，由调用方使用兜底文案。
 */
async function readProblemDetail(data: unknown): Promise<string | null> {
  try {
    if (data instanceof Blob) {
      const text = await data.text()
      return readProblemDetail(text)
    }
    if (typeof data === 'string') {
      if (!data.trim()) return null
      try {
        return readProblemDetail(JSON.parse(data) as ProblemDetail)
      } catch {
        // 不是 JSON，截断后当作纯文本错误
        return data.slice(0, 200)
      }
    }
    if (data && typeof data === 'object') {
      const problem = data as ProblemDetail
      return problem.detail ?? problem.message ?? problem.title ?? null
    }
  } catch {
    return null
  }
  return null
}

/**
 * 401 回调
 *
 * client 不直接依赖 store / router（会形成循环依赖），
 * 由 main.ts 在启动时注册「清空会话 + 跳转登录页」的具体行为。
 */
let unauthorizedHandler: (() => void) | null = null

/** 注册会话失效时的处理逻辑（只应由 main.ts 调用一次） */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler
}

/**
 * 是否为登录请求
 *
 * 登录接口返回 401 表示「账号密码错误」，属于正常业务失败，
 * 不能触发全局登出，否则用户刚输错密码就被清空会话。
 */
function isLoginRequest(url: string | undefined): boolean {
  return Boolean(url?.includes('/auth/login'))
}

// 请求拦截器：每次请求从 localStorage 读 token 并附加（而非缓存在内存，避免多标签页不同步）
http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<unknown>) => {
    const response = error.response

    // 没拿到响应：后端未启动、断网、超时
    if (!response) {
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      const message = isTimeout
        ? '请求超时，请稍后重试'
        : '无法连接后端服务，请确认服务已启动或开启模拟数据（VITE_USE_MOCK）'
      return Promise.reject(new ApiError(message, 0))
    }

    // 会话失效：交给全局处理器（清空本地登录态并跳转登录页）
    if (response.status === 401 && !isLoginRequest(error.config?.url)) {
      unauthorizedHandler?.()
    }

    // 错误文案优先级：后端 detail > 兜底文案
    const detail = await readProblemDetail(response.data)
    const fallback = response.status >= 500 ? '服务器开小差了，请稍后重试' : '请求失败'
    return Promise.reject(new ApiError(detail ?? fallback, response.status))
  },
)

/**
 * 把任意异常转成可直接展示的中文文案
 *
 * 页面 catch 里统一用 `toast.error(errorMessage(error))`，
 * 不用关心是 ApiError、原生 Error 还是别的东西。
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return '发生未知错误，请稍后重试'
}

/**
 * 去掉查询参数中的空值，避免拼出 ?keyword=&type= 这种无意义参数。
 * 后端用 @RequestParam(required = false) 接收，空串会被当成有效条件。
 */
export function cleanParams<T extends object>(params: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === '' || value === null || value === undefined) continue
    result[key] = value
  }
  return result
}
