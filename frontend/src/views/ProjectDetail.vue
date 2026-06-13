<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import { storage } from '../utils/storage'
import { chatWithAI, isAiConfigured } from '../services/aiService'
import { addWorkingDays, calcWorkingDays } from '../utils/workdays'
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
const planParentId = ref<string | null>(null)
const planActualStart = ref<string | null>(null)
const planActualEnd = ref<string | null>(null)
const planDuration = ref<number>(0)
const planIncludeHolidays = ref(false)
const aiGenerating = ref(false)
const aiPreviewTasks = ref<PlanTask[]>([])
const showAiPreview = ref(false)

const projectPlanTasks = computed(() => {
  const all = planTasks.value.filter(t => t.projectId === project.value?.id)
  const parents = all.filter(t => t.parentId === null).sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate))
  const result: PlanTask[] = []
  for (const p of parents) {
    result.push(p)
    const children = all.filter(t => t.parentId === p.id).sort((a, b) => a.order - b.order || a.startDate.localeCompare(b.startDate))
    result.push(...children)
  }
  return result
})

const parentTasks = computed(() =>
  projectPlanTasks.value.filter(t => t.parentId === null)
)

const planLinkedTodos = computed(() => {
  const map: Record<string, typeof projectTodos.value> = {}
  for (const todo of projectTodos.value) {
    if (todo.planTaskId) {
      if (!map[todo.planTaskId]) map[todo.planTaskId] = []
      map[todo.planTaskId].push(todo)
    }
  }
  return map
})

function getTaskTodoCount(taskId: string) {
  return (planLinkedTodos.value[taskId] || []).length
}

function getTaskTodoDone(taskId: string) {
  return (planLinkedTodos.value[taskId] || []).filter(t => t.status === 'completed').length
}

const editingPlanLinkedTodos = computed(() => {
  if (!editingPlan.value) return []
  return planLinkedTodos.value[editingPlan.value.id] || []
})

const editingHasChildren = computed(() => {
  if (!editingPlan.value) return false
  return planTasks.value.some(t => t.parentId === editingPlan.value!.id)
})

const newLinkedTodoTitle = ref('')

function addLinkedTodo() {
  if (!newLinkedTodoTitle.value.trim() || !editingPlan.value || !project.value) return
  const now = new Date().toISOString()
  todosStore.addTodo({
    title: newLinkedTodoTitle.value.trim(),
    description: '',
    status: 'pending',
    priority: 'medium',
    dueDate: editingPlan.value.endDate,
    projectId: project.value.id,
    planTaskId: editingPlan.value.id
  })
  newLinkedTodoTitle.value = ''
}

function unlinkTodo(todoId: string) {
  todosStore.updateTodo(todoId, { planTaskId: null } as any)
}

function syncProgressFromTodos(taskId: string) {
  const todos = planLinkedTodos.value[taskId] || []
  if (todos.length === 0) return
  const done = todos.filter(t => t.status === 'completed').length
  const progress = Math.round((done / todos.length) * 100)
  const idx = planTasks.value.findIndex(t => t.id === taskId)
  if (idx !== -1) {
    let status: PlanTask['status'] = 'pending'
    if (progress === 100) status = 'completed'
    else if (progress > 0) status = 'in_progress'
    planTasks.value[idx] = { ...planTasks.value[idx], progress, status, updatedAt: new Date().toISOString() }
    storage.savePlanTasks(planTasks.value)
  }
}

function daysUntil(endDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate + 'T00:00:00')
  return Math.ceil((end.getTime() - today.getTime()) / 86400000)
}

function getTaskDeadlineLevel(task: PlanTask): 'normal' | 'warning' | 'urgent' | 'overdue' {
  if (task.status === 'completed') return 'normal'
  const days = daysUntil(task.endDate)
  if (days < 0) return 'overdue'
  if (days <= 3) return 'urgent'
  if (days <= 7) return 'warning'
  return 'normal'
}

function getTaskCountdown(task: PlanTask): string {
  if (task.status === 'completed') return '已完成'
  const days = daysUntil(task.endDate)
  if (days < 0) return `逾期${Math.abs(days)}天`
  if (days === 0) return '今天截止'
  if (days === 1) return '明天截止'
  return `还剩${days}天`
}

