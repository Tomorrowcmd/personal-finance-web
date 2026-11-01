import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { authApi } from '@/api/auth'
import type { AuthUser, ChangePasswordPayload, LoginPayload } from '@/types'
import { clearSession, getStoredUser, getToken, saveSession } from '@/utils/session'

/**
 * 登录态
 *
 * 数据来源与去向：
 * - 初始值从 localStorage 读取（getToken / getStoredUser），刷新页面不掉线；
 * - 登录成功写回 localStorage（saveSession）；
 * - 路由守卫读 isAuthenticated，axios 拦截器读 token；
 * - 401 时只调用 logout()（纯本地清理），避免「清理时又发请求」的死循环。
 */
export const useAuthStore = defineStore('auth', () => {
  /** 访问令牌；空串表示未登录 */
  const token = ref(getToken())
  /** 当前用户信息；可能为 null（例如只清了 token 没清 user 的异常态） */
  const user = ref<AuthUser | null>(getStoredUser())

  /** 是否已登录：路由守卫的唯一判断依据 */
  const isAuthenticated = computed(() => token.value.length > 0)
  /** 展示名：优先 displayName，其次账号名，最后兜底「我」 */
  const displayName = computed(() => user.value?.displayName || user.value?.username || '我')
  /** 头像里的首字母（中文取第一个字） */
  const initial = computed(() => displayName.value.slice(0, 1).toUpperCase())

  /**
   * 登录
   *
   * 接口成功后才写入状态与本地存储；失败直接抛出，由登录页展示错误。
   */
  async function login(payload: LoginPayload): Promise<void> {
    const result = await authApi.login(payload)
    token.value = result.token
    user.value = result.user
    saveSession(result.token, result.user)
  }

  /**
   * 仅清空本地会话
   *
   * 用于 401 场景：令牌已失效，再调 /auth/logout 没有意义，还可能递归。
   */
  function logout(): void {
    token.value = ''
    user.value = null
    clearSession()
  }

  /**
   * 主动退出登录
   *
   * 先通知后端作废令牌（JWT 无状态时可忽略），
   * 无论成功与否都清空本地，保证用户一定能退出。
   */
  async function signOut(): Promise<void> {
    try {
      await authApi.logout()
    } catch {
      // 后端不可用也要让用户退出
    } finally {
      logout()
    }
  }

  /**
   * 修改密码
   *
   * 成功后当前会话保持有效（后端不强制下线时）；
   * 若后端选择让旧令牌失效，下一次请求的 401 会自动跳回登录页。
   */
  async function changePassword(payload: ChangePasswordPayload): Promise<void> {
    await authApi.changePassword(payload)
  }

  return {
    token,
    user,
    isAuthenticated,
    displayName,
    initial,
    login,
    logout,
    signOut,
    changePassword,
  }
})
