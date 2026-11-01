<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { errorMessage } from '@/api/client'
import { transactionApi } from '@/api/transactions'
import type { Transaction, TransactionPayload, TransactionType } from '@/types'
import { todayISO } from '@/utils/date'
import { isValidAmount, roundMoney } from '@/utils/format'
import { useCategoryStore } from '@/stores/category'
import { useSyncStore } from '@/stores/sync'
import { useToastStore } from '@/stores/toast'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import CategoryDot from '@/components/ui/CategoryDot.vue'

/**
 * 记账表单（新建 / 编辑共用）
 *
 * 通过 v-model 控制显隐；传入 transaction 即为编辑模式。
 * 保存成功后 bump 数据版本，各页面自动刷新，无需父子事件串联。
 */
const open = defineModel<boolean>({ default: false })

const props = defineProps<{
  /** 传入则进入编辑模式 */
  transaction?: Transaction | null
}>()

const emit = defineEmits<{ saved: [] }>()

const categoryStore = useCategoryStore()
const toast = useToastStore()
const sync = useSyncStore()

/** 是否编辑模式（由外部是否传入 transaction 决定） */
const isEdit = computed(() => Boolean(props.transaction))

/** 收支类型，决定下方可选分类与金额颜色 */
const type = ref<TransactionType>('EXPENSE')
/** 金额输入框原值（字符串，保留用户输入中间态） */
const amount = ref('')
/** 选中的分类 id（字符串，提交时转 number） */
const categoryId = ref('')
/** 记账日期，默认今天 */
const date = ref(todayISO())
/** 备注，最多 50 字 */
const note = ref('')
/** 提交中，防重复点击 */
const submitting = ref(false)
/** 字段级错误，提交时生成、用户修改时不自动清除（下次提交重新校验） */
const errors = ref<{ amount?: string; categoryId?: string; date?: string }>({})

/** 当前收支类型下可选的分类 */
const categoryOptions = computed(() =>
  categoryStore.items.filter((item) => item.type === type.value),
)

/**
 * 表单打开时重置
 *
 * 编辑模式：用传入的记录回填（金额固定两位小数）；
 * 新建模式：类型默认支出、日期默认今天、分类默认第一个支出分类，
 * 让用户打开就能「填金额 → 保存」，减少点击。
 */
function resetForm(): void {
  const current = props.transaction
  if (current) {
    type.value = current.type
    amount.value = current.amount.toFixed(2)
    categoryId.value = String(current.categoryId)
    date.value = current.date
    note.value = current.note
  } else {
    type.value = 'EXPENSE'
    amount.value = ''
    date.value = todayISO()
    note.value = ''
    const first = categoryStore.items.find((item) => item.type === 'EXPENSE')
    categoryId.value = first ? String(first.id) : ''
  }
  errors.value = {}
}

watch(
  () => open.value,
  (visible) => {
    if (visible) resetForm()
  },
)

// 切换收支类型后，若原分类不属于该类型则自动落到第一个分类
watch(type, () => {
  const exists = categoryOptions.value.some((item) => String(item.id) === categoryId.value)
  if (!exists) {
    const first = categoryOptions.value[0]
    categoryId.value = first ? String(first.id) : ''
  }
})

/** 金额失焦时补成两位小数，编辑体验更稳 */
function onAmountBlur(): void {
  const parsed = Number(amount.value)
  if (Number.isFinite(parsed) && parsed > 0) amount.value = parsed.toFixed(2)
}

/**
 * 字段校验
 *
 * 规则与后端保持一致（后端仍会再校验一遍，前端只是提前反馈）：
 * - 金额 > 0 且不超过 99,999,999.99
 * - 必须选分类（分类类型已由 UI 过滤保证一致）
 * - 日期必填，且 `max` 已限制不能选未来
 */