const deadlineWarnings = computed(() => {
  return projectPlanTasks.value
    .filter(t => t.status !== 'completed' && daysUntil(t.endDate) <= 3)
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
})

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
      parentId: null,
      name: d.name,
      startDate: fmt(addDays(base, d.offset)),
      endDate: fmt(addDays(base, d.offset + d.span)),
      duration: d.span,
      includeHolidays: false,
      actualStartDate: null,
      actualEndDate: null,
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

function openAddPlan(parentId: string | null = null) {
  editingPlan.value = null
  planName.value = ''
  planParentId.value = parentId
  if (parentId) {
    const parent = planTasks.value.find(t => t.id === parentId)
    planStart.value = parent?.startDate || project.value?.startDate || ''
    planEnd.value = parent?.endDate || project.value?.endDate || ''
  } else {
    planStart.value = project.value?.startDate || ''
    planEnd.value = project.value?.endDate || ''
  }
  planProgress.value = 0
  planStatus.value = 'pending'
  planActualStart.value = null
  planActualEnd.value = null
  planDuration.value = 0
  planIncludeHolidays.value = false
  showPlanModal.value = true
}

function openEditPlan(task: PlanTask) {
  editingPlan.value = task
  planName.value = task.name
  planStart.value = task.startDate
  planEnd.value = task.endDate
  planProgress.value = task.progress
  planStatus.value = task.status
  planParentId.value = task.parentId
  planActualStart.value = task.actualStartDate
  planActualEnd.value = task.actualEndDate
  planDuration.value = task.duration || calcWorkingDays(task.startDate, task.endDate, task.includeHolidays)
  planIncludeHolidays.value = task.includeHolidays || false
  showPlanModal.value = true
}

function savePlan() {
  if (!planName.value.trim() || !project.value) return
  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const autoProgress = planStatus.value === 'completed' ? 100 : planProgress.value

  let actualStart = planActualStart.value || editingPlan.value?.actualStartDate || null
  let actualEnd = planActualEnd.value || editingPlan.value?.actualEndDate || null
  if (planStatus.value === 'in_progress' && !actualStart) actualStart = today
  if (planStatus.value === 'completed') {
    if (!actualStart) actualStart = today
    if (!actualEnd) actualEnd = today
  }

  if (editingPlan.value) {
    const idx = planTasks.value.findIndex(t => t.id === editingPlan.value!.id)
    if (idx !== -1) {
      planTasks.value[idx] = {
        ...planTasks.value[idx],
        name: planName.value,
        startDate: planStart.value,
        endDate: planEnd.value,
        duration: planDuration.value,
        includeHolidays: planIncludeHolidays.value,
        actualStartDate: actualStart,
        actualEndDate: actualEnd,
        progress: autoProgress,
        status: planStatus.value,
        parentId: planParentId.value,
        updatedAt: now
      }
    }
  } else {
    planTasks.value.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      projectId: project.value.id,
      parentId: planParentId.value,
      name: planName.value,
      startDate: planStart.value,
      endDate: planEnd.value,
      duration: planDuration.value,
      includeHolidays: planIncludeHolidays.value,
      actualStartDate: actualStart,
      actualEndDate: actualEnd,
      progress: autoProgress,
      status: planStatus.value,
      order: projectPlanTasks.value.length,
      createdAt: now,
      updatedAt: now
    })
  }
  recalcParentProgress(editingPlan.value?.parentId || planParentId.value)
  storage.savePlanTasks(planTasks.value)
  showPlanModal.value = false
}

function recalcParentProgress(parentId: string | null | undefined) {
  if (!parentId) return
  const children = planTasks.value.filter(t => t.parentId === parentId)
  if (children.length === 0) return
  const avgProgress = Math.round(children.reduce((sum, c) => sum + c.progress, 0) / children.length)
  const idx = planTasks.value.findIndex(t => t.id === parentId)
  if (idx !== -1) {
    let status: PlanTask['status'] = 'pending'
    if (avgProgress === 100) status = 'completed'
    else if (avgProgress > 0) status = 'in_progress'
    planTasks.value[idx] = { ...planTasks.value[idx], progress: avgProgress, status, updatedAt: new Date().toISOString() }
  }
}

