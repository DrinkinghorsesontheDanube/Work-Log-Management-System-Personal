<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
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
import ConfirmModal from '../components/ConfirmModal.vue'

const message = useMessage()
const projectsStore = useProjectsStore()
const todosStore = useTodosStore()
const workLogsStore = useWorkLogsStore()
const clientsStore = useClientsStore()
const aiStore = useAiAssistantStore()

const selectedProviderId = ref('deepseek')
const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)
const showApiKey = ref(false)

const newPhaseName = ref('')
const newPhaseColor = ref('#6366f1')
const editingPhase = ref<ProjectPhase | null>(null)
const dragIndex = ref<number | null>(null)

const fileInputRef = ref<HTMLInputElement | null>(null)

const showClearConfirm = ref(false)
const showDemoConfirm = ref(false)

const providerTemplates = AI_PROVIDERS

const providerDescs: Record<string, string> = {
  openai: '全球领先的 AI 模型，支持多语言',
  deepseek: '国产高性价比大模型，中文能力优秀',
  xiaomi: '小米自研推理模型，高性价比',
  qwen: '阿里通义千问，企业级 AI 能力',
  moonshot: 'Kimi 长文本处理，适合文档分析',
  zhipu: '智谱 GLM 系列，学术背景深厚',
  custom: '自定义兼容 OpenAI 协议的服务'
}

// localStorage 不是响应式来源，改用显式刷新的状态：保存/清除/外部弹窗修改配置后都调 refreshAiStatus
// 注意：getAiProvider() 返回的是脱敏配置（无 apiKey，带 hasKey 标记），Key 只存在服务端
const aiStatus = ref<{ configured: boolean; name: string }>({ configured: false, name: '' })
const savedKeyExists = ref(false)

function refreshAiStatus() {
  const saved = storage.getAiProvider()
  if (saved && saved.hasKey) {
    const name = providerTemplates.find(p => p.id === saved.id)?.name || saved.id
    aiStatus.value = { configured: true, name }
  } else {
    aiStatus.value = { configured: false, name: '' }
  }
}

const clientCount = computed(() => clientsStore.clients.length)
const projectCount = computed(() => projectsStore.projects.length)
const activeProjectCount = computed(() => projectsStore.projects.filter(p => p.status === 'in_progress').length)
const logCount = computed(() => workLogsStore.workLogs.length)
const todoCount = computed(() => todosStore.todos.length)
const pendingTodoCount = computed(() => todosStore.todos.filter(t => t.status === 'pending').length)

