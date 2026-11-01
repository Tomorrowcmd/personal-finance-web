import type { AuthUser } from '@/types'

/**
 * 会话存储（localStorage 读写封装）
 *
 * 存了三个 key：
 * - pf.token    访问令牌，axios 拦截器每次请求读取
 * - pf.user     用户信息（用户名 / 展示名），用于顶栏头像与称呼
 * - pf.username 「记住账号」的账号，仅用于登录页预填
 *
 * 安全说明：token 放 localStorage 对 XSS 没有防护，是个人自用工具的取舍；
 * 若要更严格，可让后端改用 HttpOnly Cookie 承载会话，前端只保留用户信息。
 */

/** 令牌 key */
const TOKEN_KEY = 'pf.token'
/** 用户信息 key */
const USER_KEY = 'pf.user'
/** 记住账号的 key */
const REMEMBER_KEY = 'pf.username'

/** 读取 token（没有则返回空串，axios 拦截器据此决定是否带 Authorization） */
export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

/**
 * 读取缓存的用户信息
 *
 * 解析失败或缺少 username 时返回 null（视为未登录），
 * displayName 缺失时回退到 username。
 */
export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (!parsed.username) return null
    return { username: parsed.username, displayName: parsed.displayName ?? parsed.username }
  } catch {
    return null
  }
}

/** 登录成功后写入 token 与用户信息 */
export function saveSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/**
 * 清空会话（退出登录 / 401 失效）
 *
 * 只清 token 与 user，不删「记住账号」，下次登录仍能预填账号。
 */
export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** 读取「记住账号」保存的账号（登录页初始值） */
export function getRememberedUsername(): string {
  return localStorage.getItem(REMEMBER_KEY) ?? ''
}

/**
 * 保存 / 清除「记住账号」
 *
 * 只保存账号，绝不保存密码；传空串表示取消记住。
 */
export function setRememberedUsername(username: string): void {
  if (username) localStorage.setItem(REMEMBER_KEY, username)
  else localStorage.removeItem(REMEMBER_KEY)
}