function onStartDateChange() {
  if (planDuration.value > 0 && planStart.value) {
    planEnd.value = addWorkingDays(planStart.value, planDuration.value, planIncludeHolidays.value)
  }
}

function onDurationChange() {
  if (planDuration.value > 0 && planStart.value) {
    planEnd.value = addWorkingDays(planStart.value, planDuration.value, planIncludeHolidays.value)
  }
}

function onEndDateChange() {
  if (planStart.value && planEnd.value && planEnd.value >= planStart.value) {
    planDuration.value = calcWorkingDays(planStart.value, planEnd.value, planIncludeHolidays.value)
  }
}

function onIncludeHolidaysChange() {
  if (planDuration.value > 0 && planStart.value) {
    planEnd.value = addWorkingDays(planStart.value, planDuration.value, planIncludeHolidays.value)
  }
}

function deletePlan(id: string) {
  planTasks.value = planTasks.value.filter(t => t.id !== id && t.parentId !== id)
  storage.savePlanTasks(planTasks.value)
}

async function aiGeneratePlan() {
  if (!project.value || !isAiConfigured()) { alert('请先在设置中配置 AI'); return }
  aiGenerating.value = true
  try {
    const prompt = `请为以下信息化项目生成项目计划任务清单，要求：
1. 返回 JSON 数组格式，每个元素包含 name(任务名称)、startDate(开始日期YYYY-MM-DD)、endDate(结束日期YYYY-MM-DD)、children(子任务数组，同样结构，可选)
2. 项目开始日期：${project.value.startDate}，结束日期：${project.value.endDate || '待定'}
3. 生成6-10个主任务，每个主任务下2-4个子任务
4. 任务时间要合理分配，有先后顺序和部分重叠
5. 只返回JSON，不要其他内容

项目名称：${project.value.name}
项目描述：${project.value.description}`
    const resp = await chatWithAI([{ role: 'user', content: prompt }])
    const jsonMatch = resp.match(/\[[\s\S]*\]/)
    if (!jsonMatch) { alert('AI 返回格式异常，请重试'); return }
    const tasks = JSON.parse(jsonMatch[0])
    const now = new Date().toISOString()
    let order = projectPlanTasks.value.length
    const preview: PlanTask[] = []
    for (const t of tasks) {
      const pid = 'plan_ai_' + Date.now().toString(36) + '_' + (order++)
      preview.push({
        id: pid, projectId: project.value.id, parentId: null,
        name: t.name, startDate: t.startDate, endDate: t.endDate,
        duration: calcWorkingDays(t.startDate, t.endDate, false),
        includeHolidays: false,
        actualStartDate: null, actualEndDate: null,
        progress: 0, status: 'pending', order: order++, createdAt: now, updatedAt: now
      })
      if (t.children?.length) {
        for (const c of t.children) {
          preview.push({
            id: 'plan_ai_' + Date.now().toString(36) + '_' + (order++),
            projectId: project.value.id, parentId: pid,
            name: c.name, startDate: c.startDate, endDate: c.endDate,
            duration: calcWorkingDays(c.startDate, c.endDate, false),
            includeHolidays: false,
            actualStartDate: null, actualEndDate: null,
            progress: 0, status: 'pending', order: order++, createdAt: now, updatedAt: now
          })
        }
      }
    }
    aiPreviewTasks.value = preview
    showAiPreview.value = true
  } catch (e: any) {
    alert('AI 生成失败：' + (e.message || '未知错误'))
  } finally {
    aiGenerating.value = false
  }
}

function confirmAiPlan() {
  planTasks.value = [...planTasks.value, ...aiPreviewTasks.value]
  storage.savePlanTasks(planTasks.value)
  showAiPreview.value = false
  aiPreviewTasks.value = []
}

function cancelAiPlan() {
  showAiPreview.value = false
  aiPreviewTasks.value = []
}

function removeAiPreviewTask(id: string) {
  aiPreviewTasks.value = aiPreviewTasks.value.filter(t => t.id !== id && t.parentId !== id)
}

