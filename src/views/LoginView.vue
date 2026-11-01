<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { errorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { getRememberedUsername, setRememberedUsername } from '@/utils/session'

import AppIcon from '@/components/ui/AppIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

/**
 * 登录页
 *
 * - 只有账号 + 密码，回车即可提交
 * - 未登录访问业务页会被守卫带到 /login?redirect=...，登录成功后回跳
 * - 模拟数据模式下展示演示账号，并支持一键填入
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

/** 模拟数据模式下才显示演示账号卡片，避免真实环境泄露账号信息 */
const isMock = import.meta.env.VITE_USE_MOCK === 'true'
/** 演示账号（仅 mock 生效；接入真实后端后这段不会渲染） */
const DEMO_ACCOUNT = { username: 'admin', password: 'admin123' }

/** 账号：优先回填「上次记住的账号」 */
const username = ref(getRememberedUsername())
/** 密码：不做任何本地持久化 */
const password = ref('')
/** 是否记住账号（只记账号，不记密码） */
const remember = ref(Boolean(username.value))
/** 密码是否明文显示（眼睛图标切换） */
const showPassword = ref(false)
/** 提交中：禁用按钮并显示 loading，防止重复提交 */
const submitting = ref(false)
/** 表单级错误（账号密码错误、网络异常等），显示在按钮上方 */
const error = ref('')
// 用户重新输入时清掉上一次的错误提示
watch([username, password], () => {
  if (error.value) error.value = ''
})

/** 一键填入演示账号（仅 mock 模式可见） */
function fillDemo(): void {
  username.value = DEMO_ACCOUNT.username
  password.value = DEMO_ACCOUNT.password
  error.value = ''
}

/**
 * 提交登录
 *
 * 流程：本地非空校验 → 调登录接口 → 记住账号 → 提示 → 回跳。
 * 登录成功后 token 由 auth store 写入 localStorage，后续请求自动带上。
 */
async function submit(): Promise<void> {
  if (submitting.value) return
  // trim(): 去掉首位的空白字符串
  if (!username.value.trim()) {
    error.value = '请输入账号'
    return
  }
  if (!password.value) {
    error.value = '请输入密码'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    await auth.login({ username: username.value.trim(), password: password.value })
    // 只记住账号，不保存密码
    setRememberedUsername(remember.value ? username.value.trim() : '')
    toast.success(`欢迎回来，${auth.displayName}`)

    // 只允许站内回跳，避免开放重定向
    // 第 1 步:取出 URL 里的 redirect 参数
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    // 第 2 步:校验它能不能用
    const target = redirect.startsWith('/') && !redirect.startsWith('/login') ? redirect : '/'
    // 第 3 步:跳转
    await router.replace(target)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <!-- 左侧品牌区 -->
    <aside class="brand-panel">
      <div class="brand-top">
        <span class="brand-mark" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M6 16V9.5a1 1 0 0 1 1.6-.8l2.7 2.2a1 1 0 0 0 1.3 0l2.7-2.2a1 1 0 0 1 1.6.8V16"
            />
            <circle cx="12" cy="18.5" r="1.1" fill="#F2C14E" stroke="none" />
          </svg>
        </span>
        <span class="brand-name">财务管家</span>
      </div>

      <div class="brand-hero">
        <h1 class="brand-title">把每一笔<br />都看得清楚</h1>
        <p class="brand-desc">记录日常收支，自动生成统计，按月设好预算。</p>

        <ul class="brand-list">
          <li>
            <span class="brand-list__icon" aria-hidden="true">📝</span>
            <span class="brand-list__text"><b>随手记</b>支出收入一键录入</span>
          </li>
          <li>
            <span class="brand-list__icon" aria-hidden="true">📊</span>
            <span class="brand-list__text"><b>看得懂</b>趋势与分类占比一目了然</span>
          </li>
          <li>
            <span class="brand-list__icon" aria-hidden="true">🎯</span>
            <span class="brand-list__text"><b>管得住</b>预算进度与超支预警</span>
          </li>
        </ul>
      </div>

      <!-- 装饰性图表 -->
      <svg
        class="brand-art"
        viewBox="0 0 420 180"
        fill="none"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <path d="M0 150h420" stroke="rgba(255,255,255,.14)" stroke-width="1" />
        <rect x="24" y="96" width="26" height="54" rx="7" fill="rgba(255,255,255,.16)" />
        <rect x="76" y="112" width="26" height="38" rx="7" fill="rgba(255,255,255,.13)" />
        <rect x="128" y="80" width="26" height="70" rx="7" fill="rgba(255,255,255,.18)" />
        <rect x="180" y="104" width="26" height="46" rx="7" fill="rgba(255,255,255,.13)" />
        <rect x="232" y="66" width="26" height="84" rx="7" fill="rgba(255,255,255,.2)" />
        <rect x="284" y="88" width="26" height="62" rx="7" fill="rgba(255,255,255,.14)" />
        <rect x="336" y="54" width="26" height="96" rx="7" fill="rgba(255,255,255,.22)" />
        <path
          d="M24 78L64 60l44 12 46-26 48 16 50-24 48 10"
          stroke="#F2C14E"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </aside>

    <!-- 右侧表单 -->
    <main class="login-panel">
      <div class="login-card">
        <div class="mobile-brand">
          <span class="brand-mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M6 16V9.5a1 1 0 0 1 1.6-.8l2.7 2.2a1 1 0 0 0 1.3 0l2.7-2.2a1 1 0 0 1 1.6.8V16"
              />
              <circle cx="12" cy="18.5" r="1.1" fill="#F2C14E" stroke="none" />
            </svg>
          </span>
          <span class="brand-name">财务管家</span>
        </div>

        <header class="login-head">
          <p class="login-eyebrow">欢迎回来</p>
          <h2 class="login-title">登录你的账本</h2>
          <p class="login-desc">用账号和密码继续记录收支</p>
        </header>

        <form class="login-form" novalidate @submit.prevent="submit">
          <BaseInput
            v-model="username"
            label="账号"
            placeholder="请输入账号"
            autocomplete="username"
            autofocus
            :maxlength="40"
          />

          <BaseInput
            v-model="password"
            label="密码"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            autocomplete="current-password"
            :maxlength="64"
          >
            <template #suffix>
              <button
                class="eye-btn"
                type="button"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                :title="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <AppIcon :name="showPassword ? 'eyeOff' : 'eye'" :size="16" />
              </button>
            </template>
          </BaseInput>

          <label class="remember">
            <input v-model="remember" type="checkbox" />
            <span>记住账号</span>
          </label>

          <Transition name="fade">
            <p v-if="error" class="login-error" role="alert">
              <AppIcon name="alert" :size="14" />
              <span>{{ error }}</span>
            </p>
          </Transition>

          <BaseButton type="submit" variant="primary" size="lg" block :loading="submitting">
            登 录
          </BaseButton>
        </form>

        <div v-if="isMock" class="demo-card">
          <div class="demo-card__info">
            <p class="demo-card__title">演示模式</p>
            <p class="demo-card__text">账号 <b>admin</b> · 密码 <b>admin123</b></p>
          </div>
          <button class="demo-card__btn" type="button" @click="fillDemo">一键填入</button>
        </div>

        <p class="login-foot">登录状态保存在本机浏览器 · 未登录无法访问任何数据</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  min-height: 100vh;
  background: var(--bg);
}

/* ---------- 左侧品牌 ---------- */
.brand-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 24px;
  /* 底部留出装饰图的空间，避免文字压在图上看不清 */
  padding: 46px 52px 210px;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(110% 90% at 100% 0%, rgba(242, 193, 78, 0.16) 0%, transparent 55%),
    linear-gradient(150deg, #0f7a63 0%, #0a5a49 52%, #073c31 100%);
}

.brand-top {
  display: flex;
  align-items: center;
  gap: 11px;
  position: relative;
  z-index: 1;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  flex: none;
}

.brand-mark svg {
  width: 21px;
  height: 21px;
}

.brand-name {
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.brand-hero {
  position: relative;
  z-index: 1;
  max-width: 420px;
  /* 上下自动外边距：在 logo 与装饰图之间垂直居中 */
  margin: auto 0;
}

.brand-title {
  font-size: 40px;
  line-height: 1.22;
  font-weight: 680;
  letter-spacing: -0.03em;
}

.brand-desc {
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.74);
}

.brand-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 30px;
}

.brand-list li {
  display: flex;
  align-items: center;
  gap: 11px;
}

.brand-list__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 16px;
  flex: none;
}

