<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import UserMenu from '@/components/layout/UserMenu.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useUiStore } from '@/stores/ui'

/**
 * 顶栏（Element Plus 版）
 *
 * 左侧页面标题（来自路由 meta），右侧：用户下拉菜单、主题切换、快捷记账。
 * 页面滚动后收起透明背景并加一层柔和阴影，让内容与导航的层次更清楚。
 */
const route = useRoute()
const ui = useUiStore()

/** 页面标题 */
const title = computed(() => (route.meta.title as string | undefined) ?? '个人财务管家')
/** 页面副标题 */
const subtitle = computed(() => (route.meta.subtitle as string | undefined) ?? '')
/** 主题按钮的提示文案 */
const themeTip = computed(() => (ui.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'))

/** 是否已经向下滚动（用于切换顶栏的描边与阴影） */
const scrolled = ref(false)

/** 滚动监听：被动监听，避免阻塞滚动 */
function onScroll(): void {
  scrolled.value = window.scrollY > 6
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <header class="topbar" :class="{ 'is-scrolled': scrolled }">
    <div class="topbar__heading">
      <h1 class="topbar__title">{{ title }}</h1>
      <p v-if="subtitle" class="topbar__subtitle">{{ subtitle }}</p>
    </div>

    <div class="topbar__actions">
      <!-- 用户下拉菜单：修改密码 / 退出登录 -->
      <UserMenu />

      <!-- 主题切换 -->
      <el-tooltip :content="themeTip" placement="bottom" :show-after="300">
        <el-button text circle class="icon-btn" :aria-label="themeTip" @click="ui.toggleTheme()">
          <AppIcon :name="ui.theme === 'dark' ? 'sun' : 'moon'" :size="17" />
        </el-button>
      </el-tooltip>

      <!-- 快捷记账 -->
      <BaseButton variant="primary" @click="ui.openQuickAdd()">
        <AppIcon name="plus" :size="15" />
        <span class="topbar__add-label">记一笔</span>
      </BaseButton>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 64px;
  padding: 0 28px;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(12px) saturate(1.4);
  border-bottom: 1px solid transparent;
  transition:
    background-color 0.22s var(--ease),
    border-color 0.22s var(--ease),
    box-shadow 0.22s var(--ease);
}

/* 滚动后：底色变实、描边出现、加一层柔和投影 */
.topbar.is-scrolled {
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  border-bottom-color: color-mix(in srgb, var(--line) 78%, transparent);
  box-shadow: 0 12px 28px -26px rgba(16, 24, 40, 0.55);
}

.topbar__heading {
  min-width: 0;
}

.topbar__title {
  font-size: 17px;
  font-weight: 680;
  letter-spacing: -0.015em;
}

.topbar__subtitle {
  margin-top: 1px;
  font-size: 12px;
  color: var(--ink-3);
}

.topbar__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.icon-btn {
  width: 34px;
  height: 34px;
  color: var(--ink-2);
}

.icon-btn:hover {
  background: var(--surface);
  color: var(--ink);
}

@media (max-width: 640px) {
  .topbar {
    height: 58px;
    padding: 0 16px;
  }

  .topbar__subtitle {
    display: none;
  }

  .topbar__title {
    font-size: 16px;
  }

  .topbar__add-label {
    display: none;
  }

  .topbar__actions {
    gap: 2px;
  }
}
</style>
