<template>
  <Teleport to="body">
    <Transition name="prompt-fade">
      <div v-if="visible" class="ai-prompt-overlay" @click.self="close">
        <div class="ai-prompt-card">
          <div class="ai-prompt-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1a1 1 0 0 0 1 1h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1a1 1 0 0 0-1 1v1a4 4 0 0 1-8 0v-1a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1a1 1 0 0 0 1-1V6a4 4 0 0 1 4-4z"/>
              <circle cx="9" cy="10" r="1" fill="#6366f1"/>
              <circle cx="15" cy="10" r="1" fill="#6366f1"/>
              <path d="M9.5 15a3.5 3.5 0 0 0 5 0"/>
            </svg>
          </div>
          <h3 class="ai-prompt-title">需要配置 AI 服务</h3>
          <p class="ai-prompt-desc">此功能需要调用 AI 大模型，请先配置 API 密钥后使用。</p>
          <div class="ai-prompt-steps">
            <div class="ai-step">
              <span class="ai-step-num">1</span>
              <span>选择 AI 供应商</span>
            </div>
            <div class="ai-step">
              <span class="ai-step-num">2</span>
              <span>填入 API Key</span>
            </div>
            <div class="ai-step">
              <span class="ai-step-num">3</span>
              <span>测试连接成功后即可使用</span>
            </div>
          </div>
          <div class="ai-prompt-actions">
            <button class="ai-prompt-btn secondary" @click="close">稍后再说</button>
            <button class="ai-prompt-btn primary" @click="openAiSettings">前往配置</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'

const visible = ref(false)
const showAiSettingsModal = inject<() => void>('showAiSettingsModal', () => {})

function show() {
  visible.value = true
}

function close() {
  visible.value = false
}

function openAiSettings() {
  close()
  showAiSettingsModal()
}

defineExpose({ show })
</script>

<style scoped>
.ai-prompt-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.ai-prompt-card {
  background: var(--bg-card, #fff);
  border-radius: 16px;
  padding: 36px 32px 28px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  text-align: center;
}
.ai-prompt-icon {
  margin-bottom: 16px;
}
.ai-prompt-title {
  font-size: 18px; font-weight: 700;
  color: var(--text, #1e293b);
  margin: 0 0 8px;
}
.ai-prompt-desc {
  font-size: 14px; color: var(--text-secondary, #475569);
  margin: 0 0 20px; line-height: 1.6;
}
.ai-prompt-steps {
  text-align: left;
  background: var(--bg, #f8fafc);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 22px;
}
.ai-step {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0;
  font-size: 14px; color: var(--text, #1e293b);
}
.ai-step-num {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--primary, #6366f1);
  color: #fff; font-size: 12px; font-weight: 700;
  flex-shrink: 0;
}
.ai-prompt-actions {
  display: flex; gap: 10px; justify-content: center;
}
.ai-prompt-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 15px; font-weight: 600;
  cursor: pointer; border: none;
  transition: all 0.15s;
}
.ai-prompt-btn.primary {
  background: var(--primary, #6366f1);
  color: #fff;
}
.ai-prompt-btn.primary:hover {
  background: #4f46e5;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
.ai-prompt-btn.secondary {
  background: var(--bg, #f1f5f9);
  color: var(--text-secondary, #475569);
  border: 1px solid var(--border-light, #e2e8f0);
}
.ai-prompt-btn.secondary:hover {
  background: var(--border-light, #e2e8f0);
}
.prompt-fade-enter-active, .prompt-fade-leave-active {
  transition: opacity 0.2s ease;
}
.prompt-fade-enter-active .ai-prompt-card, .prompt-fade-leave-active .ai-prompt-card {
  transition: transform 0.2s ease;
}
.prompt-fade-enter-from, .prompt-fade-leave-to {
  opacity: 0;
}
.prompt-fade-enter-from .ai-prompt-card {
  transform: scale(0.95) translateY(10px);
}
</style>