.brand-list__text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
}

.brand-list__text b {
  display: block;
  font-size: 13.5px;
  font-weight: 620;
  color: #fff;
  margin-bottom: 1px;
}

.brand-art {
  position: absolute;
  right: -30px;
  bottom: 0;
  width: 96%;
  height: 190px;
  opacity: 0.9;
  pointer-events: none;
}

/* 深色主题下压暗一档 */
:global([data-theme='dark']) .brand-panel {
  background:
    radial-gradient(110% 90% at 100% 0%, rgba(242, 193, 78, 0.12) 0%, transparent 55%),
    linear-gradient(150deg, #10493d 0%, #0b382f 52%, #06251f 100%);
}

/* ---------- 右侧表单 ---------- */
.login-panel {
  display: grid;
  place-items: center;
  padding: 40px 24px;
}

.login-card {
  width: 100%;
  max-width: 372px;
}

.mobile-brand {
  display: none;
}

.login-head {
  margin-bottom: 26px;
}

.login-eyebrow {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand);
  letter-spacing: 0.06em;
}

.login-title {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 680;
  letter-spacing: -0.025em;
}

.login-desc {
  margin-top: 6px;
  font-size: 13px;
  color: var(--ink-3);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.eye-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--ink-3);
  flex: none;
}

.eye-btn:hover {
  background: var(--surface-sunken);
  color: var(--ink);
}

.remember {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--ink-2);
  cursor: pointer;
  width: fit-content;
}

.remember input {
  width: 15px;
  height: 15px;
  accent-color: var(--brand);
  cursor: pointer;
}

.login-error {
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

/* ---------- 演示账号 ---------- */
.demo-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 22px;
  padding: 11px 14px;
  background: var(--surface);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
}

.demo-card__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-3);
  letter-spacing: 0.04em;
}

.demo-card__text {
  margin-top: 1px;
  font-size: 12.5px;
  color: var(--ink-2);
}

.demo-card__text b {
  color: var(--ink);
  font-family: var(--font-num);
  font-weight: 600;
}

.demo-card__btn {
  flex: none;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-size: 12px;
  font-weight: 600;
  transition: box-shadow 0.16s var(--ease);
}

.demo-card__btn:hover {
  box-shadow: inset 0 0 0 1px var(--brand-ring);
}

.login-foot {
  margin-top: 20px;
  text-align: center;
  font-size: 11.5px;
  color: var(--ink-3);
}

/* ---------- 响应式 ---------- */
@media (max-width: 920px) {
  .login {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    display: none;
  }

  .login-panel {
    padding: 32px 20px 48px;
    align-content: center;
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 30px;
  }

  .mobile-brand .brand-mark {
    background: var(--brand);
    border-color: transparent;
    width: 34px;
    height: 34px;
  }

  .mobile-brand .brand-name {
    font-size: 16px;
    color: var(--ink);
  }

  .login-head {
    text-align: center;
  }

  .login-title {
    font-size: 23px;
  }
}
</style>
