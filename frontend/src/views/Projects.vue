<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import { useClientsStore } from '../stores/clients'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import ConfirmModal from '../components/ConfirmModal.vue'
import type { Project, ProjectPhase } from '../types'

const router = useRouter()
const projectsStore = useProjectsStore()
const clientsStore = useClientsStore()
const todosStore = useTodosStore()
const workLogsStore = useWorkLogsStore()

const showModal = ref(false)
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmDanger = ref(false)
let confirmResolve: ((v: boolean) => void) | null = null

function showConfirm(title: string, message: string, danger = false): Promise<boolean> {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmDanger.value = danger
  confirmVisible.value = true
  return new Promise(resolve => { confirmResolve = resolve })
}
function onConfirmOk() { confirmVisible.value = false; confirmResolve?.(true) }
function onConfirmCancel() { confirmVisible.value = false; confirmResolve?.(false) }
const editingProject = ref<Project | null>(null)
const formName = ref('')
const formDesc = ref('')
const formProgress = ref(0)
const formStatus = ref<Project['status']>('planning')
const formPhaseId = ref('')
const formStartDate = ref('')
const formEndDate = ref('')
const formClientId = ref<string | null>(null)
const formClientLeaderId = ref<string | null>(null)
const formClientExecutorId = ref<string | null>(null)
const formBudget = ref(0)
const formManager = ref('')

const searchQuery = ref('')
const filterStatus = ref<string>('all')
const filterPhase = ref<string>('all')
const sortBy = ref<'name' | 'startDate' | 'progress' | 'budget'>('startDate')
const sortDir = ref<'asc' | 'desc'>('desc')
const viewMode = ref<'grid' | 'list'>('grid')

const phaseExpanded = ref(false)
const newPhaseName = ref('')
const newPhaseColor = ref('#6366f1')
const editingPhase = ref<ProjectPhase | null>(null)
const dragPhase = ref<ProjectPhase | null>(null)

const statusOptions = [
  { label: '规划中', value: 'planning' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已暂停', value: 'paused' }
]

const statusText: Record<string, string> = {
  planning: '规划中', in_progress: '进行中', completed: '已完成', paused: '已暂停'
}

const sortedPhases = computed(() =>
  [...projectsStore.phases].sort((a, b) => a.order - b.order)
)

function getPhaseName(id: string) {
  return projectsStore.phases.find(p => p.id === id)?.name || id
}

function getPhaseColor(id: string) {
  return projectsStore.phases.find(p => p.id === id)?.color || '#6366f1'
}

function addPhase() {
  if (!newPhaseName.value.trim()) return
  projectsStore.addPhase(newPhaseName.value, newPhaseColor.value)
  newPhaseName.value = ''
  newPhaseColor.value = '#6366f1'
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
}

function deletePhase(id: string) {
  projectsStore.deletePhase(id)
}

function resetPhases() {
  projectsStore.resetPhases()
}

function onDragStart(e: DragEvent, phase: ProjectPhase) {
  dragPhase.value = phase
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, phase: ProjectPhase) {
  e.dataTransfer!.dropEffect = 'move'
}

function onDrop(target: ProjectPhase) {
  if (!dragPhase.value || dragPhase.value.id === target.id) return
  projectsStore.reorderPhases(dragPhase.value.id, target.id)
  dragPhase.value = null
}

function getClientName(id: string | null) {
  if (!id) return ''
  return clientsStore.clients.find(c => c.id === id)?.name || ''
}

const selectedClientContacts = computed(() => {
  if (!formClientId.value) return []
  const client = clientsStore.clients.find(c => c.id === formClientId.value)
  return client?.contacts || []
})

function getContactName(clientId: string | null, contactId: string | null): string {
  if (!clientId || !contactId) return ''
  const client = clientsStore.clients.find(c => c.id === clientId)
  return client?.contacts.find(ct => ct.id === contactId)?.name || ''
}

watch(formClientId, () => {
  formClientLeaderId.value = null
  formClientExecutorId.value = null
})

function getProjectTodoCount(projectId: string) {
  return todosStore.todos.filter(t => t.projectId === projectId && t.status !== 'completed').length
}

function getProjectLogCount(projectId: string) {
  return workLogsStore.workLogs.filter(l => l.projectId === projectId).length
}

function getDaysRemaining(endDate: string) {
  if (!endDate) return null
  const end = new Date(endDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - now.getTime()) / 86400000)
}

