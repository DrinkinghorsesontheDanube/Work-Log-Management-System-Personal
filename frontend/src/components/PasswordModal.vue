<script setup lang="ts">
import { ref, watch } from 'vue'
import { storage } from '../utils/storage'
import { message } from '../utils/notify'

const visible = defineModel<boolean>({ default: false })

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const submitting = ref(false)

watch(visible, (v) => {
  if (v) {
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  }
})

async function submit() {
  if (submitting.value) return
  if (!oldPassword.value) return message.warning('请输入当前密码')
  if (newPassword.value.length < 8) return message.warning('新密码至少 8 位')
  if (newPassword.value !== confirmPassword.value) return message.warning('两次输入的新密码不一致')
  submitting.value = true
  try {
    await storage.changePassword(oldPassword.value, newPassword.value)
    message.success('密码已修改，其他设备的登录状态已失效')
    visible.value = false
  } catch (e) {
    message.error(e instanceof Error ? e.message : '修改失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="pm-mask" @click.self="visible = false">
      <div class="pm-card">
        <div class="pm-title">修改访问密码</div>
        <p class="pm-hint">修改后其他设备/浏览器的登录状态将失效，需用新密码重新登录；当前设备保持登录。</p>
        <input
          v-model="oldPassword"
          type="password"
          class="pm-input"
          placeholder="当前密码"
          autocomplete="current-password"
        />
        <input
          v-model="newPassword"
          type="password"
          class="pm-input"
          placeholder="新密码（至少 8 位）"
          autocomplete="new-password"
        />
        <input
          v-model="confirmPassword"
          type="password"
          class="pm-input"
          placeholder="确认新密码"
          autocomplete="new-password"
        />
        <div class="pm-btns">
          <button class="pm-btn pm-cancel" @click="visible = false">取消</button>
          <button class="pm-btn pm-ok" :disabled="submitting || !oldPassword || !newPassword" @click="submit">
            {{ submitting ? '提交中...' : '确认修改' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pm-mask {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
}
.pm-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 16px;
  padding: 28px 28px 24px;
  width: 380px; max-width: 92vw;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);
}
.pm-title { font-size: 16px; font-weight: 600; color: var(--text-1, #0f172a); margin-bottom: 6px; }
.pm-hint { font-size: 12px; color: var(--text-4, #94a3b8); line-height: 1.6; margin: 0 0 16px; }
.pm-input {
  width: 100%; padding: 10px 12px; margin-bottom: 10px;
  border: 1px solid var(--border, #e2e8f0); border-radius: 8px;
  background: var(--bg, #fff); color: var(--text-1, #0f172a);
  font-size: 13.5px; outline: none; box-sizing: border-box;
}
.pm-input:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12); }
.pm-btns { display: flex; gap: 10px; margin-top: 6px; }
.pm-btn {
  flex: 1; padding: 10px 0; border-radius: 10px;
  font-size: 14px; font-weight: 500; cursor: pointer; border: none;
  transition: opacity 0.15s;
}
.pm-cancel { background: var(--bg-hover, #f1f5f9); color: var(--text-2, #475569); border: 1px solid var(--border-light, #e2e8f0); }
.pm-ok { background: #0d9488; color: #fff; }
.pm-ok:disabled { opacity: 0.5; cursor: not-allowed; }
.pm-ok:hover:not(:disabled) { opacity: 0.9; }
</style>
