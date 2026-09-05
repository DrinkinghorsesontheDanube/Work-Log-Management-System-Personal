<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useTodosStore } from '../stores/todos'
import { useProjectsStore } from '../stores/projects'
import ConfirmModal from '../components/ConfirmModal.vue'
import TodoCategoryIcon from '../components/TodoCategoryIcon.vue'
import { addDaysStr, fmtDate, mondayOf, todayStr } from '../utils/date'
import type { Todo, TodoCategoryId } from '../types'
import { TODO_CATEGORIES } from '../types'

const todosStore = useTodosStore()
const projectsStore = useProjectsStore()

const searchQuery = ref('')
const filterPriority = ref<'all' | 'high' | 'medium' | 'low'>('all')
const filterCategory = ref<'all' | TodoCategoryId>('all')
const viewMode = ref<'board' | 'list'>('board')
const batchMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

const showModal = ref(false)
const editingTodo = ref<Todo | null>(null)
const formTitle = ref('')
const formDesc = ref('')
const formPriority = ref<Todo['priority']>('medium')
const formCategory = ref<TodoCategoryId>('project')
const formDueDate = ref('')
const formProjectId = ref<string | null>(null)
const formStatus = ref<Todo['status']>('pending')

const quickTitle = ref('')
const quickCategory = ref<TodoCategoryId>('project')

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

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: '紧急', color: '#ef4444', bg: '#fef2f2' },
  medium: { label: '中', color: '#f59e0b', bg: '#fffbeb' },
  low: { label: '低', color: '#94a3b8', bg: '#f1f5f9' }
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待处理', color: '#f59e0b', bg: '#fffbeb' },
  in_progress: { label: '进行中', color: '#3b82f6', bg: '#eff6ff' },
  completed: { label: '已完成', color: '#10b981', bg: '#ecfdf5' }
}

function getCategoryInfo(id: TodoCategoryId) {
  return TODO_CATEGORIES.find(c => c.id === id) || TODO_CATEGORIES.find(c => c.id === 'other')!
}

function getProjectName(id: string | null) {
  if (!id) return ''
  return projectsStore.projects.find(p => p.id === id)?.name || ''
}

function getTodayStr() {
  return todayStr()
}

function getWeekDates() {
  const monday = mondayOf()
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: fmtDate(monday),
    end: fmtDate(sunday)
  }
}

const stats = computed(() => {
  const all = todosStore.todos
  const total = all.length
  const completedCount = all.filter(t => t.status === 'completed').length
  const rate = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const today = getTodayStr()
  const week = getWeekDates()
  const overdue = all.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < today).length
  const todayCount = all.filter(t => t.dueDate === today && t.status !== 'completed').length
  const weekCount = all.filter(t => t.status !== 'completed' && t.dueDate >= week.start && t.dueDate <= week.end).length
  return { total, completed: completedCount, rate, overdue, today: todayCount, week: weekCount }
})

const filteredTodos = computed(() => {
  let list = [...todosStore.todos]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      getProjectName(t.projectId).toLowerCase().includes(q)
    )
  }
  if (filterPriority.value !== 'all') {
    list = list.filter(t => t.priority === filterPriority.value)
  }
  if (filterCategory.value !== 'all') {
    list = list.filter(t => t.category === filterCategory.value)
  }
  const pri: Record<string, number> = { high: 0, medium: 1, low: 2 }
  list.sort((a, b) => (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1))
  return list
})

const pendingColumn = computed(() => filteredTodos.value.filter(t => t.status === 'pending'))
const inProgressColumn = computed(() => filteredTodos.value.filter(t => t.status === 'in_progress'))
const completedColumn = computed(() => filteredTodos.value.filter(t => t.status === 'completed'))

const boardColumns = computed(() => [
  { key: 'pending', label: '待处理', color: '#f59e0b', emptyIcon: '🎉', emptyText: '暂无待处理', items: pendingColumn.value },
  { key: 'in_progress', label: '进行中', color: '#3b82f6', emptyIcon: '🚀', emptyText: '暂无进行中', items: inProgressColumn.value },
  { key: 'completed', label: '已完成', color: '#10b981', emptyIcon: '✨', emptyText: '暂无已完成', items: completedColumn.value }
])

