<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import { storage } from '../utils/storage'
import GanttChart from '../components/GanttChart.vue'
import type { Project, PlanTask } from '../types'

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

const planTasks = ref<PlanTask[]>([])
const showPlanModal = ref(false)
const editingPlan = ref<PlanTask | null>(null)
const planName = ref('')
const planStart = ref('')
const planEnd = ref('')
const planProgress = ref(0)
const planStatus = ref<PlanTask['status']>('pending')

const projectPlanTasks = computed(() =>
  planTasks.value
    .filter(t => t.projectId === project.value?.id)
    .sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate))
)

function loadPlanTasks() {
  planTasks.value = storage.getPlanTasks()
  if (project.value && !planTasks.value.some(t => t.projectId === project.value!.id)) {
    const now = new Date()
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
    const base = project.value.startDate ? new Date(project.value.startDate + 'T00:00:00') : now
    const defaults = [
      { name: '需求调研与分析', offset: 0, span: 20, progress: 100, status: 'completed' as const },
      { name: '方案设计与评审', offset: 15, span: 25, progress: 80, status: 'in_progress' as const },
      { name: '招投标工作', offset: 30, span: 30, progress: 40, status: 'in_progress' as const },
      { name: '项目实施与开发', offset: 50, span: 60, progress: 0, status: 'pending' as const },
      { name: '测试与验收', offset: 100, span: 20, progress: 0, status: 'pending' as const },
      { name: '运维与交付', offset: 115, span: 15, progress: 0, status: 'pending' as const }
    ]
    const autoTasks: PlanTask[] = defaults.map((d, i) => ({
      id: 'plan_auto_' + project.value!.id + '_' + i,
      projectId: project.value!.id,
      name: d.name,
      startDate: fmt(addDays(base, d.offset)),
      endDate: fmt(addDays(base, d.offset + d.span)),
      progress: d.progress,
      status: d.status,
      order: i,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }))
    planTasks.value = [...planTasks.value, ...autoTasks]
    storage.savePlanTasks(planTasks.value)
  }
}

function openAddPlan() {
  editingPlan.value = null
  planName.value = ''
  planStart.value = project.value?.startDate || new Date().toISOString().split('T')[0]
  planEnd.value = project.value?.endDate || ''
  planProgress.value = 0
  planStatus.value = 'pending'
  showPlanModal.value = true
}

function openEditPlan(task: PlanTask) {
  editingPlan.value = task
  planName.value = task.name
  planStart.value = task.startDate
  planEnd.value = task.endDate
  planProgress.value = task.progress
  planStatus.value = task.status
  showPlanModal.value = true
}

function savePlan() {
  if (!planName.value.trim() || !project.value) return
  const now = new Date().toISOString()
  if (editingPlan.value) {
    const idx = planTasks.value.findIndex(t => t.id === editingPlan.value!.id)
    if (idx !== -1) {
      planTasks.value[idx] = {
        ...planTasks.value[idx],
        name: planName.value,
        startDate: planStart.value,
        endDate: planEnd.value,
        progress: planProgress.value,
        status: planStatus.value,
        updatedAt: now
      }
    }
  } else {
    planTasks.value.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      projectId: project.value.id,
      name: planName.value,
      startDate: planStart.value,
      endDate: planEnd.value,
      progress: planProgress.value,
      status: planStatus.value,
      order: projectPlanTasks.value.length,
      createdAt: now,
      updatedAt: now
    })
  }
  storage.savePlanTasks(planTasks.value)
  showPlanModal.value = false
}

function deletePlan(id: string) {
  planTasks.value = planTasks.value.filter(t => t.id !== id)
  storage.savePlanTasks(planTasks.value)
}

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

const planStats = computed(() => {
  const tasks = projectPlanTasks.value
  return {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending').length
  }
})