function loadAiConfig() {
  const saved = storage.getAiProvider()
  if (saved) {
    selectedProviderId.value = saved.id
    savedKeyExists.value = saved.hasKey
    // Key 不回显，只提示已保存
    apiKey.value = ''
    baseUrl.value = saved.baseUrl
    model.value = saved.model
  } else {
    savedKeyExists.value = false
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
  if (!apiKey.value.trim() && !savedKeyExists.value) {
    message.warning('请输入 API Key')
    return
  }
  const provider: AiProvider = {
    id: selectedProviderId.value,
    name: providerTemplates.find(p => p.id === selectedProviderId.value)?.name || selectedProviderId.value,
    baseUrl: baseUrl.value,
    model: model.value,
    // 留空时服务端自动沿用已保存的 Key
    apiKey: apiKey.value.trim(),
    enabled: true
  }
  storage.saveAiProvider(provider)
  savedKeyExists.value = savedKeyExists.value || !!apiKey.value.trim()
  apiKey.value = ''
  refreshAiStatus()
  message.success('AI 配置已保存')
}

function clearAiConfig() {
  storage.saveAiProvider(null)
  apiKey.value = ''
  savedKeyExists.value = false
  testResult.value = null
  refreshAiStatus()
  message.success('AI 配置已清除')
}

async function doTestConnection() {
  if (!apiKey.value.trim() && !savedKeyExists.value) {
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
    // 留空时服务端会自动使用已保存的 Key 测试
    apiKey: apiKey.value.trim(),
    enabled: true
  }
  testResult.value = await testConnection(provider)
  testing.value = false
}

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

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(_index: number, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(index: number, e: DragEvent) {
  e.preventDefault()
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null
    return
  }
  const phases = [...sortedPhases.value]
  const [moved] = phases.splice(dragIndex.value, 1)
  phases.splice(index, 0, moved)
  phases.forEach((p, i) => {
    projectsStore.updatePhase(p.id, { order: i })
  })
  dragIndex.value = null
  message.success('阶段顺序已更新')
}

function onDragEnd() {
  dragIndex.value = null
}

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
      clientsStore.loadClients()
      aiStore.loadMessages()
      loadAiConfig()
      refreshAiStatus()
      message.success('数据已导入')
    } catch {
      message.error('导入失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
  target.value = ''
}

function confirmClearAllData() {
  showClearConfirm.value = true
}

function doClearAllData() {
  storage.clearAllData()
  // 不清除 worklog_seeded_v11 标记：避免下次启动又自动灌入演示数据
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  clientsStore.loadClients()
  aiStore.clearMessages()
  refreshAiStatus()
  message.success('数据已清空')
}

function confirmLoadDemoData() {
  showDemoConfirm.value = true
}

function doLoadDemoData() {
  seedAllData()
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  clientsStore.loadClients()
  refreshAiStatus()
  message.success('演示数据已加载')
}

onMounted(() => {
  loadAiConfig()
  refreshAiStatus()
  projectsStore.loadPhases()
  projectsStore.loadProjects()
  clientsStore.loadClients()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  // AI 配置弹窗在其他页面保存/清除时会广播此事件
  window.addEventListener('ai-config-changed', refreshAiStatus)
})

onBeforeUnmount(() => {
  window.removeEventListener('ai-config-changed', refreshAiStatus)
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

    <div class="settings-grid">
      <div class="settings-left">
        <div class="card">
          <div class="card-header">
            <span class="card-title">AI 服务配置</span>
            <span v-if="aiStatus.configured" class="badge badge-green status-badge">
              ✓ 已连接 {{ aiStatus.name }}
            </span>
            <span v-else class="badge badge-amber status-badge">⚠ 未配置</span>
          </div>
          <div class="card-body">
            <div class="card-body-inner">
              <div class="form-field">
                <label>供应商</label>
                <select v-model="selectedProviderId" class="input" @change="onProviderChange">
                  <option v-for="p in providerTemplates" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <div class="provider-desc">
                  <span v-if="selectedProviderId === 'deepseek'" class="badge badge-blue recommend-badge">推荐</span>
                  {{ providerDescs[selectedProviderId] || '' }}
                </div>
              </div>
              <div class="form-field">
                <label>API Key <span class="required">*</span></label>
                <div class="api-key-wrap">
                  <input
                    v-model="apiKey"
                    :type="showApiKey ? 'text' : 'password'"
                    :placeholder="savedKeyExists ? '已保存，留空则继续使用原 Key' : '输入 API Key'"
                    class="input"
                  />
                  <button class="btn-icon toggle-key-btn" @click="showApiKey = !showApiKey" :title="showApiKey ? '隐藏' : '显示'">
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
                <button class="btn btn-primary save-btn" @click="saveAiConfig">保存配置</button>
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
            <span class="phase-count">{{ sortedPhases.length }} 个阶段</span>
          </div>
          <div class="card-body">
            <div class="card-body-inner">
              <div class="phase-list">
                <div
                  v-for="(phase, index) in sortedPhases"
                  :key="phase.id"
                  class="phase-item"
                  :class="{ dragging: dragIndex === index }"
                  draggable="true"
                  @dragstart="onDragStart(index, $event)"
                  @dragover="onDragOver(index, $event)"
                  @drop="onDrop(index, $event)"
                  @dragend="onDragEnd"
                >
                  <template v-if="editingPhase?.id === phase.id">
                    <span class="phase-drag-handle disabled">⋮⋮</span>
                    <input v-model="editingPhase.name" class="input phase-edit-input" />
                    <input v-model="editingPhase.color" type="color" class="color-input" />
                    <button class="btn btn-sm btn-primary" @click="saveEditPhase">保存</button>
                    <button class="btn btn-sm btn-ghost" @click="editingPhase = null">取消</button>
                  </template>
                  <template v-else>
                    <span class="phase-drag-handle">⋮⋮</span>
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
              <div class="phase-add">
                <input v-model="newPhaseName" placeholder="新阶段名称" class="input" style="flex:1" />
                <input v-model="newPhaseColor" type="color" class="color-input" />
                <button class="btn btn-primary" @click="addPhase">添加</button>
                <button class="btn btn-ghost reset-btn" @click="resetPhases">恢复默认</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-right">
        <div class="card">
          <div class="card-header">
            <span class="card-title">数据总览</span>
          </div>
          <div class="card-body">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon stat-icon-blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ clientCount }}</div>
                  <div class="stat-label">客户数量</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-purple">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ projectCount }} <span class="stat-sub">进行中 {{ activeProjectCount }}</span></div>
                  <div class="stat-label">项目数量</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-green">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ logCount }}</div>
                  <div class="stat-label">工作日志</div>
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon stat-icon-amber">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ todoCount }} <span class="stat-sub">待处理 {{ pendingTodoCount }}</span></div>
                  <div class="stat-label">待办事项</div>
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
                  <div class="data-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </div>
                  <div class="data-item-info">
                    <strong>导出数据</strong>
                    <p>导出所有数据为 JSON 备份文件</p>
                  </div>
                  <button class="btn" @click="exportData">导出</button>
                </div>
                <div class="data-item">
                  <div class="data-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div class="data-item-info">
                    <strong>导入数据</strong>
                    <p>从 JSON 备份文件恢复数据</p>
                  </div>
                  <button class="btn" @click="triggerImport">导入</button>
                  <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="importData" />
                </div>
                <div class="data-item">
                  <div class="data-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </div>
                  <div class="data-item-info">
                    <strong>演示数据</strong>
                    <p>加载政企售前业务场景的演示数据</p>
                  </div>
                  <button class="btn" @click="confirmLoadDemoData">加载</button>
                </div>
                <div class="data-item danger-zone">
                  <div class="data-item-icon danger-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </div>
                  <div class="data-item-info">
                    <strong>清空数据</strong>
                    <p>清空所有数据，此操作不可恢复</p>
                  </div>
                  <button class="btn btn-danger" @click="confirmClearAllData">清空</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      :visible="showClearConfirm"
      title="清空所有数据"
      message="确定要清空所有数据吗？此操作不可恢复！所有客户、项目、日志、待办等数据都将被永久删除。"
      confirm-text="确认清空"
      :danger="true"
      @confirm="showClearConfirm = false; doClearAllData()"
      @cancel="showClearConfirm = false"
    />

    <ConfirmModal
      :visible="showDemoConfirm"
      title="加载演示数据"
      message="将清除现有数据并加载演示数据，此操作会覆盖当前所有数据，确定继续？"
      confirm-text="确认加载"
      @confirm="showDemoConfirm = false; doLoadDemoData()"
      @cancel="showDemoConfirm = false"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  align-items: start;
}