function importCSV(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !project.value) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) { alert('文件为空或格式不对'); return }
    const now = new Date().toISOString()
    const newTasks: PlanTask[] = []
    let order = projectPlanTasks.value.length
    const parentMap: Record<string, string> = {}
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 3) continue
      const [name, start, end, parentName, statusStr] = cols
      const id = 'plan_csv_' + Date.now().toString(36) + '_' + i
      let parentId: string | null = null
      if (parentName && parentMap[parentName]) {
        parentId = parentMap[parentName]
      }
      let status: PlanTask['status'] = 'pending'
      if (statusStr === '已完成' || statusStr === 'completed') status = 'completed'
      else if (statusStr === '进行中' || statusStr === 'in_progress') status = 'in_progress'
      newTasks.push({
        id, projectId: project.value!.id, parentId,
        name, startDate: start, endDate: end,
        duration: calcWorkingDays(start, end, false),
        includeHolidays: false,
        actualStartDate: null, actualEndDate: null,
        progress: status === 'completed' ? 100 : 0,
        status, order: order++, createdAt: now, updatedAt: now
      })
      if (!parentName) parentMap[name] = id
    }
    planTasks.value = [...planTasks.value, ...newTasks]
    storage.savePlanTasks(planTasks.value)
    alert(`成功导入 ${newTasks.length} 条任务`)
  }
  reader.readAsText(file)
}

