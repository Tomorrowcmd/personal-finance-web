<script setup lang="ts">
import { ref, watch } from 'vue'

import { errorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * 修改密码
 *
 * 只做前端能验证的部分（必填、长度、两次一致、新旧不同），
 * 「原密码是否正确」由后端判断；后端必须用 400 返回，不能用 401，
 * 否则会被全局 401 处理当成会话失效，把用户直接踢下线。
 */
const open = defineModel<boolean>({ default: false })

const auth = useAuthStore()
const toast = useToastStore()

/** 三个密码字段（都用 password type，可统一切换明文） */
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
/** 是否明文显示（一个开关控制三个输入框） */
const showPassword = ref(false)
/** 提交中，防重复点击 */
const submitting = ref(false)
/** 字段错误 + 表单级错误（form 用来放后端返回的「原密码不正确」） */
const errors = ref<{ old?: string; next?: string; confirm?: string; form?: string }>({})

/** 每次打开弹窗都清空，避免残留上一次输入 */
function reset(): void {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showPassword.value = false
  errors.value = {}
}

watch(open, (visible) => {
  if (visible) reset()
})

/**
 * 校验规则
 *
 * 长度限制与后端一致（6-32），并额外拦住「新旧相同」「两次不一致」，
 * 减少无谓的请求。
 */
function validate(): boolean {
  const next: typeof errors.value = {}

  if (!oldPassword.value) next.old = '请输入原密码'

  if (!newPassword.value) next.next = '请输入新密码'
  else if (newPassword.value.length < 6 || newPassword.value.length > 32) {
    next.next = '新密码长度需为 6-32 位'
  } else if (newPassword.value === oldPassword.value) {
    next.next = '新密码不能与原密码相同'
  }

  if (!confirmPassword.value) next.confirm = '请再次输入新密码'
  else if (confirmPassword.value !== newPassword.value) next.confirm = '两次输入的新密码不一致'

  errors.value = next
  return Object.keys(next).length === 0
}

/**
 * 提交修改
 *
 * 成功后不强制退出登录（当前会话仍然有效），只提示下次用新密码。
 * 失败（如原密码错误）显示在表单底部的错误条里，弹窗保持打开方便重试。
 */
async function submit(): Promise<void> {
  if (submitting.value) return
  if (!validate()) return

  submitting.value = true
  try {
    await auth.changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    })
    toast.success('密码已修改，下次登录请使用新密码')
    open.value = false
  } catch (error) {
    errors.value = { form: errorMessage(error) }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal v-model:open="open" title="修改密码" subtitle="为账号设置一个新的登录密码" size="sm">
    <form class="pwd" novalidate @submit.prevent="submit">
      <div class="pwd__top">
        <p class="pwd__hint">修改后当前登录状态保持不变</p>
        <button class="pwd__toggle" type="button" @click="showPassword = !showPassword">
          <AppIcon :name="showPassword ? 'eyeOff' : 'eye'" :size="14" />
          {{ showPassword ? '隐藏密码' : '显示密码' }}
        </button>
      </div>

      <BaseInput
        v-model="oldPassword"
        label="原密码"
        :type="showPassword ? 'text' : 'password'"
        placeholder="请输入当前密码"
        autocomplete="current-password"
        :maxlength="32"
        :error="errors.old"
        autofocus
      />

      <BaseInput
        v-model="newPassword"
        label="新密码"
        :type="showPassword ? 'text' : 'password'"
        placeholder="请输入新密码"
        autocomplete="new-password"
        :maxlength="32"
        :error="errors.next"
        hint="长度 6-32 位，且不能与原密码相同"
      />

      <BaseInput
        v-model="confirmPassword"
        label="确认新密码"
        :type="showPassword ? 'text' : 'password'"
        placeholder="再次输入新密码"
        autocomplete="new-password"
        :maxlength="32"
        :error="errors.confirm"
      />

      <p v-if="errors.form" class="pwd__error" role="alert">
        <AppIcon name="alert" :size="14" />
        <span>{{ errors.form }}</span>
      </p>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="open = false">取消</BaseButton>
      <BaseButton variant="primary" :loading="submitting" @click="submit">确认修改</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.pwd {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pwd__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 2px;
}

.pwd__hint {
  font-size: 12px;
  color: var(--ink-3);
}

.pwd__toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--brand);
  padding: 3px 6px;
  border-radius: 6px;
  flex: none;
}

.pwd__toggle:hover {
  background: var(--brand-soft);
}

.pwd__error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 12.5px;
  line-height: 1.5;
}
</style>