onMounted(() => {
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  project.value = projectsStore.getProjectById(route.params.id as string) || null
  loadPlanTasks()
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

    <div class="stats-row">
      <div class="mini-stat card">
        <div class="ms-val">{{ planStats.total }}</div>
        <div class="ms-lbl">计划任务</div>
      </div>
      <div class="mini-stat card">
        <div class="ms-val ms-green">{{ planStats.inProgress }}</div>
        <div class="ms-lbl">进行中</div>
      </div>
      <div class="mini-stat card">
        <div class="ms-val ms-blue">{{ planStats.completed }}</div>
        <div class="ms-lbl">已完成</div>
      </div>
      <div class="mini-stat card">
        <div class="ms-val">{{ projectTodos.length }}</div>
        <div class="ms-lbl">关联待办</div>
      </div>
      <div class="mini-stat card">
        <div class="ms-val">{{ projectLogs.length }}</div>
        <div class="ms-lbl">关联日志</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">项目计划 ({{ projectPlanTasks.length }})</span>
        <button class="btn" @click="openAddPlan">+ 添加任务</button>
      </div>
      <div class="plan-body">
        <div class="plan-split">
          <div class="plan-list">
            <div v-if="projectPlanTasks.length === 0" class="card-empty">暂无计划任务</div>
            <div v-for="task in projectPlanTasks" :key="task.id" class="plan-item" @click="openEditPlan(task)">
              <span :class="['plan-dot', task.status]"></span>
              <span class="plan-name">{{ task.name }}</span>
              <span class="plan-date">{{ task.startDate.slice(5) }}~{{ task.endDate.slice(5) }}</span>
              <div class="plan-progress">
                <div class="progress-track"><div class="progress-fill" :style="{ width: task.progress + '%' }"></div></div>
                <span class="plan-pct">{{ task.progress }}%</span>
              </div>
              <button class="btn-icon" @click.stop="deletePlan(task.id)" title="删除">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div class="gantt-section">
            <GanttChart :tasks="projectPlanTasks" />
          </div>
        </div>
      </div>
    </div>

    <div class="card phase-card">
      <div class="card-header">
        <span class="card-title">项目阶段</span>
        <div class="phase-header-info">
          <span class="info-pill">
            <span class="info-label">阶段</span>
            <span class="phase-tag" :style="{ color: getPhaseColor(project.currentPhaseId), background: getPhaseColor(project.currentPhaseId) + '18' }">
              {{ getPhaseName(project.currentPhaseId) }}
            </span>
          </span>
          <span class="info-pill">
            <span class="info-label">进度</span>
            <span class="info-val">{{ project.progress }}%</span>
            <span class="inline-progress"><span class="progress-fill" :style="{ width: project.progress + '%' }"></span></span>
          </span>
          <span class="info-pill">
            <span class="info-label">时间</span>
            <span class="info-val">{{ project.startDate }} ~ {{ project.endDate || '待定' }}</span>
          </span>
          <button class="btn btn-sm" @click="openPhaseChange">切换阶段</button>
        </div>
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
      <div v-if="project.phaseHistory?.length" class="history-row">
        <div v-for="(record, i) in project.phaseHistory" :key="i" class="history-chip">
          <span class="chip-dot" :style="{ background: getPhaseColor(record.phaseId) }"></span>
          <span class="chip-name">{{ getPhaseName(record.phaseId) }}</span>
          <span class="chip-date">{{ record.startDate.slice(5) }}{{ record.endDate ? '~' + record.endDate.slice(5) : '→' }}</span>
          <span v-if="record.note" class="chip-note">{{ record.note }}</span>
        </div>
      </div>
    </div>

    <div class="detail-bottom">
      <div class="card bottom-panel">
        <div class="card-header">
          <span class="card-title">关联待办 ({{ projectTodos.length }})</span>
        </div>
        <div class="panel-body">
          <div v-if="projectTodos.length === 0" class="card-empty">暂无关联待办</div>
          <div v-for="t in projectTodos" :key="t.id" class="list-row" style="cursor: default">
            <span :class="['dot', t.priority === 'high' ? 'dot-rose' : t.priority === 'medium' ? 'dot-amber' : 'dot-muted']"></span>
            <span :class="['todo-text', { done: t.status === 'completed' }]">{{ t.title }}</span>
            <span class="todo-date">{{ t.dueDate }}</span>
          </div>
        </div>
      </div>
      <div class="card bottom-panel">
        <div class="card-header">
          <span class="card-title">关联日志 ({{ projectLogs.length }})</span>
        </div>
        <div class="panel-body">
          <div v-if="projectLogs.length === 0" class="card-empty">暂无关联日志</div>
          <div v-for="log in projectLogs" :key="log.id" class="list-row log-row" style="cursor: default">
            <span class="log-date">{{ log.date }}</span>
            <span class="log-content">{{ log.content }}</span>
          </div>
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

    <div v-if="showPlanModal" class="modal-mask" @click.self="showPlanModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingPlan ? '编辑计划任务' : '添加计划任务' }}</h3>
          <button class="btn-icon" @click="showPlanModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>任务名称 <span style="color:var(--rose)">*</span></label>
            <input v-model="planName" placeholder="请输入任务名称" class="input" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-field">
              <label>开始日期</label>
              <input v-model="planStart" type="date" class="input" />
            </div>
            <div class="form-field">
              <label>结束日期</label>
              <input v-model="planEnd" type="date" class="input" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-field">
              <label>状态</label>
              <select v-model="planStatus" class="input">
                <option value="pending">待开始</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
              </select>
            </div>
            <div class="form-field">
              <label>进度 ({{ planProgress }}%)</label>
              <input v-model.number="planProgress" type="range" min="0" max="100" style="accent-color:var(--primary);width:100%" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showPlanModal = false">取消</button>
          <button class="btn btn-primary" @click="savePlan">保存</button>
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

.stats-row { display: flex; gap: 12px; margin-bottom: 16px; align-items: stretch; }
.mini-stat { flex: 1; text-align: center; padding: 14px 10px; display: flex; flex-direction: column; justify-content: center; margin-bottom: 0 !important; }
.ms-val { font-size: 22px; font-weight: 700; color: var(--text); line-height: 1; }
.ms-val.ms-green { color: #22c55e; }
.ms-val.ms-blue { color: #3b82f6; }
.ms-lbl { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

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

.phase-card .card-header { flex-wrap: wrap; gap: 8px; padding: 10px 14px; }
.phase-header-info { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.info-pill { display: inline-flex; align-items: center; gap: 5px; }
.info-label { font-size: 11px; color: var(--text-muted); }
.info-val { font-size: 12px; font-weight: 600; color: var(--text); }
.inline-progress { display: inline-block; width: 50px; height: 4px; background: var(--border-light); border-radius: 2px; overflow: hidden; vertical-align: middle; }
.inline-progress .progress-fill { height: 100%; background: var(--primary); border-radius: 2px; }
.phase-tag {
  font-size: 11px; font-weight: 500; padding: 1px 7px;
  border-radius: var(--radius-full); display: inline-block;
}
.history-row {
  display: flex; flex-wrap: wrap; gap: 5px; padding: 6px 14px;
  border-top: 1px solid var(--border-light);
}
.history-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border: 1px solid var(--border-light);
  border-radius: var(--radius-full); font-size: 10.5px; background: var(--bg-card);
}
.chip-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.chip-name { font-weight: 500; color: var(--text); }
.chip-date { color: var(--text-muted); }
.chip-note { color: var(--text-secondary); font-style: italic; }

.card-body .list-row { padding: 5px 16px; gap: 8px; }
.todo-text { flex: 1; font-size: 12.5px; color: var(--text); }
.todo-text.done { text-decoration: line-through; color: var(--text-muted); }
.todo-date { font-size: 11px; color: var(--text-muted); }

.log-row { flex-direction: column; align-items: flex-start; gap: 1px; }
.log-date { font-size: 11px; color: var(--text-muted); }
.log-content { font-size: 12.5px; color: var(--text-secondary); }

.detail-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: stretch; }
.bottom-panel { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.panel-body { flex: 1; min-height: 0; max-height: 240px; overflow-y: auto; }

.plan-body { padding: 12px 16px; }
.plan-split { display: grid; grid-template-columns: 340px 1fr; gap: 14px; }
.plan-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.plan-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  border: 1px solid var(--border-light); border-radius: var(--radius-sm);
  cursor: pointer; transition: all 0.12s; font-size: 13px;
}
.plan-item:hover { border-color: var(--primary); box-shadow: var(--shadow-xs); }
.plan-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.plan-dot.pending { background: #94a3b8; }
.plan-dot.in_progress { background: #22c55e; }
.plan-dot.completed { background: #3b82f6; }
.plan-name { flex: 1; font-size: 12.5px; color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.plan-date { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.plan-progress { display: flex; align-items: center; gap: 4px; width: 90px; flex-shrink: 0; }
.plan-pct { font-size: 11px; font-weight: 600; color: var(--primary); min-width: 28px; }
.gantt-section { min-width: 0; overflow: hidden; }

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