.settings-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 960px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.card-body-inner {
  padding: 18px;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
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

.provider-desc {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.recommend-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  flex-shrink: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.api-key-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.api-key-wrap .input {
  padding-right: 40px;
  width: 100%;
}

.toggle-key-btn {
  position: absolute;
  right: 4px;
  width: 32px;
  height: 32px;
  color: var(--text-muted);
}

.toggle-key-btn:hover {
  color: var(--text);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.save-btn {
  padding: 7px 24px;
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

.phase-count {
  font-size: 12px;
  color: var(--text-muted);
}

.phase-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}

.phase-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  transition: background 0.12s, opacity 0.15s, box-shadow 0.15s;
  border: 1px solid transparent;
}

.phase-item:hover {
  background: var(--bg-hover);
}

.phase-item.dragging {
  opacity: 0.5;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-light);
}

.phase-drag-handle {
  font-size: 14px;
  color: var(--text-placeholder);
  cursor: grab;
  user-select: none;
  letter-spacing: -2px;
  line-height: 1;
  flex-shrink: 0;
}

.phase-drag-handle.disabled {
  cursor: default;
  opacity: 0.3;
}

.phase-drag-handle:hover {
  color: var(--text-muted);
}

.phase-edit-input {
  flex: 1;
}

.color-input {
  width: 34px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 2px;
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

.phase-add {
  display: flex;
  gap: 6px;
}

.reset-btn {
  font-size: 12px;
  color: var(--text-muted);
}

.reset-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 14px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
  transition: box-shadow 0.15s;
}

.stat-card:hover {
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-blue { background: #eff6ff; color: #3b82f6; }
.stat-icon-purple { background: #faf5ff; color: #a855f7; }
.stat-icon-green { background: #f0fdf4; color: #22c55e; }
.stat-icon-amber { background: #fffbeb; color: #f59e0b; }

.stat-info {
  min-width: 0;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.stat-sub {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg);
  border-radius: var(--radius-sm);
}

.data-item-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.data-item-icon.danger-icon {
  color: var(--rose);
}

.data-item-info {
  flex: 1;
  min-width: 0;
}

.data-item-info strong {
  font-size: 13px;
  color: var(--text);
  display: block;
  margin-bottom: 1px;
}

.data-item-info p {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.danger-zone {
  background: var(--rose-bg);
  border: 1px solid #fecdd3;
}
</style>
