<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppIcon from '@/components/ui/AppIcon.vue'
import { useUiStore } from '@/stores/ui'

/**
 * 左侧导航（Element Plus 版）
 *
 * 桌面端是 el-menu 垂直导航，支持一键收起/展开（状态持久化到 localStorage）；
 * 窄屏（<960px）通过 CSS 变成底部标签栏，同一份 DOM 两种布局。
 *
 * 选中态交给 el-menu 的 router 模式 + default-active（当前路径）。
 */
const route = useRoute()
const ui = useUiStore()

/** 是否收起 */
const collapsed = computed(() => ui.sidebarCollapsed)

/** 是否处于本地模拟数据模式（只影响侧栏底部的「演示数据」角标） */
const isMock = import.meta.env.VITE_USE_MOCK === 'true'

/** 折叠按钮的提示文案 */
const collapseTip = computed(() => (collapsed.value ? '展开侧边栏' : '收起侧边栏'))

/** 导航项：index 即路由地址 */
const NAV_ITEMS = [
  { name: 'dashboard', to: '/', icon: 'dashboard', label: '总览' },
  { name: 'records', to: '/records', icon: 'list', label: '明细' },
  { name: 'statistics', to: '/statistics', icon: 'chart', label: '统计' },
  { name: 'budget', to: '/budget', icon: 'wallet', label: '预算' },
  { name: 'categories', to: '/categories', icon: 'tag', label: '分类' },
] as const
</script>

<template>
  <aside class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <!-- 品牌区 -->
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

    <!-- 侧栏边缘的折叠按钮（贴底，悬浮在右侧边框上） -->
    <el-tooltip :content="collapseTip" placement="right">
      <button
        class="collapse-btn"
        type="button"
        :aria-label="collapseTip"
        :aria-expanded="!collapsed"
        @click="ui.toggleSidebar()"
      >
        <AppIcon :name="collapsed ? 'chevronRight' : 'chevronLeft'" :size="13" />
      </button>
    </el-tooltip>

    <!-- 主导航：el-menu 路由模式 -->
    <el-menu :default-active="route.path" router class="nav" :ellipsis="false">
      <el-menu-item v-for="item in NAV_ITEMS" :key="item.name" :index="item.to">
        <el-tooltip
          :content="item.label"
          placement="right"
          :disabled="!collapsed"
          :show-after="120"
        >
          <span class="nav__inner">
            <AppIcon :name="item.icon" :size="18" />
            <span class="nav__label">{{ item.label }}</span>
          </span>
        </el-tooltip>
      </el-menu-item>
    </el-menu>

    <!-- 底部：主题切换 / 版本号 -->
    <div class="sidebar__foot">
      <el-tooltip
        :content="ui.theme === 'dark' ? '切换浅色' : '切换深色'"
        placement="right"
        :disabled="!collapsed"
      >
        <el-button text class="side-action" @click="ui.toggleTheme()">
          <AppIcon :name="ui.theme === 'dark' ? 'sun' : 'moon'" :size="15" />
          <span class="side-action__text">{{ ui.theme === 'dark' ? '切换浅色' : '切换深色' }}</span>
        </el-button>
      </el-tooltip>
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
  padding: 20px 12px 14px;
  background: linear-gradient(
    180deg,
    var(--surface) 0%,
    color-mix(in srgb, var(--surface) 72%, var(--bg)) 100%
  );
  border-right: 1px solid var(--line);
  flex: none;
  transition: width 0.24s var(--ease-out);
  z-index: 30;
}

/* 收起状态：只留图标 */
.sidebar.is-collapsed {
  width: 78px;
  padding-left: 10px;
  padding-right: 10px;
}

/* 品牌 */
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 8px 20px;
  min-width: 0;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(150deg, #14917a 0%, #0c6a56 100%);
  box-shadow: 0 6px 16px -8px var(--brand-ring);
  flex: none;
  transition: transform 0.2s var(--ease-out);
}

.brand:hover .brand__mark {
  transform: translateY(-1px) scale(1.04);
}

