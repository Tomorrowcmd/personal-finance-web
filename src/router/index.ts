import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

/**
 * 路由表
 *
 * meta.title / meta.subtitle 会被顶栏与 document.title 使用。
 * meta.layout = 'blank' 的页面不渲染侧栏与顶栏（登录页）。
 * 页面全部按需加载（动态 import），首屏只下载必要代码。
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录', layout: 'blank' },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: '总览', subtitle: '本月收支一览' },
    },
    {
      path: '/records',
      name: 'records',
      component: () => import('@/views/RecordsView.vue'),
      meta: { title: '收支明细', subtitle: '搜索、筛选并管理每一笔记录' },
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: () => import('@/views/StatisticsView.vue'),
      meta: { title: '统计分析', subtitle: '看清钱花在了哪里' },
    },
    {
      path: '/budget',
      name: 'budget',
      component: () => import('@/views/BudgetView.vue'),
      meta: { title: '预算管理', subtitle: '给每个月设一道护栏' },
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategoriesView.vue'),
      meta: { title: '分类管理', subtitle: '自定义收支分类与配色' },
    },
    {
      // 未知路径统一回到总览
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * 全局守卫：除登录页外都要求已登录。
 * 未登录访问业务页时记住原地址，登录成功后回跳。
 */
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.name === 'login') {
    // 已登录再访问登录页，直接进首页（或跳回原本要去的页面）
    if (auth.isAuthenticated) {
      const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
      return redirect.startsWith('/') && !redirect.startsWith('/login') ? redirect : '/'
    }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