function formatBudget(val: number) {
  if (val >= 10000) return (val / 10000).toFixed(1) + '亿'
  return val + '万'
}

const projectStats = computed(() => {
  const all = projectsStore.projects
  const inProgress = all.filter(p => p.status === 'in_progress').length
  const completed = all.filter(p => p.status === 'completed').length
  const paused = all.filter(p => p.status === 'paused').length
  const totalBudget = all.reduce((s, p) => s + (p.budget || 0), 0)
  return { total: all.length, inProgress, completed, paused, totalBudget }
})

const filteredProjects = computed(() => {
  let list = [...projectsStore.projects]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.manager || '').toLowerCase().includes(q) ||
      (getClientName(p.clientId) || '').toLowerCase().includes(q)
    )
  }
  if (filterStatus.value !== 'all') {
    list = list.filter(p => p.status === filterStatus.value)
  }
  if (filterPhase.value !== 'all') {
    list = list.filter(p => p.currentPhaseId === filterPhase.value)
  }
  list.sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortBy.value === 'startDate') cmp = a.startDate.localeCompare(b.startDate)
    else if (sortBy.value === 'progress') cmp = a.progress - b.progress
    else if (sortBy.value === 'budget') cmp = (a.budget || 0) - (b.budget || 0)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return list
})

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = 'desc'
  }
}

function openAdd() {
  editingProject.value = null
  formName.value = ''
  formDesc.value = ''
  formProgress.value = 0
  formStatus.value = 'planning'
  formPhaseId.value = sortedPhases.value[0]?.id || ''
  formStartDate.value = new Date().toISOString().split('T')[0]
  formEndDate.value = ''
  formClientId.value = null
  formClientLeaderId.value = null
  formClientExecutorId.value = null
  formBudget.value = 0
  formManager.value = ''
  showModal.value = true
}

function openEdit(project: Project) {
  editingProject.value = project
  formName.value = project.name
  formDesc.value = project.description
  formProgress.value = project.progress
  formStatus.value = project.status
  formPhaseId.value = project.currentPhaseId
  formStartDate.value = project.startDate
  formEndDate.value = project.endDate
  formClientId.value = project.clientId
  formClientLeaderId.value = project.clientLeaderId
  formClientExecutorId.value = project.clientExecutorId
  formBudget.value = project.budget || 0
  formManager.value = project.manager || ''
  showModal.value = true
}

function save() {
  if (!formName.value.trim()) return
  if (editingProject.value) {
    const updates: Partial<Project> = {
      name: formName.value,
      description: formDesc.value,
      progress: formProgress.value,
      status: formStatus.value,
      startDate: formStartDate.value,
      endDate: formEndDate.value,
      clientId: formClientId.value,
      clientLeaderId: formClientLeaderId.value,
      clientExecutorId: formClientExecutorId.value,
      budget: formBudget.value,
      manager: formManager.value
    }
    if (formPhaseId.value !== editingProject.value.currentPhaseId) {
      projectsStore.changePhase(editingProject.value.id, formPhaseId.value)
    }
    projectsStore.updateProject(editingProject.value.id, updates)
  } else {
    projectsStore.addProject({
      name: formName.value,
      description: formDesc.value,
      progress: formProgress.value,
      status: formStatus.value,
      currentPhaseId: formPhaseId.value,
      phaseHistory: [{
        phaseId: formPhaseId.value,
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
        note: '项目创建'
      }],
      startDate: formStartDate.value,
      endDate: formEndDate.value,
      clientId: formClientId.value,
      clientLeaderId: formClientLeaderId.value,
      clientExecutorId: formClientExecutorId.value,
      budget: formBudget.value,
      manager: formManager.value
    })
  }
  showModal.value = false
}

