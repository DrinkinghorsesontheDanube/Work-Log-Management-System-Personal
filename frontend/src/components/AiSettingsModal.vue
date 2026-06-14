<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { storage } from '../utils/storage'
import { testConnection } from '../services/aiService'
import { AI_PROVIDERS } from '../types'
import type { AiProvider } from '../types'

const message = useMessage()

const visible = ref(false)
const selectedProviderId = ref('deepseek')
const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)
const showApiKey = ref(false)

const providerTemplates = AI_PROVIDERS

const providerDescs: Record<string, string> = {
  openai: 'GPT-4o / GPT-4o-mini，全球最知名的大模型',
  deepseek: '国产高性价比大模型，中文能力强（推荐）',
  xiaomi: '小米 MiMo 大模型',
  qwen: '阿里通义千问，国产主流大模型',
  moonshot: 'Moonshot (Kimi)，长文本能力突出',
  zhipu: '智谱 GLM，清华系大模型',
  custom: '自定义 OpenAI 兼容接口'
}

const aiStatus = computed(() => {
  const saved = storage.getAiProvider()
  if (saved && saved.apiKey) {
    const name = providerTemplates.find(p => p.id === saved.id)?.name || saved.id
    return { configured: true, name }
  }
  return { configured: false, name: '' }
})

function show() {
  loadAiConfig()
  testResult.value = null
  visible.value = true
}

function close() {
  visible.value = false
}

function loadAiConfig() {
  const saved = storage.getAiProvider()
  if (saved) {
    selectedProviderId.value = saved.id
    apiKey.value = saved.apiKey
    baseUrl.value = saved.baseUrl
    model.value = saved.model
  } else {
    selectedProviderId.value = 'deepseek'
    apiKey.value = ''
    const tpl = providerTemplates.find(p => p.id === 'deepseek')
    if (tpl) {
      baseUrl.value = tpl.baseUrl
      model.value = tpl.model
    }
  }
}

function onProviderChange() {
  const tpl = providerTemplates.find(p => p.id === selectedProviderId.value)
  if (tpl) {
    baseUrl.value = tpl.baseUrl
    model.value = tpl.model
  }
}

function saveAiConfig() {
  if (!apiKey.value.trim()) {
    message.warning('请输入 API Key')
    return
  }
  const provider: AiProvider = {
    id: selectedProviderId.value,
    name: providerTemplates.find(p => p.id === selectedProviderId.value)?.name || selectedProviderId.value,
    baseUrl: baseUrl.value,
    model: model.value,
    apiKey: apiKey.value,
    enabled: true
  }
  storage.saveAiProvider(provider)
  message.success('AI 配置已保存')
}

function clearAiConfig() {
  storage.saveAiProvider(null)
  apiKey.value = ''
  baseUrl.value = ''
  model.value = ''
  selectedProviderId.value = 'deepseek'
  testResult.value = null
  showApiKey.value = false
  message.success('AI 配置已清除')
}

async function doTestConnection() {
  if (!apiKey.value.trim()) {
    message.warning('请先输入 API Key')
    return
  }
  testing.value = true
  testResult.value = null
  const provider: AiProvider = {
    id: selectedProviderId.value,
    name: providerTemplates.find(p => p.id === selectedProviderId.value)?.name || selectedProviderId.value,
    baseUrl: baseUrl.value,
    model: model.value,
    apiKey: apiKey.value,
    enabled: true
  }
  testResult.value = await testConnection(provider)
  testing.value = false
}

defineExpose({ show })
</script>