function exportCSV() {
  if (!project.value) return
  const rows = ['任务名称,开始日期,结束日期,父任务,状态']
  for (const t of projectPlanTasks.value) {
    const parent = t.parentId ? planTasks.value.find(p => p.id === t.parentId)?.name || '' : ''
    const statusMap = { pending: '待开始', in_progress: '进行中', completed: '已完成' }
    rows.push(`"${t.name}",${t.startDate},${t.endDate},"${parent}",${statusMap[t.status]}`)
  }
  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${project.value.name}_项目计划.csv`; a.click()
  URL.revokeObjectURL(url)
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
        <div class="plan-toolbar">
          <button class="btn btn-sm" @click="openAddPlan()">+ 添加</button>
          <button class="btn btn-sm" @click="aiGeneratePlan" :disabled="aiGenerating">{{ aiGenerating ? 'AI 生成中...' : 'AI 生成' }}</button>
          <label class="btn btn-sm import-btn">导入CSV<input type="file" accept=".csv" @change="importCSV" hidden /></label>
          <button class="btn btn-sm" @click="exportCSV">导出CSV</button>
        </div>
      </div>
      <div v-if="deadlineWarnings.length > 0" class="deadline-banner">
        <span class="deadline-icon">⚠</span>
        <span v-for="(w, i) in deadlineWarnings" :key="w.id" class="deadline-tag" :class="getTaskDeadlineLevel(w)">
          {{ w.name }} · {{ getTaskCountdown(w) }}<span v-if="i < deadlineWarnings.length - 1">，</span>
        </span>
      </div>
      <div class="plan-body">
        <div class="plan-split">
          <div class="plan-list">
            <div v-if="projectPlanTasks.length === 0" class="card-empty">暂无计划任务</div>
            <template v-for="task in projectPlanTasks" :key="task.id">
              <div :class="['plan-item', { 'is-child': task.parentId !== null }]" @click="openEditPlan(task)">
                <span :class="['plan-dot', task.status]"></span>
                <span class="plan-name">{{ task.name }}</span>
                <span v-if="getTaskTodoCount(task.id) > 0" class="plan-todo-badge" :title="getTaskTodoDone(task.id) + '/' + getTaskTodoCount(task.id) + ' 待办完成'">
                  {{ getTaskTodoDone(task.id) }}/{{ getTaskTodoCount(task.id) }}
                </span>
                <span class="plan-date">{{ task.startDate.slice(5) }}~{{ task.endDate.slice(5) }}</span>
                <div class="plan-progress">
                  <div class="progress-track"><div class="progress-fill" :style="{ width: task.progress + '%' }"></div></div>
                  <span class="plan-pct">{{ task.progress }}%</span>
                </div>
                <span :class="['plan-countdown', getTaskDeadlineLevel(task)]">{{ getTaskCountdown(task) }}</span>
                <button v-if="task.parentId === null" class="btn-icon" @click.stop="openAddPlan(task.id)" title="添加子任务">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="btn-icon" @click.stop="deletePlan(task.id)" title="删除">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </template>
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
            <span v-if="t.planTaskId" class="todo-task-tag">{{ projectPlanTasks.find(pt => pt.id === t.planTaskId)?.name || '任务' }}</span>
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
      <div class="modal modal-wide">
        <div class="modal-header">
          <h3>{{ editingPlan ? '编辑计划任务' : '添加计划任务' }}</h3>
          <button class="btn-icon" @click="showPlanModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>父任务</label>
            <select v-model="planParentId" class="input">
              <option :value="null">无（顶级任务）</option>
              <option v-for="pt in parentTasks" :key="pt.id" :value="pt.id">{{ pt.name }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>任务名称 <span style="color:var(--rose)">*</span></label>
            <input v-model="planName" placeholder="请输入任务名称" class="input" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="form-field">
              <label>计划开始</label>
              <input v-model="planStart" type="date" class="input" @change="onStartDateChange" />
            </div>
            <div class="form-field">
              <label>工期（工作日）</label>
              <input v-model.number="planDuration" type="number" min="1" class="input" @change="onDurationChange" />
            </div>
            <div class="form-field">
              <label>计划结束 <span style="font-size:10px;color:var(--text-muted)">自动计算</span></label>
              <input v-model="planEnd" type="date" class="input" @change="onEndDateChange" />
            </div>
          </div>
          <div class="form-field" style="margin-bottom:10px">
            <label class="checkbox-label">
              <input type="checkbox" v-model="planIncludeHolidays" @change="onIncludeHolidaysChange" />
              <span>工期包含周末/节假日</span>
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-field">
              <label>实际开始</label>
              <input v-model="planActualStart" type="date" class="input" />
            </div>
            <div class="form-field">
              <label>实际结束</label>
              <input v-model="planActualEnd" type="date" class="input" />
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
              <label>进度 ({{ planProgress }}%)<span v-if="editingHasChildren" style="font-size:11px;color:var(--text-muted);margin-left:4px">· 由子任务自动计算</span></label>
              <input v-model.number="planProgress" type="range" min="0" max="100" :disabled="editingHasChildren" style="accent-color:var(--primary);width:100%" />
            </div>
          </div>
          <div v-if="editingPlan" class="linked-todos-section">
            <div class="linked-header">
              <span class="linked-title">关联待办 ({{ editingPlanLinkedTodos.length }})</span>
              <button v-if="editingPlanLinkedTodos.length > 0" class="btn btn-sm" @click="syncProgressFromTodos(editingPlan!.id)">同步进度</button>
            </div>
            <div class="linked-list">
              <div v-for="lt in editingPlanLinkedTodos" :key="lt.id" class="linked-item">
                <span :class="['dot', lt.status === 'completed' ? 'dot-muted' : 'dot-amber']"></span>
                <span :class="['linked-name', { done: lt.status === 'completed' }]">{{ lt.title }}</span>
                <button class="btn-icon" @click="unlinkTodo(lt.id)" title="取消关联">&times;</button>
              </div>
              <div v-if="editingPlanLinkedTodos.length === 0" class="linked-empty">暂无关联待办</div>
            </div>
            <div class="linked-add">
              <input v-model="newLinkedTodoTitle" class="input" placeholder="快速添加待办..." @keyup.enter="addLinkedTodo" />
              <button class="btn btn-sm btn-primary" @click="addLinkedTodo">添加</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showPlanModal = false">取消</button>
          <button class="btn btn-primary" @click="savePlan">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showAiPreview" class="modal-mask" @click.self="cancelAiPlan">
      <div class="modal modal-lg modal-wide">
        <div class="modal-header">
          <h3>AI 生成预览 ({{ aiPreviewTasks.length }} 条任务)</h3>
          <button class="btn-icon" @click="cancelAiPlan">&times;</button>
        </div>
        <div class="modal-body ai-preview-body">
          <p class="ai-hint">以下是 AI 生成的项目计划，请检查后确认录入。点击 × 可删除不需要的任务。</p>
          <div class="ai-task-list">
            <template v-for="task in aiPreviewTasks" :key="task.id">
              <div :class="['ai-task-item', { 'is-child': task.parentId !== null }]">
                <span :class="['plan-dot', task.status]"></span>
                <span class="ai-task-name">{{ task.name }}</span>
                <span class="ai-task-date">{{ task.startDate }} ~ {{ task.endDate }}</span>
                <button class="btn-icon" @click="removeAiPreviewTask(task.id)" title="移除">&times;</button>
              </div>
            </template>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="cancelAiPlan">取消</button>
          <button class="btn btn-primary" @click="confirmAiPlan">确认录入 ({{ aiPreviewTasks.length }})</button>
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
.modal-wide { width: 600px; }

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
.plan-toolbar { display: flex; gap: 6px; align-items: center; }
.import-btn { cursor: pointer; }
.plan-split { display: grid; grid-template-columns: 400px 1fr; gap: 12px; }
.plan-list { display: flex; flex-direction: column; gap: 3px; height: 450px; overflow-y: auto; }
.plan-item {
  display: flex; align-items: center; gap: 5px; padding: 4px 6px;
  border: 1px solid var(--border-light); border-radius: var(--radius-sm);
  cursor: pointer; transition: all 0.12s; font-size: 13px;
}
.plan-item.is-child { padding-left: 24px; background: var(--bg); border-style: dashed; }
.plan-item:hover { border-color: var(--primary); box-shadow: var(--shadow-xs); }
.plan-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.plan-dot.pending { background: #94a3b8; }
.plan-dot.in_progress { background: #22c55e; }
.plan-dot.completed { background: #3b82f6; }
.plan-name { flex: 1; font-size: 12.5px; color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.plan-date { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.plan-progress { display: flex; align-items: center; gap: 4px; width: 72px; flex-shrink: 0; }
.plan-pct { font-size: 11px; font-weight: 600; color: var(--primary); min-width: 26px; }
.plan-countdown { font-size: 10px; font-weight: 600; min-width: 48px; text-align: right; flex-shrink: 0; }
.plan-countdown.normal { color: var(--text-muted); }
.plan-countdown.warning { color: #d97706; }
.plan-countdown.urgent { color: #dc2626; }
.plan-countdown.overdue { color: #dc2626; }
.deadline-banner {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 8px 14px; background: #fef3c7; border-top: 1px solid #fde68a;
  font-size: 12px;
}
.deadline-icon { font-size: 14px; flex-shrink: 0; }
.deadline-tag { color: #92400e; }
.deadline-tag.urgent { color: #dc2626; font-weight: 600; }
.deadline-tag.overdue { color: #dc2626; font-weight: 700; }
.gantt-section { min-width: 0; overflow: hidden; height: 450px; }

.form-field { margin-bottom: 14px; }
.form-field:last-child { margin-bottom: 0; }
.form-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 5px;
}

.ai-preview-body { max-height: 400px; overflow-y: auto; }
.ai-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.ai-task-list { display: flex; flex-direction: column; gap: 4px; }
.ai-task-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 13px;
}
.ai-task-item.is-child { padding-left: 24px; background: var(--bg); border-style: dashed; }
.ai-task-name { flex: 1; color: var(--text); }
.ai-task-date { font-size: 11px; color: var(--text-muted); }

.plan-todo-badge {
  font-size: 10px; font-weight: 600; color: var(--primary);
  background: var(--primary-light, #eef2ff); padding: 1px 6px;
  border-radius: var(--radius-full); flex-shrink: 0;
}
.linked-todos-section {
  margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-light);
}
.linked-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.linked-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.linked-list { max-height: 150px; overflow-y: auto; margin-bottom: 8px; }
.linked-item {
  display: flex; align-items: center; gap: 6px; padding: 4px 6px;
  border-radius: var(--radius-sm); font-size: 12px;
}
.linked-item:hover { background: var(--bg-hover); }
.linked-name { flex: 1; color: var(--text); }
.linked-name.done { text-decoration: line-through; color: var(--text-muted); }
.linked-empty { font-size: 12px; color: var(--text-muted); padding: 6px 0; }
.linked-add { display: flex; gap: 6px; }
.linked-add .input { flex: 1; font-size: 12px; padding: 5px 8px; }
.checkbox-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.checkbox-label input[type="checkbox"] { accent-color: var(--primary); }
.todo-task-tag {
  font-size: 10px; color: var(--primary); background: #eef2ff;
  padding: 1px 6px; border-radius: var(--radius-full); flex-shrink: 0;
}
</style>