.brand__mark svg {
  width: 20px;
  height: 20px;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
  transition:
    opacity 0.18s var(--ease),
    width 0.24s var(--ease-out);
  white-space: nowrap;
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

.is-collapsed .brand {
  padding-left: 0;
  padding-right: 0;
  justify-content: center;
}

.is-collapsed .brand__text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

/* 导航 */
.nav {
  border-right: none;
  background: transparent;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav :deep(.el-menu-item) {
  position: relative;
  height: 40px;
  line-height: 40px;
  margin-bottom: 2px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 550;
  overflow: hidden;
  transition:
    background-color 0.18s var(--ease),
    color 0.18s var(--ease);
}

.nav :deep(.el-menu-item:hover) {
  background: var(--surface-soft);
  color: var(--ink);
}

.nav :deep(.el-menu-item.is-active) {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--brand) 14%, transparent) 0%,
    color-mix(in srgb, var(--brand) 5%, transparent) 100%
  );
  color: var(--brand-strong);
  font-weight: 650;
}

[data-theme='dark'] .nav :deep(.el-menu-item.is-active) {
  color: var(--brand);
}

/* 选中项左侧的小竖条 */
.nav :deep(.el-menu-item.is-active)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 18px;
  border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
  background: var(--brand);
  transform: translateY(-50%);
}

.nav__inner {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.nav :deep(.el-menu-item .el-icon) {
  margin-right: 0;
  flex: none;
}

.nav__label {
  line-height: 1;
  white-space: nowrap;
  transition: opacity 0.16s var(--ease);
}

/* 收起：图标居中、文字淡出 */
.is-collapsed .nav :deep(.el-menu-item) {
  padding: 0;
  justify-content: center;
}

.is-collapsed .nav__inner {
  justify-content: center;
  gap: 0;
}

.is-collapsed .nav__label {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.is-collapsed .nav :deep(.el-menu-item.is-active)::before {
  height: 14px;
}

/* 底部 */
.sidebar__foot {
  margin-top: 8px;
  padding: 12px 4px 0;
  border-top: 1px solid var(--line);
}

/* 底部操作：收起侧栏 / 主题切换 */
.side-action {
  width: 100%;
  justify-content: flex-start;
  height: 34px;
  padding: 0 8px;
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 500;
  gap: 8px;
}

.side-action:hover {
  background: var(--surface-soft);
  color: var(--ink);
}

.side-action__text {
  white-space: nowrap;
  transition: opacity 0.16s var(--ease);
}

.sidebar__version {
  margin-top: 6px;
  padding: 0 8px;
  font-size: 11px;
  color: var(--ink-3);
  white-space: nowrap;
}

/* 侧栏边缘的折叠按钮：贴底、骑在右边框上 */
.collapse-btn {
  position: absolute;
  right: -13px;
  bottom: 22px;
  z-index: 5;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink-3);
  box-shadow: var(--shadow-sm);
  transition:
    color 0.16s var(--ease),
    border-color 0.16s var(--ease),
    background-color 0.16s var(--ease),
    box-shadow 0.16s var(--ease),
    transform 0.16s var(--ease);
}

.collapse-btn:hover {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 40%, var(--line));
  background: var(--brand-soft);
  box-shadow: var(--shadow-xs);
  transform: translateX(1px);
}

.collapse-btn:active {
  transform: scale(0.94);
}

[data-theme='dark'] .collapse-btn {
  background: var(--surface-soft);
}

[data-theme='dark'] .collapse-btn:hover {
  background: var(--brand-soft);
  color: var(--brand);
}

.is-collapsed .sidebar__foot {
  padding-left: 0;
  padding-right: 0;
}

.is-collapsed .side-action {
  justify-content: center;
  padding: 0;
}

.is-collapsed .side-action__text,
.is-collapsed .sidebar__version {
  display: none;
}

/* 窄屏：底部标签栏（不参与折叠） */
@media (max-width: 960px) {
  .sidebar,
  .sidebar.is-collapsed {
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
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(12px);
    box-shadow: 0 -6px 20px -16px rgba(0, 0, 0, 0.4);
  }

  .brand,
  .sidebar__foot,
  .collapse-btn {
    display: none;
  }

  .nav {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    width: 100%;
    overflow: visible;
  }

  .nav :deep(.el-menu-item),
  .is-collapsed .nav :deep(.el-menu-item) {
    flex: 1;
    flex-direction: column;
    height: 48px;
    line-height: 1.2;
    margin-bottom: 0;
    padding: 6px 4px;
    gap: 3px;
    font-size: 10.5px;
  }

  .nav :deep(.el-menu-item.is-active)::before {
    display: none;
  }

  .nav__inner {
    flex-direction: column;
    gap: 3px;
    justify-content: center;
  }

  .nav__label,
  .is-collapsed .nav__label {
    font-size: 10.5px;
    opacity: 1;
    width: auto;
  }
}
</style>
