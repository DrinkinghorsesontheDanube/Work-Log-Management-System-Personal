<script setup lang="ts">
import { ref } from 'vue'
import { login } from '../utils/storage'

const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  if (!password.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    await login(password.value)
    // 登录成功后整页刷新，让路由守卫重新初始化。
    // 必须直接在这里 reload：login() 已把 authRequired 置 false，Vue 会在微任务中
    // 卸载本组件，卸载后 emit 出去的事件会被静默丢弃，reload 将永远不会执行。
    location.reload()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-mask">
    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#0d9488"/>
          <path d="M10 16h12M16 10v12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <h1>WorkLog</h1>
        <p>工作日志管理系统</p>
      </div>
      <input
        v-model="password"
        id="login-password"
        name="password"
        type="password"
        class="login-input"
        placeholder="请输入访问密码"
        autocomplete="current-password"
        autofocus
        :disabled="loading"
      />
      <p v-if="error" class="login-error">{{ error }}</p>
      <button type="submit" class="login-btn" :disabled="loading || !password">
        {{ loading ? '登录中...' : '进入系统' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg, #f5f7fa);
}

.login-card {
  width: 340px;
  padding: 40px 36px 36px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e5e9f0);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-brand {
  text-align: center;
  margin-bottom: 8px;
}
.login-brand svg { margin-bottom: 10px; }
.login-brand h1 {
  margin: 0;
  font-size: 20px;
  color: var(--text, #1e293b);
  letter-spacing: -0.02em;
}
.login-brand p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.login-input {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid var(--border, #e5e9f0);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}
.login-input:focus {
  border-color: #0d9488;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
}

.login-error {
  margin: 0;
  font-size: 12.5px;
  color: #ef4444;
  text-align: center;
}

.login-btn {
  padding: 11px;
  border: none;
  border-radius: 8px;
  background: #0d9488;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.login-btn:hover:not(:disabled) { opacity: 0.9; }
.login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
