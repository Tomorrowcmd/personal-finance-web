<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { errorMessage } from '@/api/client'
import type { Category, TransactionType } from '@/types'
import { useCategoryStore } from '@/stores/category'
import { useToastStore } from '@/stores/toast'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * 分类表单（新建 / 编辑）
 *
 * 图标用 emoji、颜色用预设色板，避免引入图标库和取色器组件。
 * 表单不会修改 id，编辑时按传入的 category.id 调 PUT。
 */
const open = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    /** 传入则进入编辑模式（回填名称/类型/图标/颜色） */
    category?: Category | null
    /** 新建时的默认类型，跟随分类页当前 tab */
    defaultType?: TransactionType
  }>(),
  { category: null, defaultType: 'EXPENSE' },
)

const categoryStore = useCategoryStore()
const toast = useToastStore()

/** 可选 emoji 图标（够用即可，不追求全覆盖） */
const EMOJIS = [
  '🍜',
  '🍔',
  '☕',
  '🚇',
  '🚌',
  '🚗',
  '🛍️',
  '👕',
  '🏠',
  '💡',
  '🎮',
  '🎬',
  '💊',
  '🏥',
  '📚',
  '🎓',
  '🎁',
  '💝',
  '💼',
  '🏆',
  '📈',
  '🧾',
  '💰',
  '✨',
  '🐱',
  '✈️',
  '🏋️',
  '🎵',
]

/** 预设色板：都带足够对比度，深色主题下也能看清 */
const COLORS = [
  '#E0703C',
  '#3C7DBF',
  '#B25FB0',
  '#6B7A8F',
  '#D9A13B',
  '#4C9E9E',
  '#5B6BD6',
  '#D45F7C',
  '#8A94A6',
  '#0F7A63',
  '#2E9E7E',
  '#7C6BD6',
]

/** 表单字段（字符串/枚举，提交时组装成 CategoryPayload） */
const name = ref('')
const type = ref<TransactionType>('EXPENSE')
const icon = ref('✨')
const color = ref('#8A94A6')
/** 提交中，防重复点击 */
const submitting = ref(false)
/** 名称字段错误（空 / 超长） */
const nameError = ref('')

/** 是否编辑模式 */
const isEdit = computed(() => Boolean(props.category))

/**
 * 每次打开弹窗时初始化表单
 *
 * 编辑：回填当前分类；新建：用默认类型 + 默认图标/颜色。
 * 选择 COLORS[2] 作为兜底，保证不会出现空颜色。
 */
watch(
  () => open.value,
  (visible) => {
    if (!visible) return
    const current = props.category
    name.value = current?.name ?? ''
    type.value = current?.type ?? props.defaultType
    icon.value = current?.icon ?? '✨'
    color.value = current?.color ?? COLORS[2] ?? '#8A94A6'
    nameError.value = ''
  },
)

/**
 * 提交表单
 *
 * 前端只校验名称（必填、≤12 字），重名/类型冲突交给后端（409）。
 * 成功后由 store 刷新分类缓存，页面自动更新；失败把错误展示为 toast。
 */
async function submit(): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed) {
    nameError.value = '请输入分类名称'
    return
  }
  if (trimmed.length > 12) {
    nameError.value = '名称不能超过 12 个字'
    return
  }

  submitting.value = true
  try {
    const payload = { name: trimmed, type: type.value, icon: icon.value, color: color.value }
    if (props.category) {
      await categoryStore.update(props.category.id, payload)
      toast.success('分类已更新')
    } else {
      await categoryStore.create(payload)
      toast.success('分类已创建')
    }
    open.value = false
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="isEdit ? '编辑分类' : '新增分类'"
    :subtitle="isEdit ? '修改后历史记录会同步显示新名称与颜色' : '给这类开销起个名字，统计更清晰'"
    size="sm"
  >
    <form class="form" @submit.prevent="submit">
      <BaseInput
        v-model="name"
        label="名称"
        placeholder="例如：宠物"
        :maxlength="12"
        :error="nameError"
        required
      />

      <div class="form__block">
        <p class="form__label">类型</p>
        <div class="segmented">
          <button
            type="button"
            class="segmented__item"
            :class="{ 'is-active': type === 'EXPENSE' }"
            @click="type = 'EXPENSE'"
          >
            支出
          </button>
          <button
            type="button"
            class="segmented__item"
            :class="{ 'is-active': type === 'INCOME' }"
            @click="type = 'INCOME'"
          >
            收入
          </button>
        </div>
      </div>

      <div class="form__block">
        <p class="form__label">图标</p>
        <div class="emoji-grid">
          <button
            v-for="emoji in EMOJIS"
            :key="emoji"
            type="button"
            class="emoji"
            :class="{ 'is-active': icon === emoji }"
            :aria-label="`选择图标 ${emoji}`"
            @click="icon = emoji"
          >
            {{ emoji }}
          </button>
        </div>
      </div>

      <div class="form__block">
        <p class="form__label">颜色</p>
        <div class="color-grid">
          <button
            v-for="item in COLORS"
            :key="item"
            type="button"
            class="color"
            :class="{ 'is-active': color === item }"
            :style="{ '--swatch': item }"
            :aria-label="`选择颜色 ${item}`"
            @click="color = item"
          />
        </div>
      </div>

      <!-- 预览 -->
      <div class="preview">
        <span class="preview__icon" :style="{ background: `${color}26` }">{{ icon }}</span>
        <span class="preview__name">{{ name || '分类名称' }}</span>
        <span class="preview__tag">{{ type === 'EXPENSE' ? '支出' : '收入' }}</span>
      </div>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="open = false">取消</BaseButton>
      <BaseButton variant="primary" :loading="submitting" @click="submit">
        {{ isEdit ? '保存' : '创建' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form__block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-2);
}

.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--surface-sunken);
  border-radius: var(--radius-md);
  width: fit-content;
}

.segmented__item {
  height: 28px;
  padding: 0 16px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--ink-2);
  font-weight: 600;
}

.segmented__item.is-active {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-xs);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
}

.emoji {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: 8px;
  font-size: 16px;
  border: 1px solid transparent;
  transition:
    background-color 0.14s var(--ease),
    border-color 0.14s var(--ease);
}

.emoji:hover {
  background: var(--surface-sunken);
}

.emoji.is-active {
  background: var(--brand-soft);
  border-color: var(--brand);
}

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--swatch);
  border: 2px solid transparent;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.14s var(--ease);
}

.color:hover {
  transform: scale(1.08);
}

.color.is-active {
  border-color: var(--surface);
  box-shadow:
    0 0 0 2px var(--swatch),
    inset 0 0 0 2px var(--surface);
}

/* 预览 */
.preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--surface-soft);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
}

.preview__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  font-size: 16px;
}

.preview__name {
  font-weight: 600;
  font-size: 13.5px;
}

.preview__tag {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-3);
  padding: 2px 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

@media (max-width: 480px) {
  .emoji-grid {
    grid-template-columns: repeat(7, 1fr);
  }
}
</style>
