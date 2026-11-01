<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'

import AppIcon from '@/components/ui/AppIcon.vue'
import ChangePasswordModal from '@/components/auth/ChangePasswordModal.vue'

/**
 * 顶栏用户菜单
 *
 * 点击头像展开：修改密码 / 退出登录。
 * 交互细节：
 * - 点击菜单外部关闭（监听 document，注意用 .stop 避免刚点开就被关掉）
 * - Esc 关闭
 * - 退出登录保留二次确认，避免误点
 * - 修改密码用独立弹窗，不关闭当前页面
 */
const auth = useAuthStore()
const confirm = useConfirmStore()
const toast = useToastStore()
const router = useRouter()

/** 下拉菜单是否展开 */
const open = ref(false)
/** 修改密码弹窗是否打开 */
const passwordOpen = ref(false)
/** 菜单根节点，用于判断点击是否发生在菜单内部 */
const root = ref<HTMLElement | null>(null)

/** 展开/收起 */
function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

/** 点击文档其它位置：关闭菜单（点在菜单内则忽略） */
function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return
  if (root.value && !root.value.contains(event.target as Node)) close()
}

/** Esc 关闭菜单 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) close()
}

// 全局监听只在组件挂载期间生效，卸载时记得移除，避免内存泄漏
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

/** 打开修改密码弹窗，同时收起菜单 */
function openPasswordModal(): void {
  close()
  passwordOpen.value = true
}

/**
 * 退出登录
 *
 * 先确认，再让 store 通知后端并清空本地会话；
 * 最后跳登录页（用 replace，避免用户按返回键又回到已登出的页面）。
 */
async function handleLogout(): Promise<void> {
  close()
  const confirmed = await confirm.ask({
    title: '退出登录',
    message: '确定要退出当前账号吗？退出后需要重新输入账号和密码。',
    confirmText: '退出登录',
    tone: 'danger',
  })
  if (!confirmed) return

  await auth.signOut()
  toast.success('已退出登录')
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div ref="root" class="user-menu">
    <button
      class="trigger"
      type="button"
      :aria-expanded="open"
      aria-haspopup="menu"
      :title="`${auth.displayName} 的账号菜单`"
      @click.stop="toggle"
    >
      <span class="trigger__avatar">{{ auth.initial }}</span>
      <span class="trigger__name">{{ auth.displayName }}</span>
      <AppIcon name="chevronDown" :size="13" class="trigger__caret" />
    </button>

    <Transition name="menu">
      <div v-if="open" class="menu" role="menu">
        <div class="menu__head">
          <p class="menu__name">{{ auth.displayName }}</p>
          <p class="menu__account">@{{ auth.user?.username ?? 'unknown' }}</p>
        </div>

        <button class="menu__item" type="button" role="menuitem" @click="openPasswordModal">
          <AppIcon name="lock" :size="15" />
          修改密码
        </button>

        <button
          class="menu__item menu__item--danger"
          type="button"
          role="menuitem"
          @click="handleLogout"
        >
          <AppIcon name="logout" :size="15" />
          退出登录
        </button>
      </div>
    </Transition>

    <ChangePasswordModal v-model="passwordOpen" />
  </div>
</template>

<style scoped>
.user-menu {
  position: relative;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 8px 0 3px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--line);
  transition:
    border-color 0.16s var(--ease),
    background-color 0.16s var(--ease);
  max-width: 180px;
}

.trigger:hover {
  border-color: var(--line-strong);
  background: var(--surface-soft);
}

.trigger__avatar {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-size: 12px;
  font-weight: 700;
  flex: none;
}

.trigger__name {
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger__caret {
  color: var(--ink-3);
  flex: none;
}

/* 下拉面板 */
.menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 80;
  min-width: 196px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop);
}

.menu__head {
  padding: 6px 10px 9px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--line);
}

.menu__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.menu__account {
  font-size: 11.5px;
  color: var(--ink-3);
  font-family: var(--font-num);
  margin-top: 1px;
}

.menu__item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--ink-2);
  text-align: left;
  transition:
    background-color 0.14s var(--ease),
    color 0.14s var(--ease);
}

.menu__item:hover {
  background: var(--surface-sunken);
  color: var(--ink);
}

.menu__item--danger {
  color: var(--danger);
}

.menu__item--danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

/* 动画 */
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.16s var(--ease),
    transform 0.16s var(--ease-out);
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 900px) {
  .trigger {
    padding: 0 3px;
    background: transparent;
    border-color: transparent;
  }

  .trigger__name,
  .trigger__caret {
    display: none;
  }

  .trigger__avatar {
    width: 28px;
    height: 28px;
  }
}
</style>