<template>
  <Teleport to="body">
    <Transition name="ais-fade">
      <div v-if="visible" class="ais-overlay" @click.self="close">
        <div class="ais-card">
          <div class="ais-header">
            <div class="ais-title-row">
              <div class="ais-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4v1a1 1 0 0 0 1 1h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1a1 1 0 0 0-1 1v1a4 4 0 0 1-8 0v-1a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1a1 1 0 0 0 1-1V6a4 4 0 0 1 4-4z"/>
                  <circle cx="9" cy="10" r="1" fill="currentColor"/>
                  <circle cx="15" cy="10" r="1" fill="currentColor"/>
                  <path d="M9.5 15a3.5 3.5 0 0 0 5 0"/>
                </svg>
              </div>
              <div>
                <h3 class="ais-title">AI 服务配置</h3>
                <span v-if="aiStatus.configured" class="ais-status ais-status-ok">
                  ✓ 已连接 {{ aiStatus.name }}
                </span>
                <span v-else class="ais-status ais-status-warn">⚠ 未配置</span>
              </div>
            </div>
            <button class="ais-close" @click="close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="ais-body">
            <div class="ais-field">
              <label class="ais-label">供应商</label>
              <select v-model="selectedProviderId" class="input ais-select" @change="onProviderChange">
                <option v-for="p in providerTemplates" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <div class="ais-provider-desc">
                <span v-if="selectedProviderId === 'deepseek'" class="ais-recommend">推荐</span>
                {{ providerDescs[selectedProviderId] || '' }}
              </div>
            </div>

            <div class="ais-field">
              <label class="ais-label">API Key <span class="ais-required">*</span></label>
              <div class="ais-key-wrap">
                <input
                  v-model="apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  placeholder="输入 API Key"
                  class="input"
                />
                <button class="ais-toggle-key" @click="showApiKey = !showApiKey" :title="showApiKey ? '隐藏' : '显示'">
                  <svg v-if="showApiKey" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="ais-row">
              <div class="ais-field">
                <label class="ais-label">API 地址</label>
                <input v-model="baseUrl" class="input" placeholder="Base URL" />
              </div>
              <div class="ais-field">
                <label class="ais-label">模型</label>
                <input v-model="model" class="input" placeholder="模型名称" />
              </div>
            </div>

            <div v-if="testResult" :class="['ais-test-result', testResult.success ? 'ais-test-ok' : 'ais-test-err']">
              {{ testResult.message }}
            </div>
          </div>

          <div class="ais-footer">
            <button class="btn btn-ghost" @click="clearAiConfig">清除配置</button>
            <div class="ais-footer-right">
              <button class="btn" @click="doTestConnection" :disabled="testing">
                {{ testing ? '测试中...' : '测试连接' }}
              </button>
              <button class="btn btn-primary ais-save-btn" @click="saveAiConfig">保存配置</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ais-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ais-card {
  background: var(--bg-card, #fff);
  border-radius: 16px;
  width: 420px;
  max-width: 92vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}

.ais-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 24px 0;
}

.ais-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ais-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #eef2ff;
  color: var(--primary, #6366f1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ais-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text, #0f172a);
  margin: 0 0 2px;
}

.ais-status {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.ais-status-ok {
  background: #dcfce7;
  color: #16a34a;
}

.ais-status-warn {
  background: #fef3c7;
  color: #d97706;
}

.ais-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--text-muted, #94a3b8);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.ais-close:hover {
  background: var(--bg-hover, #f1f5f9);
  color: var(--text, #334155);
}

.ais-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ais-field {
  display: flex;
  flex-direction: column;
}

.ais-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #475569);
  margin-bottom: 6px;
}

.ais-required {
  color: var(--rose, #ef4444);
}

.ais-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.ais-provider-desc {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  line-height: 1.4;
}

.ais-recommend {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 6px;
  background: #e0e7ff;
  color: #4f46e5;
  flex-shrink: 0;
}

.ais-key-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.ais-key-wrap .input {
  padding-right: 40px;
  width: 100%;
}

.ais-toggle-key {
  position: absolute;
  right: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--text-muted, #94a3b8);
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.15s;
}

.ais-toggle-key:hover {
  color: var(--text, #334155);
}

.ais-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ais-test-result {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.ais-test-ok {
  background: #dcfce7;
  color: #16a34a;
  border: 1px solid #a7f3d0;
}

.ais-test-err {
  background: #fef2f2;
  color: #ef4444;
  border: 1px solid #fecdd3;
}

.ais-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-light, #e2e8f0);
}

.ais-footer-right {
  display: flex;
  gap: 8px;
}

.ais-save-btn {
  padding: 8px 24px;
}

.ais-fade-enter-active,
.ais-fade-leave-active {
  transition: opacity 0.2s ease;
}

.ais-fade-enter-active .ais-card,
.ais-fade-leave-active .ais-card {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}

.ais-fade-enter-from,
.ais-fade-leave-to {
  opacity: 0;
}

.ais-fade-enter-from .ais-card {
  opacity: 0;
  transform: scale(0.92) translateY(12px);
}

.ais-fade-leave-to .ais-card {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}
</style>
