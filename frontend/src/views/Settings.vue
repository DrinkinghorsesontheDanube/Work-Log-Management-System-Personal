<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import { useClientsStore } from '../stores/clients'
import { useAiAssistantStore } from '../stores/aiAssistant'
import { storage } from '../utils/storage'
import { seedAllData } from '../utils/seedData'
import { testConnection } from '../services/aiService'
import { AI_PROVIDERS } from '../types'
import type { AiProvider, ProjectPhase } from '../types'

const message = useMessage()
const projectsStore = useProjectsStore()
const todosStore = useTodosStore()
const workLogsStore = useWorkLogsStore()
const clientsStore = useClientsStore()
const aiStore = useAiAssistantStore()

// AI Config
const selectedProviderId = ref('deepseek')
const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

// Phase management
const newPhaseName = ref('')
const newPhaseColor = ref('#6366f1')
const editingPhase = ref<ProjectPhase | null>(null)

const fileInputRef = ref<HTMLInputElement | null>(null)

const providerTemplates = AI_PROVIDERS

function loadAiConfig() {
  const saved = storage.getAiProvider()
  if (saved) {
    selectedProviderId.value = saved.id
    apiKey.value = saved.apiKey
    baseUrl.value = saved.baseUrl
    model.value = saved.model
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
  testResult.value = null
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

// Phase management
const sortedPhases = computed(() =>
  [...projectsStore.phases].sort((a, b) => a.order - b.order)
)

function addPhase() {
  if (!newPhaseName.value.trim()) return
  projectsStore.addPhase(newPhaseName.value, newPhaseColor.value)
  newPhaseName.value = ''
  newPhaseColor.value = '#6366f1'
  message.success('阶段已添加')
}

function startEditPhase(phase: ProjectPhase) {
  editingPhase.value = { ...phase }
}

function saveEditPhase() {
  if (!editingPhase.value) return
  projectsStore.updatePhase(editingPhase.value.id, {
    name: editingPhase.value.name,
    color: editingPhase.value.color
  })
  editingPhase.value = null
  message.success('阶段已更新')
}

function deletePhase(id: string) {
  projectsStore.deletePhase(id)
  message.success('阶段已删除')
}

function resetPhases() {
  projectsStore.resetPhases()
  message.success('已恢复默认阶段')
}

// Data management
function exportData() {
  const dataStr = storage.exportAllData()
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `工作日志备份_${new Date().toLocaleDateString('zh-CN')}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  message.success('数据已导出')
}

function triggerImport() {
  fileInputRef.value?.click()
}

function importData(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      storage.importAllData(data)
      projectsStore.loadProjects()
      projectsStore.loadPhases()
      todosStore.loadTodos()
      workLogsStore.loadWorkLogs()
      aiStore.loadMessages()
      message.success('数据已导入')
    } catch {
      message.error('导入失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
  target.value = ''
}

function clearAllData() {
  if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return
  storage.clearAllData()
  localStorage.removeItem('worklog_seeded')
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  clientsStore.loadClients()
  aiStore.clearMessages()
  message.success('数据已清空')
}

function loadDemoData() {
  if (!confirm('将清除现有数据并加载演示数据，确定继续？')) return
  seedAllData()
  localStorage.setItem('worklog_seeded', '1')
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  clientsStore.loadClients()
  message.success('演示数据已加载')
}

onMounted(() => {
  loadAiConfig()
  projectsStore.loadPhases()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-subtitle">AI 配置、项目阶段管理、数据管理</p>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">AI 服务配置</span>
      </div>
      <div class="card-body">
        <div class="card-body-inner">
          <div class="form-field">
            <label>供应商</label>
            <select v-model="selectedProviderId" class="input" @change="onProviderChange">
              <option v-for="p in providerTemplates" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>API Key <span class="required">*</span></label>
            <input v-model="apiKey" type="password" placeholder="输入 API Key" class="input" />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>API 地址</label>
              <input v-model="baseUrl" class="input" placeholder="Base URL" />
            </div>
            <div class="form-field">
              <label>模型</label>
              <input v-model="model" class="input" placeholder="模型名称" />
            </div>
          </div>
          <div class="actions">
            <button class="btn btn-primary" @click="saveAiConfig">保存配置</button>
            <button class="btn" @click="doTestConnection" :disabled="testing">
              {{ testing ? '测试中...' : '测试连接' }}
            </button>
            <button class="btn btn-ghost" @click="clearAiConfig">清除配置</button>
          </div>
          <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
            {{ testResult.message }}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">项目阶段管理</span>
      </div>
      <div class="card-body">
        <div class="card-body-inner">
          <div class="phase-add">
            <input v-model="newPhaseName" placeholder="新阶段名称" class="input" style="flex:1" />
            <input v-model="newPhaseColor" type="color" class="color-input" />
            <button class="btn btn-primary" @click="addPhase">添加</button>
            <button class="btn btn-ghost" @click="resetPhases">恢复默认</button>
          </div>
          <div class="phase-list">
            <div v-for="phase in sortedPhases" :key="phase.id" class="phase-item">
              <template v-if="editingPhase?.id === phase.id">
                <input v-model="editingPhase.name" class="input" style="flex:1" />
                <input v-model="editingPhase.color" type="color" class="color-input" />
                <button class="btn btn-sm btn-primary" @click="saveEditPhase">保存</button>
                <button class="btn btn-sm btn-ghost" @click="editingPhase = null">取消</button>
              </template>
              <template v-else>
                <span class="phase-dot" :style="{ background: phase.color }"></span>
                <span class="phase-name">{{ phase.name }}</span>
                <span class="phase-order">#{{ phase.order + 1 }}</span>
                <div class="phase-actions">
                  <button class="btn-icon" @click="startEditPhase(phase)" title="编辑">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon delete-icon" @click="deletePhase(phase.id)" title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">数据管理</span>
      </div>
      <div class="card-body">
        <div class="card-body-inner">
          <div class="data-actions">
            <div class="data-item">
              <div>
                <strong>导出数据</strong>
                <p>导出所有数据为 JSON 备份文件</p>
              </div>
              <button class="btn" @click="exportData">导出</button>
            </div>
            <div class="data-item">
              <div>
                <strong>导入数据</strong>
                <p>从 JSON 备份文件恢复数据</p>
              </div>
              <button class="btn" @click="triggerImport">导入</button>
              <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="importData" />
            </div>
            <div class="data-item">
              <div>
                <strong>演示数据</strong>
                <p>加载政企售前业务场景的演示数据（含客户、项目、日志、待办）</p>
              </div>
              <button class="btn" @click="loadDemoData">加载</button>
            </div>
            <div class="data-item danger-zone">
              <div>
                <strong>清空数据</strong>
                <p>清空所有数据，此操作不可恢复</p>
              </div>
              <button class="btn btn-danger" @click="clearAllData">清空</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-body-inner {
  padding: 18px;
}

.form-field {
  margin-bottom: 14px;
}

.form-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

.required {
  color: var(--rose);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.test-result {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.5;
}

.test-result.success {
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid #a7f3d0;
}

.test-result.error {
  background: var(--rose-bg);
  color: var(--rose);
  border: 1px solid #fecdd3;
}

.color-input {
  width: 34px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 2px;
}

.phase-add {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.phase-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.phase-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  transition: background 0.12s;
}

.phase-item:hover {
  background: var(--bg-hover);
}

.phase-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.phase-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.phase-order {
  font-size: 11px;
  color: var(--text-muted);
}

.phase-actions {
  display: flex;
  gap: 2px;
}

.delete-icon:hover {
  background: var(--rose-bg);
  color: var(--rose);
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--bg);
  border-radius: var(--radius-sm);
}

.data-item strong {
  font-size: 13px;
  color: var(--text);
  display: block;
  margin-bottom: 1px;
}

.data-item p {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.danger-zone {
  background: var(--rose-bg);
  border: 1px solid #fecdd3;
}
</style>
