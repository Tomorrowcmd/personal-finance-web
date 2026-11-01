<script setup lang="ts">
import { useConfirmStore } from '@/stores/confirm'

import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'

/**
 * 全局确认框容器
 *
 * 业务里调用 confirm.ask({...}) 会拿到 Promise<boolean>，
 * 不需要每个页面自己维护「弹窗开关 + 确认回调」。
 * 关闭方式（取消 / 遮罩 / Esc）统一 settle(false)，只有确认按钮 settle(true)。
 * 遮罩点击禁用（close-on-backdrop=false），避免误触丢操作。
 */
const confirm = useConfirmStore()

/** 弹窗被外部关闭（Esc / 右上角）时，视作用户取消 */
function onOpenChange(open: boolean): void {
  if (!open) confirm.settle(false)
}
</script>

<template>
  <BaseModal
    :open="confirm.state.open"
    :title="confirm.state.title"
    size="sm"
    :close-on-backdrop="false"
    @update:open="onOpenChange"
  >
    <p class="confirm__message">{{ confirm.state.message }}</p>

    <template #footer>
      <BaseButton variant="secondary" @click="confirm.settle(false)">
        {{ confirm.state.cancelText }}
      </BaseButton>
      <BaseButton
        :variant="confirm.state.tone === 'danger' ? 'danger' : 'primary'"
        @click="confirm.settle(true)"
      >
        {{ confirm.state.confirmText }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm__message {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--ink-2);
  padding: 2px 0 4px;
  white-space: pre-line;
}
</style>
