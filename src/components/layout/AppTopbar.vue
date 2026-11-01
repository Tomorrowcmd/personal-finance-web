<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import UserMenu from '@/components/layout/UserMenu.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useUiStore } from '@/stores/ui'

/**
 * 顶栏：页面标题 + 用户菜单（修改密码 / 退出）+ 主题切换 + 快捷记账
 *
 * 标题与副标题来自路由 meta，新增页面时只改 router 配置即可。
 * 顶栏整体 sticky + 半透明背景，滚动时内容从下面穿过。
 */
const route = useRoute()
const ui = useUiStore()

/** 页面标题，未配置 meta 时回退到应用名 */
const title = computed(() => (route.meta.title as string | undefined) ?? '个人财务管家')
/** 页面副标题（可选），窄屏隐藏 */
const subtitle = computed(() => (route.meta.subtitle as string | undefined) ?? '')
</script>

<template>
  <header class="topbar">
    <!-- 左侧：页面标题与副标题（来自路由 meta，随页面切换） -->
    <div class="topbar__heading">
      <h1 class="topbar__title">{{ title }}</h1>
      <p v-if="subtitle" class="topbar__subtitle">{{ subtitle }}</p>
    </div>

    <!-- 右侧：用户菜单 / 主题切换 / 快捷记账 -->
    <div class="topbar__actions">
      <!-- 用户菜单：修改密码 / 退出登录 -->
      <UserMenu />

      <button
        class="icon-btn"
        type="button"
        :aria-label="ui.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
        :title="ui.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
        @click="ui.toggleTheme()"
      >
        <AppIcon :name="ui.theme === 'dark' ? 'sun' : 'moon'" :size="17" />
      </button>

      <BaseButton variant="primary" @click="ui.openQuickAdd()">
        <AppIcon name="plus" :size="15" :stroke-width="2.2" />
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
  height: 68px;
  padding: 0 28px;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
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
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  color: var(--ink-2);
  border: 1px solid transparent;
  transition:
    background-color 0.16s var(--ease),
    color 0.16s var(--ease),
    border-color 0.16s var(--ease);
}

.icon-btn:hover {
  background: var(--surface);
  border-color: var(--line);
  color: var(--ink);
}

@media (max-width: 640px) {
  .topbar {
    height: 60px;
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