function validate(): boolean {
  const nextErrors: typeof errors.value = {}
  const parsed = Number(amount.value)

  if (!amount.value.trim()) nextErrors.amount = '请输入金额'
  else if (!isValidAmount(parsed)) nextErrors.amount = '金额需大于 0，且不超过 99,999,999'

  if (!categoryId.value) nextErrors.categoryId = '请选择一个分类'
  if (!date.value) nextErrors.date = '请选择日期'

  errors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

/**
 * 提交表单
 *
 * 编辑走 PUT、新建走 POST；金额统一 roundMoney 到两位小数。
 * 成功后 bump 数据版本让所有页面刷新，再关闭弹窗。
 */
async function submit(): Promise<void> {
  if (!validate() || submitting.value) return

  const payload: TransactionPayload = {
    type: type.value,
    amount: roundMoney(Number(amount.value)),
    categoryId: Number(categoryId.value),
    date: date.value,
    note: note.value.trim(),
  }

  submitting.value = true
  try {
    if (props.transaction) {
      await transactionApi.update(props.transaction.id, payload)
      toast.success('记录已更新')
    } else {
      await transactionApi.create(payload)
      toast.success('已记一笔')
    }
    sync.bump()
    emit('saved')
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
    :title="isEdit ? '编辑记录' : '记一笔'"
    :subtitle="isEdit ? '修改金额、分类或备注' : '支出与收入分开记，统计才准'"
    size="md"
  >
    <form class="form" @submit.prevent="submit">
      <!-- 收支类型 -->
      <div class="type-switch" role="group" aria-label="收支类型">
        <button
          type="button"
          class="type-switch__item"
          :class="{ 'is-active is-expense': type === 'EXPENSE' }"
          :aria-pressed="type === 'EXPENSE'"
          @click="type = 'EXPENSE'"
        >
          <span class="type-switch__dot" /> 支出
        </button>
        <button
          type="button"
          class="type-switch__item"
          :class="{ 'is-active is-income': type === 'INCOME' }"
          :aria-pressed="type === 'INCOME'"
          @click="type = 'INCOME'"
        >
          <span class="type-switch__dot" /> 收入
        </button>
      </div>

      <!-- 金额 -->
      <div class="amount" :class="{ 'amount--error': errors.amount }">
        <span class="amount__symbol">¥</span>
        <input
          v-model="amount"
          class="amount__input num"
          inputmode="decimal"
          placeholder="0.00"
          aria-label="金额"
          @blur="onAmountBlur"
        />
      </div>
      <p v-if="errors.amount" class="form__error">{{ errors.amount }}</p>

      <!-- 分类 -->
      <div class="form__block">
        <p class="form__label">分类</p>
        <div class="chips" role="radiogroup" aria-label="分类">
          <button
            v-for="category in categoryOptions"
            :key="category.id"
            type="button"
            role="radio"
            class="chip"
            :class="{ 'is-active': String(category.id) === categoryId }"
            :aria-checked="String(category.id) === categoryId"
            @click="categoryId = String(category.id)"
          >
            <CategoryDot :icon="category.icon" :color="category.color" size="sm" />
            <span>{{ category.name }}</span>
          </button>
        </div>
        <p v-if="errors.categoryId" class="form__error">{{ errors.categoryId }}</p>
      </div>

      <!-- 日期与备注 -->
      <div class="form__grid">
        <BaseInput v-model="date" label="日期" type="date" :max="todayISO()" :error="errors.date" />
        <BaseTextarea
          v-model="note"
          label="备注"
          placeholder="例如：和同事吃午饭"
          :rows="1"
          :maxlength="50"
          :hint="`${note.length}/50`"
        />
      </div>
    </form>

    <template #footer>
      <BaseButton variant="secondary" @click="open = false">取消</BaseButton>
      <BaseButton variant="primary" :loading="submitting" @click="submit">
        {{ isEdit ? '保存修改' : '保存' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 类型切换 */
.type-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 4px;
  background: var(--surface-sunken);
  border-radius: var(--radius-md);
}

.type-switch__item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  border-radius: var(--radius-sm);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-2);
  transition:
    background-color 0.16s var(--ease),
    color 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
}

.type-switch__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.45;
}

.type-switch__item.is-active {
  background: var(--surface);
  box-shadow: var(--shadow-xs);
}

.type-switch__item.is-expense {
  color: var(--expense);
}

.type-switch__item.is-income {
  color: var(--income);
}

.type-switch__item.is-active .type-switch__dot {
  opacity: 1;
}

/* 金额 */
.amount {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 4px 10px;
  border-bottom: 2px solid var(--line);
  transition: border-color 0.16s var(--ease);
}

.amount:focus-within {
  border-color: var(--brand);
}

.amount--error {
  border-color: var(--danger);
}

.amount__symbol {
  font-size: 22px;
  color: var(--ink-3);
  font-weight: 500;
}

.amount__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 34px;
  font-weight: 620;
  letter-spacing: -0.03em;
  padding: 0;
}

.amount__input::placeholder {
  color: var(--ink-3);
  opacity: 0.55;
}

/* 分类 chips */
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 172px;
  overflow-y: auto;
  padding: 2px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 11px 0 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--surface);
  font-size: 13px;
  color: var(--ink-2);
  transition:
    border-color 0.16s var(--ease),
    background-color 0.16s var(--ease),
    color 0.16s var(--ease);
}

.chip:hover {
  border-color: var(--ink-3);
  color: var(--ink);
}

.chip.is-active {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-weight: 600;
}

/* 日期 + 备注 */
.form__grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 12px;
  align-items: start;
}

.form__error {
  font-size: 12px;
  color: var(--danger);
}

@media (max-width: 560px) {
  .form__grid {
    grid-template-columns: 1fr;
  }

  .amount__input {
    font-size: 30px;
  }
}
</style>
