import type { AuthUser, ChangePasswordPayload, LoginPayload, LoginResponse } from '@/types'

import { http } from './client'

/**
 * 鉴权接口
 *
 * 约定：
 * - 登录成功后后端返回 token，前端在后续请求头里带 `Authorization: Bearer <token>`
 * - 会话失效统一返回 401，前端拦截器会自动清除登录态并跳转登录页
 */
export const authApi = {
  login(payload: LoginPayload): Promise<LoginResponse> {
    return http.post<LoginResponse>('/auth/login', payload).then((res) => res.data)
  },

  /** 校验当前 token 并返回用户信息（可用于刷新页面后同步用户资料） */
  me(): Promise<AuthUser> {
    return http.get<AuthUser>('/auth/me').then((res) => res.data)
  },

  /** 通知后端作废当前会话；前端无论成功与否都会清空本地状态 */
  logout(): Promise<void> {
    return http.post<void>('/auth/logout').then(() => undefined)
  },

  /**
   * 修改密码
   *
   * 注意：原密码错误时后端应返回 400（而不是 401），
   * 否则会被前端当成「会话失效」直接登出。
   */
  changePassword(payload: ChangePasswordPayload): Promise<void> {
    return http.post<void>('/auth/password', payload).then(() => undefined)
  },
}
