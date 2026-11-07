<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock, SwitchButton } from '@element-plus/icons-vue'

import { useAuthStore } from '@/stores/auth'
import { useConfirmStore } from '@/stores/confirm'
import { useToastStore } from '@/stores/toast'

import AppIcon from '@/components/ui/AppIcon.vue'
import ChangePasswordModal from '@/components/auth/ChangePasswordModal.vue'

/**
 * 顶栏用户菜单（Element Plus 版）
 *
 * el-dropdown 负责点击展开、点击外部关闭、键盘导航与定位；
 * 菜单项：修改密码 / 退出登录（保留二次确认）。
 */
const auth = useAuthStore()
const confirm = useConfirmStore()
const toast = useToastStore()
const router = useRouter()

/** 修改密码弹窗 */
const passwordOpen = ref(false)

/** 下拉菜单命令分发 */
function onCommand(command: string | number | object): void {
  if (command === 'password') {
    passwordOpen.value = true
    return
  }
  if (command === 'logout') {
    void handleLogout()
  }
}

/** 退出登录：确认 → 通知后端 → 清本地 → 回登录页 */
async function handleLogout(): Promise<void> {
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
  <el-dropdown trigger="click" placement="bottom-end" @command="onCommand">
    <button class="trigger" type="button" :title="`${auth.displayName} 的账号菜单`">
      <span class="trigger__avatar">{{ auth.initial }}</span>
      <span class="trigger__name">{{ auth.displayName }}</span>
      <AppIcon name="chevronDown" :size="13" class="trigger__caret" />
    </button>

    <template #dropdown>
      <el-dropdown-menu class="user-dropdown">
        <el-dropdown-item disabled class="user-dropdown__head">
          <div>
            <p class="user-dropdown__name">{{ auth.displayName }}</p>
            <p class="user-dropdown__account">@{{ auth.user?.username ?? 'unknown' }}</p>
          </div>
        </el-dropdown-item>
        <el-dropdown-item command="password" :icon="Lock" divided>修改密码</el-dropdown-item>
        <el-dropdown-item command="logout" :icon="SwitchButton">退出登录</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <ChangePasswordModal v-model="passwordOpen" />
</template>

<style scoped>
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 9px 0 4px;
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
  width: 26px;
  height: 26px;
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
}

@media (max-width: 900px) {
  .trigger {
    padding: 0 4px;
    background: transparent;
    border-color: transparent;
  }

  .trigger__name,
  .trigger__caret {
    display: none;
  }
}
</style>

<style>
/* 下拉菜单里的用户信息头（el-dropdown-menu 渲染在 body 下，需要非 scoped 样式） */
.user-dropdown .user-dropdown__head {
  height: auto;
  padding: 6px 12px 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--line);
  opacity: 1;
  cursor: default;
}

.user-dropdown .user-dropdown__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.user-dropdown .user-dropdown__account {
  font-size: 11.5px;
  color: var(--ink-3);
  margin-top: 1px;
}
</style>