/* 已完成列默认只展示最近 N 条，更早的折叠收纳，避免列表无限变长 */
const completedLimit = 10
const expandCompleted = ref(false)
const visibleCompletedItems = computed(() => completedColumn.value.slice(0, completedLimit))
const hiddenCompletedCount = computed(() => Math.max(0, completedColumn.value.length - completedLimit))

function cycleStatus(todo: Todo) {
  const next: Record<string, Todo['status']> = {
    pending: 'in_progress',
    in_progress: 'completed',
    completed: 'pending'
  }
  todosStore.updateTodo(todo.id, { status: next[todo.status] })
}

function formatDueDate(date: string): string {
  if (!date) return ''
  const today = getTodayStr()
  if (date === today) return '今天'
  if (date === addDaysStr(1)) return '明天'
  const parts = date.split('-')
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`
}

function isOverdue(todo: Todo): boolean {
  return todo.status !== 'completed' && !!todo.dueDate && todo.dueDate < getTodayStr()
}

function handleQuickAdd() {
  const title = quickTitle.value.trim()
  if (!title) return
  todosStore.addTodo({
    title,
    description: '',
    status: 'pending',
    priority: 'medium',
    category: quickCategory.value,
    dueDate: '',
    projectId: null,
    planTaskId: null
  })
  quickTitle.value = ''
}

function openAdd() {
  editingTodo.value = null
  formTitle.value = ''
  formDesc.value = ''
  formPriority.value = 'medium'
  formCategory.value = 'project'
  formDueDate.value = ''
  formProjectId.value = null
  formStatus.value = 'pending'
  showModal.value = true
}

function openEdit(todo: Todo) {
  editingTodo.value = todo
  formTitle.value = todo.title
  formDesc.value = todo.description
  formPriority.value = todo.priority
  formCategory.value = todo.category
  formDueDate.value = todo.dueDate
  formProjectId.value = todo.projectId
  formStatus.value = todo.status
  showModal.value = true
}

function saveTodo() {
  if (!formTitle.value.trim()) return
  if (editingTodo.value) {
    todosStore.updateTodo(editingTodo.value.id, {
      title: formTitle.value,
      description: formDesc.value,
      priority: formPriority.value,
      category: formCategory.value,
      dueDate: formDueDate.value,
      projectId: formProjectId.value,
      status: formStatus.value
    })
  } else {
    todosStore.addTodo({
      title: formTitle.value,
      description: formDesc.value,
      priority: formPriority.value,
      category: formCategory.value,
      dueDate: formDueDate.value,
      projectId: formProjectId.value,
      planTaskId: null,
      status: formStatus.value
    })
  }
  showModal.value = false
}

async function removeTodo(id: string) {
  const todo = todosStore.todos.find(t => t.id === id)
  const ok = await showConfirm('删除待办', `确定删除「${todo?.title || ''}」？此操作不可撤销。`, true)
  if (ok) todosStore.deleteTodo(id)
}

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    selectedIds.value.clear()
  }
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  selectedIds.value = new Set(selectedIds.value)
}

function isSelected(id: string) {
  return selectedIds.value.has(id)
}

function batchComplete() {
  for (const id of selectedIds.value) {
    todosStore.updateTodo(id, { status: 'completed' })
  }
  selectedIds.value.clear()
  batchMode.value = false
}

async function batchDelete() {
  const count = selectedIds.value.size
  const ok = await showConfirm('批量删除', `确定删除选中的 ${count} 个待办？此操作不可撤销。`, true)
  if (ok) {
    for (const id of selectedIds.value) {
      todosStore.deleteTodo(id)
    }
    selectedIds.value.clear()
    batchMode.value = false
  }
}

function cancelBatch() {
  selectedIds.value.clear()
  batchMode.value = false
}

onMounted(() => {
  todosStore.loadTodos()
  projectsStore.loadProjects()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">待办事项</h1>
        <p class="page-subtitle">管理你的任务和待办事项</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新建待办
      </button>
    </div>

    <div class="stats-bar">
      <div class="stat-card">
        <span class="stat-icon stat-teal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
        </span>
        <div class="stat-info">
          <span class="stat-num">{{ stats.total }}</span>
          <span class="stat-label">全部待办</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon stat-green">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
        </span>
        <div class="stat-info">
          <span class="stat-num">{{ stats.rate }}<span class="stat-unit">%</span></span>
          <span class="stat-label">完成率</span>
          <div class="mini-progress"><div class="mini-fill" :style="{ width: stats.rate + '%' }"></div></div>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon stat-rose">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </span>
        <div class="stat-info">
          <span class="stat-num">{{ stats.overdue }}</span>
          <span class="stat-label">已逾期</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon stat-blue">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>
        </span>
        <div class="stat-info">
          <span class="stat-num">{{ stats.today }}</span>
          <span class="stat-label">今日待办</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon stat-amber">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </span>
        <div class="stat-info">
          <span class="stat-num">{{ stats.week }}</span>
          <span class="stat-label">本周待办</span>
        </div>
      </div>
    </div>

    <div class="quick-add">
      <span class="quick-plus">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </span>
      <input
        v-model="quickTitle"
        class="quick-input"
        placeholder="快速添加待办，输入标题后按 Enter 添加..."
        @keydown.enter="handleQuickAdd"
      />
      <div class="quick-select-wrap">
        <select v-model="quickCategory" class="quick-select">
          <option v-for="cat in TODO_CATEGORIES" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
        <svg class="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <button class="btn btn-primary btn-sm" @click="handleQuickAdd" :disabled="!quickTitle.trim()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        添加
      </button>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="searchQuery" class="input search-input" placeholder="搜索标题、描述、项目..." />
        </div>
        <div class="pill-group">
          <button :class="['pill', { active: filterPriority === 'all' }]" @click="filterPriority = 'all'">全部</button>
          <button :class="['pill', { active: filterPriority === 'high' }]" @click="filterPriority = 'high'">
            <span class="pill-dot" style="background:#ef4444"></span>紧急
          </button>
          <button :class="['pill', { active: filterPriority === 'medium' }]" @click="filterPriority = 'medium'">
            <span class="pill-dot" style="background:#f59e0b"></span>中
          </button>
          <button :class="['pill', { active: filterPriority === 'low' }]" @click="filterPriority = 'low'">
            <span class="pill-dot" style="background:#94a3b8"></span>低
          </button>
        </div>
        <div class="pill-group">
          <button :class="['pill', { active: filterCategory === 'all' }]" @click="filterCategory = 'all'">全部类型</button>
          <button
            v-for="cat in TODO_CATEGORIES"
            :key="cat.id"
            :class="['pill', { active: filterCategory === cat.id }]"
            @click="filterCategory = cat.id"
          ><TodoCategoryIcon :id="cat.id" :size="12" /> {{ cat.name }}</button>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="view-toggle">
          <button :class="['view-btn', { active: viewMode === 'board' }]" @click="viewMode = 'board'" title="看板视图">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button :class="['view-btn', { active: viewMode === 'list' }]" @click="viewMode = 'list'" title="列表视图">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
        <button :class="['btn btn-sm', batchMode ? 'btn-primary' : '']" @click="toggleBatchMode">
          {{ batchMode ? '退出批量' : '批量操作' }}
        </button>
      </div>
    </div>

    <template v-if="viewMode === 'board'">
      <div v-if="filteredTodos.length === 0" class="card empty-card">
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-text">暂无待办事项</p>
          <p class="empty-hint">点击「新建待办」或使用上方快速添加创建第一个待办</p>
        </div>
      </div>
      <div v-else class="board">
        <div v-for="col in boardColumns" :key="col.key" class="board-col">
          <div class="col-header">
            <span class="col-dot" :style="{ background: col.color }"></span>
            <span class="col-title">{{ col.label }}</span>
            <span class="col-count">{{ col.items.length }}</span>
          </div>
          <div class="col-body">
            <div v-if="col.items.length === 0" class="col-empty">
              <span class="col-empty-icon">{{ col.emptyIcon }}</span>
              <span class="col-empty-text">{{ col.emptyText }}</span>
            </div>
            <div
              v-for="todo in (col.key === 'completed' ? (expandCompleted ? col.items : visibleCompletedItems) : col.items)"
              :key="todo.id"
              :class="['todo-card', todo.status, {
                selected: batchMode && isSelected(todo.id),
                overdue: isOverdue(todo)
              }]"
              @click="batchMode ? toggleSelect(todo.id) : openEdit(todo)"
            >
              <div class="card-top-row">
                <input
                  v-if="batchMode"
                  type="checkbox"
                  :checked="isSelected(todo.id)"
                  @click.stop="toggleSelect(todo.id)"
                  class="batch-check"
                />
                <button class="status-btn" :class="todo.status" @click.stop="cycleStatus(todo)" :title="statusConfig[todo.status].label">
                  <svg v-if="todo.status === 'completed'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <svg v-else-if="todo.status === 'in_progress'" width="8" height="8" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <span class="card-title" :class="{ 'title-done': todo.status === 'completed' }">{{ todo.title }}</span>
                <button class="card-delete" @click.stop="removeTodo(todo.id)" title="删除">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
              <p v-if="todo.description" class="card-desc">{{ todo.description }}</p>
              <div class="card-meta">
                <span class="meta-tag pri-tag" :style="{ color: priorityConfig[todo.priority].color, background: priorityConfig[todo.priority].bg }">
                  <span class="tag-dot" :style="{ background: priorityConfig[todo.priority].color }"></span>
                  {{ priorityConfig[todo.priority].label }}
                </span>
                <span class="meta-tag cat-tag" :style="{ color: getCategoryInfo(todo.category).color, background: getCategoryInfo(todo.category).color + '18' }">
                  <TodoCategoryIcon :id="todo.category" :size="11" /> {{ getCategoryInfo(todo.category).name }}
                </span>
                <span v-if="getProjectName(todo.projectId)" class="meta-tag proj-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg> {{ getProjectName(todo.projectId) }}</span>
                <span v-if="todo.dueDate" :class="['meta-tag due-tag', { 'due-overdue': isOverdue(todo) }]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> {{ isOverdue(todo) ? '已逾期 · ' : '' }}{{ formatDueDate(todo.dueDate) }}
                </span>
              </div>
            </div>
          </div>
          <button
            v-if="col.key === 'completed' && hiddenCompletedCount > 0"
            class="col-more"
            @click="expandCompleted = !expandCompleted"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline v-if="!expandCompleted" points="6 9 12 15 18 9"/><polyline v-else points="18 15 12 9 6 15"/></svg>
            {{ expandCompleted ? '收起' : `展开全部 ${hiddenCompletedCount} 条更早记录` }}
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="filteredTodos.length === 0" class="card empty-card">
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-text">暂无待办事项</p>
          <p class="empty-hint">点击「新建待办」或使用上方快速添加创建第一个待办</p>
        </div>
      </div>
      <template v-else>
        <div
          v-for="group in boardColumns.filter(g => g.items.length > 0)"
          :key="group.key"
          class="list-group card"
        >
          <div class="list-group-header">
            <span class="col-dot" :style="{ background: group.color }"></span>
            <span class="list-group-title">{{ group.label }}</span>
            <span class="col-count">{{ group.items.length }}</span>
          </div>
          <div
            v-for="todo in (group.key === 'completed' ? (expandCompleted ? group.items : visibleCompletedItems) : group.items)"
            :key="todo.id"
            :class="['list-row-item', { selected: batchMode && isSelected(todo.id), overdue: isOverdue(todo) }]"
            @click="batchMode ? toggleSelect(todo.id) : openEdit(todo)"
          >
            <input
              v-if="batchMode"
              type="checkbox"
              :checked="isSelected(todo.id)"
              @click.stop="toggleSelect(todo.id)"
              class="batch-check"
            />
            <button class="status-btn" :class="todo.status" @click.stop="cycleStatus(todo)" :title="statusConfig[todo.status].label">
              <svg v-if="todo.status === 'completed'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <svg v-else-if="todo.status === 'in_progress'" width="8" height="8" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div class="list-main">
              <span class="list-title" :class="{ 'title-done': todo.status === 'completed' }">{{ todo.title }}</span>
              <span v-if="todo.description" class="list-desc">{{ todo.description }}</span>
            </div>
            <div class="list-meta">
              <span class="meta-tag pri-tag" :style="{ color: priorityConfig[todo.priority].color, background: priorityConfig[todo.priority].bg }">
                <span class="tag-dot" :style="{ background: priorityConfig[todo.priority].color }"></span>
                {{ priorityConfig[todo.priority].label }}
              </span>
              <span class="meta-tag cat-tag" :style="{ color: getCategoryInfo(todo.category).color, background: getCategoryInfo(todo.category).color + '18' }">
                <TodoCategoryIcon :id="todo.category" :size="11" /> {{ getCategoryInfo(todo.category).name }}
              </span>
              <span v-if="getProjectName(todo.projectId)" class="meta-tag proj-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg> {{ getProjectName(todo.projectId) }}</span>
              <span v-if="todo.dueDate" :class="['meta-tag due-tag', { 'due-overdue': isOverdue(todo) }]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> {{ isOverdue(todo) ? '已逾期 · ' : '' }}{{ formatDueDate(todo.dueDate) }}
              </span>
            </div>
            <button class="card-delete" @click.stop="removeTodo(todo.id)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <button
            v-if="group.key === 'completed' && hiddenCompletedCount > 0"
            class="col-more"
            @click="expandCompleted = !expandCompleted"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline v-if="!expandCompleted" points="6 9 12 15 18 9"/><polyline v-else points="18 15 12 9 6 15"/></svg>
            {{ expandCompleted ? '收起' : `展开全部 ${hiddenCompletedCount} 条更早记录` }}
          </button>
        </div>
      </template>
    </template>

    <div v-if="batchMode && selectedIds.size > 0" class="batch-bar">
      <span class="batch-info">已选 {{ selectedIds.size }} 项</span>
      <button class="btn btn-sm btn-batch-ok" @click="batchComplete">批量完成</button>
      <button class="btn btn-sm btn-batch-del" @click="batchDelete">批量删除</button>
      <button class="btn btn-sm" @click="cancelBatch">取消</button>
    </div>

    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingTodo ? '编辑待办' : '新建待办' }}</h3>
          <button class="btn-icon" @click="showModal = false" style="font-size:18px">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>标题 <span class="required">*</span></label>
            <input v-model="formTitle" placeholder="请输入待办标题" class="input" />
          </div>
          <div class="form-field">
            <label>描述</label>
            <textarea v-model="formDesc" placeholder="请输入描述（可选）" class="input" rows="3"></textarea>
          </div>
          <div class="form-field">
            <label>优先级</label>
            <div class="priority-cards">
              <button
                v-for="p in (['high', 'medium', 'low'] as const)"
                :key="p"
                :class="['pri-card', { active: formPriority === p }]"
                :style="formPriority === p ? { borderColor: priorityConfig[p].color, background: priorityConfig[p].bg } : {}"
                @click="formPriority = p"
              >
                <span class="pri-dot" :style="{ background: priorityConfig[p].color }"></span>
                <span class="pri-label">{{ priorityConfig[p].label }}</span>
              </button>
            </div>
          </div>
          <div class="form-field">
            <label>分类</label>
            <div class="cat-grid">
              <button
                v-for="cat in TODO_CATEGORIES"
                :key="cat.id"
                :class="['cat-card', { active: formCategory === cat.id }]"
                :style="formCategory === cat.id ? { borderColor: cat.color, background: cat.color + '12' } : {}"
                @click="formCategory = cat.id"
              >
                <span class="cat-icon"><TodoCategoryIcon :id="cat.id" :size="15" /></span>
                <span class="cat-name">{{ cat.name }}</span>
              </button>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>截止日期</label>
              <input v-model="formDueDate" type="date" class="input" />
            </div>
            <div class="form-field">
              <label>关联项目</label>
              <select v-model="formProjectId" class="input">
                <option :value="null">不关联</option>
                <option v-for="p in projectsStore.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
          </div>
          <div class="form-field">
            <label>状态</label>
            <div class="status-segment">
              <button
                v-for="s in (['pending', 'in_progress', 'completed'] as const)"
                :key="s"
                :class="['seg-btn', { active: formStatus === s }]"
                :style="formStatus === s ? { background: statusConfig[s].color, color: '#fff', borderColor: statusConfig[s].color } : {}"
                @click="formStatus = s"
              >{{ statusConfig[s].label }}</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="saveTodo" :disabled="!formTitle.trim()">保存</button>
        </div>
      </div>
    </div>

    <ConfirmModal
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="删除"
      :danger="confirmDanger"
      @confirm="onConfirmOk"
      @cancel="onConfirmCancel"
    />
  </div>
</template>

<style scoped>
/* ========== 统计条 ========== */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
}
.stat-card:hover {
  box-shadow: var(--shadow-sm);
  border-color: var(--primary-200);
}
.stat-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-teal { background: var(--primary-light); color: var(--primary); }
.stat-green { background: var(--green-bg); color: var(--green); }
.stat-rose { background: var(--rose-bg); color: var(--rose); }
.stat-blue { background: var(--blue-bg); color: var(--blue); }
.stat-amber { background: var(--amber-bg); color: var(--amber); }
.stat-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  color: var(--text);
}
.stat-unit {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}
.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
.mini-progress {
  width: 100%;
  height: 4px;
  background: var(--border-light);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: 8px;
}
.mini-fill {
  height: 100%;
  background: var(--green);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

/* ========== 快速添加 ========== */
.quick-add {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.quick-add:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.08);
}
.quick-plus {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--primary-light);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.quick-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  font-family: var(--font);
  color: var(--text);
  background: transparent;
  padding: 6px 0;
}
.quick-input::placeholder {
  color: var(--text-placeholder);
}
.quick-select-wrap {
  position: relative;
  flex-shrink: 0;
}
.quick-select {
  appearance: none;
  -webkit-appearance: none;
  padding: 6px 28px 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.quick-select:focus {
  border-color: var(--primary);
}
.select-chevron {
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

/* ========== 工具栏 ========== */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 18px;
  gap: 12px;
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
}
.toolbar-left {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
}
.search-wrap {
  position: relative;
  width: 230px;
}
.search-wrap > svg {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-placeholder);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 7px 12px 7px 32px;
  font-size: 13px;
}
.pill-group {
  display: flex;
  gap: 2px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  font-size: 13px;
  font-family: var(--font);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s;
  border-radius: var(--radius-full);
  white-space: nowrap;
}
.pill:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.pill.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.pill.active .pill-dot {
  background: #fff !important;
}
.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}
.view-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.view-btn {
  padding: 5px 8px;
  background: var(--bg-card);
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  transition: all 0.12s;
}
.view-btn:hover {
  color: var(--primary);
}
.view-btn.active {
  background: var(--primary);
  color: #fff;
}

/* ========== 看板 ========== */
.board {
  display: grid;
  grid-template-columns: 1.3fr 1.3fr 0.8fr;
  gap: 18px;
  align-items: start;
}
.board-col {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 350px);
  min-height: 240px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.col-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
}
.col-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.col-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
}
.col-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg);
  padding: 2px 9px;
  border-radius: var(--radius-full);
}
.col-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.col-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 12px;
  background: var(--bg-card);
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-sm);
}
.col-empty-icon {
  font-size: 22px;
}
.col-empty-text {
  font-size: 12px;
  color: var(--text-muted);
}

/* ========== 待办卡片 ========== */
.todo-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
}
.todo-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--primary-200);
  transform: translateY(-1px);
}
.todo-card:hover .card-delete {
  opacity: 1;
}
.todo-card.overdue {
  border-color: #fecaca;
  background: linear-gradient(0deg, rgba(239, 68, 68, 0.03), rgba(239, 68, 68, 0.03)), var(--bg-card);
}
.todo-card.selected {
  border-color: var(--primary);
  background: var(--primary-50);
}
.todo-card.completed {
  opacity: 0.7;
}
.todo-card.completed:hover {
  opacity: 0.9;
  transform: none;
}

.card-top-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.status-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.status-btn.pending {
  border-color: var(--amber);
}
.status-btn.in_progress {
  border-color: var(--blue);
  background: var(--blue);
}
.status-btn.completed {
  border-color: var(--green);
  background: var(--green);
}
.status-btn:hover {
  transform: scale(1.18);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
}
.status-btn svg {
  display: block;
}
.card-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.title-done {
  text-decoration: line-through;
  color: var(--text-muted);
}
.card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-delete {
  opacity: 0;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: flex;
  transition: all 0.12s;
  flex-shrink: 0;
}
.card-delete:hover {
  color: var(--rose);
  background: var(--rose-bg);
}

.card-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}
.tag-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.proj-tag {
  background: var(--bg);
  color: var(--text-muted);
}
.due-tag {
  background: var(--bg);
  color: var(--text-muted);
}
.due-overdue {
  color: var(--rose);
  background: var(--rose-bg);
  font-weight: 600;
}

/* ========== 列表视图 ========== */
.list-group {
  margin-bottom: 14px;
  overflow: hidden;
}
.list-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
}
.list-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
}
.list-row-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background 0.12s;
}
.list-row-item:last-child {
  border-bottom: none;
}
.list-row-item:hover {
  background: var(--bg-hover);
}
.list-row-item:hover .card-delete {
  opacity: 1;
}
.list-row-item.selected {
  background: var(--primary-50);
}
.list-row-item.overdue {
  background: linear-gradient(0deg, rgba(239, 68, 68, 0.04), rgba(239, 68, 68, 0.04)), var(--bg-card);
}
.list-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.list-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.list-desc {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.list-meta {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
}

/* ========== 批量操作 ========== */
.batch-check {
  width: 15px;
  height: 15px;
  accent-color: var(--primary);
  cursor: pointer;
  flex-shrink: 0;
}
.batch-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  z-index: 100;
  animation: slideUp 0.2s ease;
}
.batch-info {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  margin-right: 4px;
}
.btn-batch-ok {
  background: var(--green);
  color: #fff;
  border-color: var(--green);
}
.btn-batch-ok:hover {
  background: #059669;
  border-color: #059669;
}
.btn-batch-del {
  background: var(--rose);
  color: #fff;
  border-color: var(--rose);
}
.btn-batch-del:hover {
  background: #dc2626;
  border-color: #dc2626;
}

/* ========== 已完成列折叠 ========== */
.col-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 12px 12px;
  padding: 8px 12px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  transition: all 0.15s;
}
.col-more:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-50);
}

/* ========== 空状态 ========== */
.empty-card {
  margin-bottom: 16px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 18px;
}
.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 14px;
}
.empty-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}
.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}

/* ========== 弹窗表单 ========== */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.15s;
}
.modal {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  width: 520px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
  animation: slideUp 0.2s ease;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
}
.modal-header h3 {
  font-size: 15px;
  font-weight: 600;
}
.modal-body {
  padding: 20px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-light);
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

.priority-cards {
  display: flex;
  gap: 8px;
}
.pri-card {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font);
  font-size: 13px;
  color: var(--text);
}
.pri-card:hover {
  border-color: var(--primary);
}
.pri-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.pri-label {
  font-weight: 500;
}

.cat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.cat-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font);
  font-size: 12px;
  color: var(--text);
}
.cat-card:hover {
  border-color: var(--primary);
}
.cat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cat-name {
  font-weight: 500;
}

.status-segment {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.seg-btn {
  flex: 1;
  padding: 7px 12px;
  border: none;
  background: var(--bg-card);
  font-size: 13px;
  font-family: var(--font);
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  border-right: 1px solid var(--border);
}
.seg-btn:last-child {
  border-right: none;
}
.seg-btn:hover {
  background: var(--bg-hover);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1200px) {
  .stats-bar {
    grid-template-columns: repeat(3, 1fr);
  }
  .board {
    grid-template-columns: 1.15fr 1.15fr 0.85fr;
  }
}

@media (max-width: 900px) {
  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
  }
  .board {
    grid-template-columns: 1fr;
  }
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar-left {
    flex-direction: column;
  }
  .toolbar-right {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .search-wrap {
    width: 100%;
  }
  .pill-group {
    flex-wrap: wrap;
  }
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .list-meta {
    display: none;
  }
}

@media (max-width: 600px) {
  .stats-bar {
    gap: 8px;
  }
  .stat-card {
    padding: 10px 12px;
  }
  .stat-num {
    font-size: 18px;
  }
  .stat-icon {
    width: 32px;
    height: 32px;
  }
  .quick-add {
    flex-wrap: wrap;
  }
  .quick-select-wrap {
    flex: 1;
  }
  .quick-select {
    width: 100%;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .priority-cards {
    flex-direction: column;
  }
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .batch-bar {
    left: 16px;
    right: 16px;
    transform: none;
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