function remove(id: string) {
  const project = projectsStore.projects.find(p => p.id === id)
  showConfirm(`删除「${project?.name}」`, '项目及关联数据将被删除，此操作不可撤销', true).then(ok => {
    if (ok) projectsStore.deleteProject(id)
  })
}

onMounted(() => {
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  clientsStore.loadClients()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">项目管理</h1>
        <p class="page-subtitle">信息化集成项目全生命周期管理</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新建项目
      </button>
    </div>

    <div class="phase-section">
      <div class="phase-section-header" @click="phaseExpanded = !phaseExpanded">
        <span class="phase-section-title">项目阶段管理</span>
        <span class="phase-section-toggle">{{ phaseExpanded ? '收起' : '展开' }}</span>
      </div>
      <div v-if="phaseExpanded" class="phase-section-body">
        <div class="phase-add">
          <input v-model="newPhaseName" placeholder="新阶段名称" class="input" style="flex:1" />
          <input v-model="newPhaseColor" type="color" class="color-input" />
          <button class="btn btn-primary btn-sm" @click="addPhase">添加</button>
          <button class="btn btn-sm" @click="resetPhases">恢复默认</button>
        </div>
        <div class="phase-list">
          <div v-for="phase in sortedPhases" :key="phase.id" class="phase-item"
            draggable="true"
            @dragstart="onDragStart($event, phase)"
            @dragover.prevent="onDragOver($event, phase)"
            @drop="onDrop(phase)"
            @dragend="dragPhase = null"
            :class="{ dragging: dragPhase?.id === phase.id }"
          >
            <span class="phase-grip" title="拖拽排序">⋮⋮</span>
            <template v-if="editingPhase?.id === phase.id">
              <input v-model="editingPhase.name" class="input" style="flex:1" />
              <input v-model="editingPhase.color" type="color" class="color-input" />
              <button class="btn btn-sm btn-primary" @click="saveEditPhase">保存</button>
              <button class="btn btn-sm" @click="editingPhase = null">取消</button>
            </template>
            <template v-else>
              <span class="phase-dot" :style="{ background: phase.color }"></span>
              <span class="phase-name">{{ phase.name }}</span>
              <span class="phase-order">#{{ phase.order + 1 }}</span>
              <div class="phase-actions">
                <button class="btn-icon" @click="startEditPhase(phase)" title="编辑">✏</button>
                <button class="btn-icon delete-icon" @click="deletePhase(phase.id)" title="删除">🗑</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card card">
        <div class="stat-val">{{ projectStats.total }}</div>
        <div class="stat-lbl">项目总数</div>
      </div>
      <div class="stat-card card">
        <div class="stat-val">{{ projectStats.inProgress }}</div>
        <div class="stat-lbl">进行中</div>
      </div>
      <div class="stat-card card">
        <div class="stat-val">{{ projectStats.completed }}</div>
        <div class="stat-lbl">已完成</div>
      </div>
      <div class="stat-card card">
        <div class="stat-val">{{ formatBudget(projectStats.totalBudget) }}</div>
        <div class="stat-lbl">总预算</div>
      </div>
    </div>

    <div class="toolbar card">
      <div class="toolbar-left">
        <input v-model="searchQuery" class="input search-input" placeholder="搜索项目名称、描述、负责人、客户..." />
        <select v-model="filterStatus" class="input filter-select">
          <option value="all">全部状态</option>
          <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <select v-model="filterPhase" class="input filter-select">
          <option value="all">全部阶段</option>
          <option v-for="ph in sortedPhases" :key="ph.id" :value="ph.id">{{ ph.name }}</option>
        </select>
      </div>
      <div class="toolbar-right">
        <div class="sort-group">
          <button v-for="s in [{k:'startDate',l:'日期'},{k:'progress',l:'进度'},{k:'budget',l:'预算'},{k:'name',l:'名称'}]"
            :key="s.k" :class="['sort-btn', { active: sortBy === s.k }]" @click="toggleSort(s.k as any)">
            {{ s.l }}{{ sortBy === s.k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '' }}
          </button>
        </div>
        <div class="view-toggle">
          <button :class="['view-btn', { active: viewMode === 'grid' }]" @click="viewMode = 'grid'" title="卡片视图">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button :class="['view-btn', { active: viewMode === 'list' }]" @click="viewMode = 'list'" title="列表视图">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="filteredProjects.length === 0" class="card">
      <div class="card-empty">{{ searchQuery || filterStatus !== 'all' || filterPhase !== 'all' ? '没有匹配的项目' : '暂无项目，点击「新建项目」开始' }}</div>
    </div>

    <div v-else-if="viewMode === 'grid'" class="project-grid">
      <div v-for="p in filteredProjects" :key="p.id" class="card project-card" @click="router.push(`/projects/${p.id}`)">
        <div class="card-top">
          <h3 class="proj-name">{{ p.name }}</h3>
          <span class="badge" :class="{ 'badge-amber': p.status === 'planning' || p.status === 'paused', 'badge-green': p.status === 'in_progress', 'badge-blue': p.status === 'completed' }">{{ statusText[p.status] }}</span>
        </div>
        <p class="proj-desc">{{ p.description || '暂无描述' }}</p>
        <div class="proj-meta">
          <span v-if="p.manager" class="meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {{ p.manager }}
          </span>
          <span v-if="getClientName(p.clientId)" class="meta-item client-meta">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            {{ getClientName(p.clientId) }}<template v-if="getContactName(p.clientId, p.clientLeaderId)"> · 负责人: {{ getContactName(p.clientId, p.clientLeaderId) }}</template><template v-if="getContactName(p.clientId, p.clientExecutorId)"> · 经办人: {{ getContactName(p.clientId, p.clientExecutorId) }}</template>
          </span>
          <span v-if="p.budget" class="meta-item budget-tag">{{ formatBudget(p.budget) }}</span>
        </div>
        <div class="proj-phase">
          <span class="phase-tag" :style="{ color: getPhaseColor(p.currentPhaseId), background: getPhaseColor(p.currentPhaseId) + '18' }">{{ getPhaseName(p.currentPhaseId) }}</span>
          <span v-if="getDaysRemaining(p.endDate) !== null" :class="['days-tag', { warn: (getDaysRemaining(p.endDate) ?? 0) < 30 }]">
            {{ (getDaysRemaining(p.endDate) ?? 0) >= 0 ? `剩余${getDaysRemaining(p.endDate)}天` : `逾期${Math.abs(getDaysRemaining(p.endDate) ?? 0)}天` }}
          </span>
        </div>
        <div class="proj-progress">
          <div class="progress-row">
            <span class="info-label">进度</span>
            <span class="progress-pct">{{ p.progress }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: p.progress + '%' }"></div>
          </div>
        </div>
        <div class="proj-footer">
          <div class="footer-stats">
            <span class="f-stat">{{ getProjectTodoCount(p.id) }} 待办</span>
            <span class="f-stat">{{ getProjectLogCount(p.id) }} 日志</span>
          </div>
          <div class="card-actions">
            <button class="btn-icon" @click.stop="openEdit(p)" title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete-icon" @click.stop="remove(p.id)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="list-view">
      <table class="proj-table">
        <thead>
          <tr>
            <th class="col-name">项目名称</th>
            <th class="col-status">状态</th>
            <th class="col-phase">阶段</th>
            <th class="col-deadline">截至时间</th>
            <th class="col-manager">负责人</th>
            <th class="col-client">客户</th>
            <th class="col-budget">预算</th>
            <th class="col-progress">进度</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProjects" :key="p.id" @click="router.push(`/projects/${p.id}`)">
            <td class="col-name">
              <div class="cell-name">{{ p.name }}</div>
              <div class="cell-desc">{{ p.description }}</div>
            </td>
            <td class="col-status">
              <span class="badge badge-sm" :class="{ 'badge-amber': p.status === 'planning' || p.status === 'paused', 'badge-green': p.status === 'in_progress', 'badge-blue': p.status === 'completed' }">{{ statusText[p.status] }}</span>
            </td>
            <td class="col-phase">
              <span class="phase-tag" :style="{ color: getPhaseColor(p.currentPhaseId), background: getPhaseColor(p.currentPhaseId) + '18' }">{{ getPhaseName(p.currentPhaseId) }}</span>
            </td>
            <td class="col-deadline">
              <span v-if="p.endDate">{{ p.endDate }}</span>
              <span v-else class="cell-empty">-</span>
            </td>
            <td class="col-manager"><span v-if="p.manager">{{ p.manager }}</span><span v-else class="cell-empty">-</span></td>
            <td class="col-client">
              <template v-if="getClientName(p.clientId)">
                <div class="cell-name-sm">{{ getClientName(p.clientId) }}</div>
                <div v-if="getContactName(p.clientId, p.clientLeaderId) || getContactName(p.clientId, p.clientExecutorId)" class="cell-contact-info">
                  <span v-if="getContactName(p.clientId, p.clientLeaderId)">负责人: {{ getContactName(p.clientId, p.clientLeaderId) }}</span>
                  <span v-if="getContactName(p.clientId, p.clientExecutorId)">经办人: {{ getContactName(p.clientId, p.clientExecutorId) }}</span>
                </div>
              </template>
              <span v-else class="cell-empty">-</span>
            </td>
            <td class="col-budget"><span v-if="p.budget">{{ formatBudget(p.budget) }}</span><span v-else class="cell-empty">-</span></td>
            <td class="col-progress">
              <div class="mini-progress">
                <div class="progress-track"><div class="progress-fill" :style="{ width: p.progress + '%' }"></div></div>
                <span class="mini-pct">{{ p.progress }}%</span>
              </div>
            </td>
            <td class="col-actions">
              <button class="btn-icon" @click.stop="openEdit(p)" title="编辑">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon delete-icon" @click.stop="remove(p.id)" title="删除">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>{{ editingProject ? '编辑项目' : '新建项目' }}</h3>
          <button class="btn-icon" @click="showModal = false" style="font-size:18px">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>项目名称 <span class="required">*</span></label>
            <input v-model="formName" placeholder="请输入项目名称" class="input" />
          </div>
          <div class="form-field">
            <label>项目描述</label>
            <textarea v-model="formDesc" placeholder="请输入项目描述" class="input" rows="3"></textarea>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>关联客户</label>
              <select v-model="formClientId" class="input">
                <option :value="null">不关联</option>
                <option v-for="c in clientsStore.clients" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>项目负责人</label>
              <input v-model="formManager" placeholder="请输入负责人姓名" class="input" />
            </div>
          </div>
          <div v-if="formClientId" class="form-row">
            <div class="form-field">
              <label>客户负责人</label>
              <select v-if="selectedClientContacts.filter(c => c.role === 'leader').length > 0" v-model="formClientLeaderId" class="input">
                <option :value="null">不指定</option>
                <option v-for="c in selectedClientContacts.filter(c => c.role === 'leader')" :key="c.id" :value="c.id">{{ c.name }} · {{ c.title }} · {{ c.department }}</option>
              </select>
              <div v-else class="input input-empty">暂无负责人联系人</div>
            </div>
            <div class="form-field">
              <label>客户经办人</label>
              <select v-if="selectedClientContacts.filter(c => c.role === 'executor').length > 0" v-model="formClientExecutorId" class="input">
                <option :value="null">不指定</option>
                <option v-for="c in selectedClientContacts.filter(c => c.role === 'executor')" :key="c.id" :value="c.id">{{ c.name }} · {{ c.title }} · {{ c.department }}</option>
              </select>
              <div v-else class="input input-empty">暂无经办人联系人</div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>项目状态</label>
              <select v-model="formStatus" class="input">
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>当前阶段</label>
              <select v-model="formPhaseId" class="input">
                <option v-for="ph in sortedPhases" :key="ph.id" :value="ph.id">{{ ph.name }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>项目预算（万元）</label>
              <input v-model.number="formBudget" type="number" min="0" placeholder="0" class="input" />
            </div>
            <div class="form-field">
              <label>项目进度</label>
              <div class="range-wrap">
                <input type="range" v-model.number="formProgress" min="0" max="100" class="range" />
                <span class="range-val">{{ formProgress }}%</span>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>开始日期</label>
              <input v-model="formStartDate" type="date" class="input" />
            </div>
            <div class="form-field">
              <label>结束日期</label>
              <input v-model="formEndDate" type="date" class="input" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="save">保存</button>
        </div>
      </div>
  </div>

  <ConfirmModal
    :visible="confirmVisible"
    :title="confirmTitle"
    :message="confirmMessage"
    :danger="confirmDanger"
    @confirm="onConfirmOk"
    @cancel="onConfirmCancel"
  />
</div>
</template>

<style scoped>
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { text-align: center; padding: 16px 12px; }
.stat-val { font-size: 26px; font-weight: 700; color: var(--primary); line-height: 1; }
.stat-lbl { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px; margin-bottom: 16px; gap: 12px; flex-wrap: wrap;
}
.toolbar-left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex: 1; }
.search-input { width: 260px; padding: 6px 12px; font-size: 13px; }
.filter-select { width: 120px; padding: 6px 10px; font-size: 13px; }
.toolbar-right { display: flex; gap: 12px; align-items: center; }
.sort-group { display: flex; gap: 2px; }
.sort-btn {
  padding: 4px 10px; border: 1px solid var(--border); background: var(--bg-card);
  font-size: 12px; font-family: var(--font); color: var(--text-muted); cursor: pointer;
  transition: all 0.12s; border-radius: var(--radius-sm);
}
.sort-btn:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.sort-btn:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.sort-btn:hover { border-color: var(--primary); color: var(--primary); }
.sort-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.view-toggle { display: flex; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.view-btn {
  padding: 5px 8px; background: var(--bg-card); border: none; cursor: pointer;
  color: var(--text-muted); display: flex; align-items: center; transition: all 0.12s;
}
.view-btn:hover { color: var(--primary); }
.view-btn.active { background: var(--primary); color: #fff; }

.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
.project-card { cursor: pointer; transition: all 0.15s; }
.project-card:hover { box-shadow: var(--shadow-sm); border-color: var(--primary); }
.card-top { padding: 14px 18px 0; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.proj-name { font-size: 15px; font-weight: 600; color: var(--text); margin: 0; line-height: 1.4; }
.proj-desc { font-size: 12px; color: var(--text-muted); padding: 4px 18px 0; margin: 0; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proj-meta { display: flex; gap: 12px; padding: 8px 18px 0; flex-wrap: wrap; }
.meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); }
.budget-tag { color: var(--amber); font-weight: 600; }
.proj-phase { display: flex; align-items: center; gap: 8px; padding: 8px 18px 0; }
.phase-tag { font-size: 11px; font-weight: 500; padding: 1px 8px; border-radius: var(--radius-full); }
.days-tag { font-size: 11px; color: var(--text-muted); }
.days-tag.warn { color: var(--rose); font-weight: 600; }
.proj-progress { padding: 8px 18px 0; }
.progress-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
.info-label { font-size: 12px; color: var(--text-muted); }
.progress-pct { font-size: 12px; font-weight: 600; color: var(--primary); }
.proj-footer {
  padding: 10px 18px; border-top: 1px solid var(--border-light); margin-top: 10px;
  display: flex; justify-content: space-between; align-items: center;
}
.footer-stats { display: flex; gap: 14px; }
.f-stat { font-size: 12px; color: var(--text-muted); }
.card-actions { display: flex; gap: 2px; }
.delete-icon:hover { background: var(--rose-bg); color: var(--rose); }

.list-view { border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; }
.proj-table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 900px; }
.proj-table th, .proj-table td { padding: 10px 12px; text-align: center; vertical-align: middle; border-bottom: 1px solid var(--border-light); }
.proj-table thead th { background: var(--bg); font-size: 12px; font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--border); position: sticky; top: 0; }
.proj-table tbody tr { cursor: pointer; transition: background 0.12s; }
.proj-table tbody tr:hover { background: var(--bg-hover); }
.proj-table tbody tr:last-child td { border-bottom: none; }
.col-name { width: 22%; }
.col-status { width: 7%; }
.col-phase { width: 10%; }
.col-deadline { width: 10%; }
.col-manager { width: 7%; }
.col-client { width: 16%; }
.col-budget { width: 8%; }
.col-progress { width: 14%; }
.col-actions { width: 7%; }
.proj-table tbody .col-name { text-align: left; }
.cell-name { font-size: 13px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-empty { color: var(--text-muted); font-size: 12px; }
.mini-progress { display: inline-flex; align-items: center; gap: 6px; }
.mini-pct { font-size: 12px; font-weight: 600; color: var(--primary); min-width: 32px; }

.modal-lg { max-width: 640px; }
.form-field { margin-bottom: 14px; }
.form-field label { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 5px; }
.required { color: var(--rose); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.range-wrap { display: flex; align-items: center; gap: 10px; }
.range { flex: 1; accent-color: var(--primary); }
.range-val { font-size: 13px; font-weight: 600; color: var(--primary); min-width: 36px; }
.input-empty { color: var(--text-muted); font-size: 13px; padding: 6px 12px; background: var(--bg); cursor: default; }
.client-meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.cell-name-sm { font-size: 12px; font-weight: 600; color: var(--text); }
.cell-contact-info { font-size: 11px; color: var(--text-muted); margin-top: 2px; display: flex; flex-direction: column; gap: 1px; text-align: left; }

.phase-section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 16px;
}
.phase-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.12s;
}
.phase-section-header:hover { background: var(--bg-hover); }
.phase-section-title { font-size: 13px; font-weight: 600; color: var(--text); }
.phase-section-toggle { font-size: 12px; color: var(--primary); }
.phase-section-body { padding: 0 16px 16px; }
.phase-add { display: flex; gap: 6px; margin-bottom: 10px; }
.color-input { width: 34px; height: 32px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; padding: 2px; }
.phase-list { display: flex; flex-direction: column; gap: 4px; }
.phase-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg); border-radius: var(--radius-sm); transition: all 0.12s; }
.phase-item:hover { background: var(--bg-hover); }
.phase-item.dragging { opacity: 0.5; }
.phase-grip { cursor: grab; color: var(--text-muted); font-size: 12px; letter-spacing: -2px; }
.phase-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.phase-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--text); }
.phase-order { font-size: 11px; color: var(--text-muted); }
.phase-actions { display: flex; gap: 2px; }
.delete-icon:hover { color: var(--rose); }

@media (max-width: 900px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar-left, .toolbar-right { width: 100%; }
  .search-input { width: 100%; }
  .project-grid { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .list-view { overflow-x: auto; }
  .col-manager, .col-client, .col-budget, .col-actions { display: none; }
  .proj-table { min-width: 600px; }
  .col-name { width: 40%; }
  .col-progress { width: 20%; }
}
</style>
