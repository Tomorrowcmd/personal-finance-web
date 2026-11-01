<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import TransactionFormModal from '@/components/records/TransactionFormModal.vue'
import ConfirmHost from '@/components/ui/ConfirmHost.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { useAuthStore } from '@/stores/auth'
import { useCategoryStore } from '@/stores/category'
import { useUiStore } from '@/stores/ui'

/**
 * 应用外壳
 *
 * - 登录页（meta.layout = 'blank'）只渲染页面本身，没有侧栏/顶栏
 * - 其余页面是「侧栏 + 顶栏 + 路由视图」；全局挂载记账弹窗、Toast、Confirm
 */
const route = useRoute()
const ui = useUiStore()
const auth = useAuthStore()
const categories = useCategoryStore()

/** 应用名（来自 .env 的 VITE_APP_TITLE），用于拼 document.title 与兜底标题 */
const APP_NAME = import.meta.env.VITE_APP_TITLE || '个人财务管家'

/** 是否需要「无壳」布局（登录页）：true 时不渲染侧栏与顶栏 */
const isBlankLayout = computed(() => route.meta.layout === 'blank')

// 路由切换时同步浏览器标签页标题：`页面名 · 应用名`
watch(
  () => route.meta.title as string | undefined,
  (title) => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  },
  { immediate: true },
)

// 登录后拉取一次分类基础数据（未登录时不请求，避免触发 401）
watch(
  () => auth.isAuthenticated,
  (authed) => {
    if (authed) {
      void categories.load()
    } else {
      // 退出登录时收起可能开着的记账弹窗
      ui.quickAddOpen = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <!-- 登录页：整页布局，不套外壳 -->
  <div v-if="isBlankLayout" class="app-blank">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>

  <div v-else class="app">
    <AppSidebar />

    <div class="app__main">
      <AppTopbar />

      <main class="app__content">
        <RouterView v-slot="{ Component, route: current }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="current.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- 全局弹窗与提示 -->
    <TransactionFormModal v-model="ui.quickAddOpen" />
  </div>

  <ToastHost />
  <ConfirmHost />
</template>

<style scoped>
.app {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
}

.app-blank {
  min-height: 100vh;
  background: var(--bg);
}

.app__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.app__content {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 28px 56px;
  flex: 1;
}

@media (max-width: 960px) {
  .app__content {
    padding: 18px 16px 88px;
  }
}
</style>
