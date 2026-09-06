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
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>

    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand">
        <svg width="46" height="46" viewBox="0 0 32 32" fill="none">
          <rect x="2" y="2" width="28" height="28" rx="9" fill="#0d9488"/>
          <path d="M10 16h12M16 10v12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <h1>WorkLog</h1>
        <p>工作日志管理系统</p>
      </div>

      <div class="login-field">
        <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
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
      </div>

      <p v-if="error" class="login-error">{{ error }}</p>

      <button type="submit" class="login-btn" :disabled="loading || !password">
        <span v-if="loading" class="login-spinner"></span>
        {{ loading ? '验证中' : '进入系统' }}
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
  padding: 20px;
  overflow: hidden;
  background: linear-gradient(160deg, #ecfbf7 0%, #f4f6f8 55%, #e6f3f6 100%);
}

/* 背景光斑装饰 */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
}
.blob-1 {
  width: 440px; height: 440px;
  background: rgba(20, 184, 166, 0.28);
  top: -140px; left: -110px;
}
.blob-2 {
  width: 400px; height: 400px;
  background: rgba(99, 102, 241, 0.16);
  bottom: -150px; right: -90px;
}
.blob-3 {
  width: 260px; height: 260px;
  background: rgba(13, 148, 136, 0.14);
  bottom: -60px; left: 30%;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 400px;
  max-width: 94vw;
  padding: 42px 38px 34px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #f1f5f9);
  border-radius: 20px;
  box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.18);
}

.login-brand {
  text-align: center;
  margin-bottom: 26px;
}
.login-brand svg {
  margin-bottom: 14px;
  filter: drop-shadow(0 6px 14px rgba(13, 148, 136, 0.35));
}
.login-brand h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-1, #1e293b);
}
.login-brand p {
  margin: 5px 0 0;
  font-size: 12.5px;
  color: var(--text-muted, #94a3b8);
  letter-spacing: 0.02em;
}

.login-field {
  position: relative;
  margin-bottom: 12px;
}
.field-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted, #94a3b8);
  pointer-events: none;
}
.login-input {
  width: 100%;
  padding: 12px 14px 12px 40px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  background: var(--bg, #fff);
  color: var(--text-1, #1e293b);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.login-input:focus {
  border-color: #0d9488;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.14);
}
.login-input::placeholder { color: var(--text-placeholder, #cbd5e1); }

.login-error {
  margin: 0 0 4px;
  font-size: 12.5px;
  color: var(--rose, #ef4444);
  text-align: center;
}

.login-btn {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #14b8a6 0%, #0d9488 60%, #0f766e 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 6px 16px -4px rgba(13, 148, 136, 0.45);
  transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
}
.login-btn:hover:not(:disabled) {
  filter: brightness(1.06);
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -4px rgba(13, 148, 136, 0.5);
}
.login-btn:active:not(:disabled) { transform: translateY(0); }
.login-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.login-spinner {
  display: inline-block;
  width: 13px;
  height: 13px;
  margin-right: 7px;
  vertical-align: -2px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: login-spin 0.7s linear infinite;
}
@keyframes login-spin { to { transform: rotate(360deg); } }

/* 深色模式 */
[data-theme='dark'] .login-mask {
  background: linear-gradient(160deg, #0c1a22 0%, #0f172a 55%, #111f2d 100%);
}
[data-theme='dark'] .blob-1 { background: rgba(20, 184, 166, 0.16); }
[data-theme='dark'] .blob-2 { background: rgba(99, 102, 241, 0.12); }
[data-theme='dark'] .blob-3 { background: rgba(13, 148, 136, 0.1); }
[data-theme='dark'] .login-card {
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.55);
}
</style>
