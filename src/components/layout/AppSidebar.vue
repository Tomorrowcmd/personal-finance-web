<script setup lang="ts">
import { useRoute } from 'vue-router'

import AppIcon from '@/components/ui/AppIcon.vue'
import { useUiStore } from '@/stores/ui'

/**
 * 左侧导航
 *
 * 桌面端是固定侧栏；窄屏（<960px）通过 CSS 变成底部标签栏，
 * 同一份 DOM 两种布局，不做 v-if 切换。
 *
 * 高亮逻辑用 route.name 精确匹配（而不是 RouterLink 的 active-class），
 * 因为 "/" 是所有路径的前缀，前缀匹配会让「总览」永远高亮。
 */
const route = useRoute()
const ui = useUiStore()

/** 是否处于本地模拟数据模式（只影响侧栏底部的「演示数据」角标） */
const isMock = import.meta.env.VITE_USE_MOCK === 'true'

/** 导航项：name 与路由 name 对应，用于判断选中态 */
const NAV_ITEMS = [
  { name: 'dashboard', to: '/', icon: 'dashboard', label: '总览' },
  { name: 'records', to: '/records', icon: 'list', label: '明细' },
  { name: 'statistics', to: '/statistics', icon: 'chart', label: '统计' },
  { name: 'budget', to: '/budget', icon: 'wallet', label: '预算' },
  { name: 'categories', to: '/categories', icon: 'tag', label: '分类' },
] as const
</script>

<template>
  <aside class="sidebar">
    <!-- 品牌区：点击回到总览；窄屏时整块隐藏，由底部标签栏替代 -->
    <RouterLink to="/" class="brand" aria-label="返回总览">
      <span class="brand__mark" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 16V9.5a1 1 0 0 1 1.6-.8l2.7 2.2a1 1 0 0 0 1.3 0l2.7-2.2a1 1 0 0 1 1.6.8V16" />
          <circle cx="12" cy="18.5" r="1.1" fill="#F2C14E" stroke="none" />
        </svg>
      </span>
      <span class="brand__text">
        <span class="brand__name">财务管家</span>
        <span class="brand__desc">Personal Finance</span>
      </span>
    </RouterLink>

    <!-- 主导航：选中态按 route.name 精确匹配，不依赖路径前缀 -->
    <nav class="nav" aria-label="主导航">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.name"
        :to="item.to"
        class="nav__item"
        :class="{ 'is-active': route.name === item.name }"
        :aria-current="route.name === item.name ? 'page' : undefined"
      >
        <span class="nav__icon"><AppIcon :name="item.icon" :size="17" /></span>
        <span class="nav__label">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- 底部：主题切换 + 版本号（窄屏隐藏，主题在顶栏也有入口） -->
    <div class="sidebar__foot">
      <button
        v-if="ui.theme !== undefined"
        class="theme-switch"
        type="button"
        @click="ui.toggleTheme()"
      >
        <AppIcon :name="ui.theme === 'dark' ? 'sun' : 'moon'" :size="15" />
        <span>{{ ui.theme === 'dark' ? '切换浅色' : '切换深色' }}</span>
      </button>
      <p class="sidebar__version">v1.0.0<span v-if="isMock"> · 演示数据</span></p>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  width: 232px;
  height: 100vh;
  padding: 22px 16px 16px;
  background: var(--surface);
  border-right: 1px solid var(--line);
  flex: none;
}

/* 品牌 */
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 20px;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--brand);
  box-shadow: 0 4px 12px -4px var(--brand-ring);
  flex: none;
}

.brand__mark svg {
  width: 20px;
  height: 20px;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand__name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.brand__desc {
  font-size: 10.5px;
  color: var(--ink-3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* 导航 */
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav__item {
  display: flex;
  align-items: center;
  gap: 11px;
  height: 40px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 550;
  transition:
    background-color 0.16s var(--ease),
    color 0.16s var(--ease);
}

.nav__item:hover {
  background: var(--surface-soft);
  color: var(--ink);
}

.nav__item.is-active {
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-weight: 650;
}

.nav__icon {
  display: grid;
  place-items: center;
  width: 18px;
  flex: none;
}

/* 底部 */
.sidebar__foot {
  margin-top: auto;
  padding: 12px 6px 0;
  border-top: 1px solid var(--line);
}

.theme-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 34px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  color: var(--ink-2);
  font-size: 12.5px;
}

.theme-switch:hover {
  background: var(--surface-soft);
  color: var(--ink);
}

.sidebar__version {
  margin-top: 6px;
  padding: 0 8px;
  font-size: 11px;
  color: var(--ink-3);
}

/* 窄屏：底部标签栏 */
@media (max-width: 960px) {
  .sidebar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    z-index: 60;
    width: 100%;
    height: auto;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    border-right: none;
    border-top: 1px solid var(--line);
    flex-direction: row;
    box-shadow: 0 -6px 20px -16px rgba(0, 0, 0, 0.4);
  }

  .brand,
  .sidebar__foot {
    display: none;
  }

  .nav {
    flex-direction: row;
    justify-content: space-around;
    width: 100%;
    gap: 2px;
  }

  .nav__item {
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    height: 48px;
    padding: 0 6px;
    flex: 1;
    font-size: 11px;
    border-radius: var(--radius-sm);
  }

  .nav__label {
    font-size: 10.5px;
  }
}
</style>
