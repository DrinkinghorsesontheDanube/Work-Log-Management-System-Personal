<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import type { Project } from '../types'

const route = useRoute()
const router = useRouter()
const projectsStore = useProjectsStore()
const todosStore = useTodosStore()
const workLogsStore = useWorkLogsStore()

const project = ref<Project | null>(null)
const showPhaseModal = ref(false)
const newPhaseId = ref('')
const phaseNote = ref('')

const sortedPhases = computed(() =>
  [...projectsStore.phases].sort((a, b) => a.order - b.order)
)

const projectTodos = computed(() =>
  project.value ? todosStore.getTodosByProjectId(project.value.id) : []
)

const projectLogs = computed(() =>
  project.value ? workLogsStore.getWorkLogsByProjectId(project.value.id) : []
)

function getPhaseName(id: string) {
  return projectsStore.phases.find(p => p.id === id)?.name || id
}

function getPhaseColor(id: string) {
  return projectsStore.phases.find(p => p.id === id)?.color || '#6366f1'
}

const statusText: Record<string, string> = {
  planning: '规划中', in_progress: '进行中', completed: '已完成', paused: '已暂停'
}

function openPhaseChange() {
  if (!project.value) return
  newPhaseId.value = project.value.currentPhaseId
  phaseNote.value = ''
  showPhaseModal.value = true
}

function confirmPhaseChange() {
  if (!project.value || !newPhaseId.value) return
  projectsStore.changePhase(project.value.id, newPhaseId.value, phaseNote.value)
  project.value = projectsStore.getProjectById(project.value.id) || null
  showPhaseModal.value = false
}

const currentPhaseIndex = computed(() => {
  if (!project.value) return -1
  return sortedPhases.value.findIndex(p => p.id === project.value!.currentPhaseId)
})

onMounted(() => {
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  project.value = projectsStore.getProjectById(route.params.id as string) || null
})
</script>

