<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import type { Project } from '../types'

const router = useRouter()
const projectsStore = useProjectsStore()

const showModal = ref(false)
const editingProject = ref<Project | null>(null)
const formName = ref('')
const formDesc = ref('')
const formProgress = ref(0)
const formStatus = ref<Project['status']>('planning')
const formPhaseId = ref('')
const formStartDate = ref('')
const formEndDate = ref('')

const statusOptions = [
  { label: '规划中', value: 'planning' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已暂停', value: 'paused' }
]

const statusText: Record<string, string> = {
  planning: '规划中',
  in_progress: '进行中',
  completed: '已完成',
  paused: '已暂停'
}

const statusColor: Record<string, string> = {
  planning: '#6366f1',
  in_progress: '#22c55e',
  completed: '#0ea5e9',
  paused: '#a3a3a3'
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

function openAdd() {
  editingProject.value = null
  formName.value = ''
  formDesc.value = ''
  formProgress.value = 0
  formStatus.value = 'planning'
  formPhaseId.value = sortedPhases.value[0]?.id || ''
  formStartDate.value = new Date().toISOString().split('T')[0]
  formEndDate.value = ''
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
      endDate: formEndDate.value
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
      endDate: formEndDate.value
    })
  }
  showModal.value = false
}

function remove(id: string) {
  if (confirm('确定要删除这个项目吗？')) {
    projectsStore.deleteProject(id)
  }
}

onMounted(() => {
  projectsStore.loadProjects()
  projectsStore.loadPhases()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">项目管理</h1>
        <p class="page-subtitle">管理信息化集成项目全生命周期</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新建项目
      </button>
    </div>

    <div v-if="projectsStore.projects.length === 0" class="card">
      <div class="card-empty">暂无项目，点击「新建项目」开始</div>
    </div>

    <div v-else class="project-grid">
      <div
        v-for="p in projectsStore.projects"
        :key="p.id"
        class="card project-card"
      >
        <div class="card-top" @click="router.push(`/projects/${p.id}`)">
          <h3 class="card-title">{{ p.name }}</h3>
          <span
            class="badge"
            :class="{
              'badge-amber': p.status === 'planning',
              'badge-green': p.status === 'in_progress',
              'badge-blue': p.status === 'completed',
              'badge-amber': p.status === 'paused'
            }"
          >{{ statusText[p.status] }}</span>
        </div>

        <div class="card-info">
          <span class="info-label">当前阶段</span>
          <span class="phase-tag" :style="{ color: getPhaseColor(p.currentPhaseId), background: getPhaseColor(p.currentPhaseId) + '18' }">
            {{ getPhaseName(p.currentPhaseId) }}
          </span>
        </div>

        <div class="card-info">
          <div class="progress-row">
            <span class="info-label">进度</span>
            <span class="progress-pct">{{ p.progress }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: p.progress + '%' }"></div>
          </div>
        </div>

        <div class="card-bottom">
          <span class="date-text">{{ p.startDate }} ~ {{ p.endDate || '待定' }}</span>
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

    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal">
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
          <div class="form-field">
            <label>项目进度</label>
            <div class="range-wrap">
              <input type="range" v-model.number="formProgress" min="0" max="100" class="range" />
              <span class="range-val">{{ formProgress }}%</span>
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
  </div>
</template>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.project-card:hover {
  box-shadow: var(--shadow-sm);
}

.card-top {
  padding: 14px 18px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.card-info {
  padding: 6px 18px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-info:has(.progress-row) {
  flex-direction: column;
  align-items: stretch;
}

.info-label {
  font-size: 12px;
  color: var(--text-muted);
}

.progress-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.progress-pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

.phase-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: var(--radius-full);
}

.card-bottom {
  padding: 8px 18px;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date-text {
  font-size: 12px;
  color: var(--text-muted);
}

.card-actions {
  display: flex;
  gap: 2px;
}

.delete-icon:hover {
  background: var(--rose-bg);
  color: var(--rose);
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

.range-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.range {
  flex: 1;
  accent-color: var(--primary);
}

.range-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  min-width: 36px;
}
</style>
