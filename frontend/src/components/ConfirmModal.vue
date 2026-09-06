<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="visible" class="cm-mask" @click.self="emit('cancel')">
    <div class="cm-box">
      <div class="cm-icon" :class="{ danger }">
        <svg v-if="danger" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="cm-title">{{ title }}</div>
      <div class="cm-msg">{{ message }}</div>
      <div class="cm-btns">
        <button class="cm-btn cm-btn-cancel" @click="emit('cancel')">{{ cancelText || '取消' }}</button>
        <button class="cm-btn cm-btn-ok" :class="{ danger }" @click="emit('confirm')">{{ confirmText || '确定' }}</button>
      </div>
    </div>
  </div>
</template>

<style>
.cm-mask {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  animation: cm-in 0.2s ease;
}
@keyframes cm-in { from { opacity: 0; } to { opacity: 1; } }
.cm-box {
  background: #fff; border-radius: 16px;
  padding: 32px 32px 24px; width: 380px; max-width: 90vw;
  box-shadow: 0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
  text-align: center;
  animation: cm-box-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes cm-box-in { from { opacity: 0; transform: scale(0.9) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.cm-icon {
  width: 52px; height: 52px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  background: #eef2ff; color: #6366f1;
}
.cm-icon.danger { background: #fef2f2; color: #ef4444; }
.cm-title { font-size: 17px; font-weight: 600; color: #0f172a; margin-bottom: 6px; }
.cm-msg { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
.cm-btns { display: flex; gap: 10px; }
.cm-btn {
  flex: 1; padding: 10px 0; border-radius: 10px;
  font-size: 15px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; border: none;
}
.cm-btn-cancel {
  background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;
}
.cm-btn-cancel:hover { background: #e2e8f0; }
.cm-btn-ok { background: #6366f1; color: #fff; }
.cm-btn-ok:hover { background: #4f46e5; }
.cm-btn-ok.danger { background: #ef4444; }
.cm-btn-ok.danger:hover { background: #dc2626; }
</style>