<template>
  <div class="page" v-if="project">
    <div class="page-header">
      <div>
        <button class="btn btn-ghost" style="margin-bottom: 6px" @click="router.push('/projects')">&larr; 返回</button>
        <h1 class="page-title">{{ project.name }}</h1>
        <p class="page-subtitle">{{ project.description || '暂无描述' }}</p>
      </div>
      <span
        class="badge"
        :class="{
          'badge-amber': project.status === 'planning',
          'badge-green': project.status === 'in_progress',
          'badge-blue': project.status === 'completed',
          'badge-amber': project.status === 'paused'
        }"
      >{{ statusText[project.status] }}</span>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">项目阶段</span>
        <button class="btn" @click="openPhaseChange">切换阶段</button>
      </div>
      <div class="phase-timeline">
        <div
          v-for="(phase, i) in sortedPhases"
          :key="phase.id"
          :class="['phase-node', { active: phase.id === project.currentPhaseId, done: i < currentPhaseIndex }]"
        >
          <div class="node-dot" :style="{ background: i <= currentPhaseIndex ? phase.color : undefined }"></div>
          <span class="node-label">{{ phase.name }}</span>
        </div>
      </div>
    </div>

    <div class="card info-card">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">当前阶段</span>
          <span class="phase-tag" :style="{ color: getPhaseColor(project.currentPhaseId), background: getPhaseColor(project.currentPhaseId) + '18' }">
            {{ getPhaseName(project.currentPhaseId) }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">进度</span>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill" :style="{ width: project.progress + '%' }"></div></div>
            <span class="progress-pct">{{ project.progress }}%</span>
          </div>
        </div>
        <div class="info-item">
          <span class="info-label">时间</span>
          <span class="info-value">{{ project.startDate }} ~ {{ project.endDate || '待定' }}</span>
        </div>
      </div>
    </div>

    <div class="card" v-if="project.phaseHistory?.length">
      <div class="card-header">
        <span class="card-title">阶段记录</span>
      </div>
      <div class="card-body">
        <div v-for="(record, i) in project.phaseHistory" :key="i" class="history-item">
          <span class="dot" :style="{ background: getPhaseColor(record.phaseId), width: '8px', height: '8px', marginTop: '5px' }"></span>
          <div class="history-info">
            <span class="history-name">{{ getPhaseName(record.phaseId) }}</span>
            <span class="history-date">{{ record.startDate }} {{ record.endDate ? '~ ' + record.endDate : '(当前)' }}</span>
            <span v-if="record.note" class="history-note">{{ record.note }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">关联待办 ({{ projectTodos.length }})</span>
      </div>
      <div class="card-body">
        <div v-if="projectTodos.length === 0" class="card-empty">暂无关联待办</div>
        <div v-for="t in projectTodos" :key="t.id" class="list-row" style="cursor: default">
          <span :class="['dot', t.priority === 'high' ? 'dot-rose' : t.priority === 'medium' ? 'dot-amber' : 'dot-muted']"></span>
          <span :class="['todo-text', { done: t.status === 'completed' }]">{{ t.title }}</span>
          <span class="todo-date">{{ t.dueDate }}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">关联日志 ({{ projectLogs.length }})</span>
      </div>
      <div class="card-body">
        <div v-if="projectLogs.length === 0" class="card-empty">暂无关联日志</div>
        <div v-for="log in projectLogs" :key="log.id" class="list-row log-row" style="cursor: default">
          <span class="log-date">{{ log.date }}</span>
          <span class="log-content">{{ log.content }}</span>
        </div>
      </div>
    </div>

    <div v-if="showPhaseModal" class="modal-mask" @click.self="showPhaseModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>切换项目阶段</h3>
          <button class="btn-icon" @click="showPhaseModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>目标阶段</label>
            <select v-model="newPhaseId" class="input">
              <option v-for="ph in sortedPhases" :key="ph.id" :value="ph.id">{{ ph.name }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>备注</label>
            <textarea v-model="phaseNote" placeholder="阶段变更说明（可选）" class="input" rows="3"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showPhaseModal = false">取消</button>
          <button class="btn btn-primary" @click="confirmPhaseChange">确认切换</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="page">
    <div class="card">
      <div class="card-empty">
        <p style="margin-bottom: 14px">项目不存在</p>
        <button class="btn" @click="router.push('/projects')">返回项目列表</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card { margin-bottom: 16px; }
.card:last-of-type { margin-bottom: 0; }

.phase-timeline {
  display: flex;
  gap: 3px;
  overflow-x: auto;
  padding: 16px 18px;
}
.phase-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 56px;
}
.node-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--border);
  transition: all 0.2s;
}
.phase-node.done .node-dot { transform: scale(0.9); }
.phase-node.active .node-dot {
  transform: scale(1.15);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
}
.node-label {
  font-size: 10.5px;
  color: var(--text-muted);
  text-align: center;
  white-space: nowrap;
}
.phase-node.active .node-label {
  color: var(--primary);
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border-light);
}
.info-item {
  background: var(--bg-card);
  padding: 14px 18px;
}
.info-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.info-value {
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
}
.phase-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 9px;
  border-radius: var(--radius-full);
  display: inline-block;
}
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-pct {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  min-width: 36px;
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-light);
}
.history-item:last-child { border-bottom: none; }
.history-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.history-name { font-size: 13px; font-weight: 500; color: var(--text); }
.history-date { font-size: 12px; color: var(--text-muted); }
.history-note { font-size: 12px; color: var(--text-secondary); }

.todo-text { flex: 1; font-size: 13px; color: var(--text); }
.todo-text.done { text-decoration: line-through; color: var(--text-muted); }
.todo-date { font-size: 12px; color: var(--text-muted); }

.log-row { flex-direction: column; align-items: flex-start; gap: 3px; }
.log-date { font-size: 12px; color: var(--text-muted); }
.log-content { font-size: 13px; color: var(--text-secondary); }

.form-field { margin-bottom: 14px; }
.form-field:last-child { margin-bottom: 0; }
.form-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 5px;
}
</style>
