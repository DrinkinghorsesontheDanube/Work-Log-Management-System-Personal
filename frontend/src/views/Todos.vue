<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useTodosStore } from '../stores/todos'
import { useProjectsStore } from '../stores/projects'
import type { Todo } from '../types'

const todosStore = useTodosStore()
const projectsStore = useProjectsStore()

const showModal = ref(false)
const editingTodo = ref<Todo | null>(null)
const formTitle = ref('')
const formDesc = ref('')
const formPriority = ref<Todo['priority']>('medium')
const formDueDate = ref('')
const formProjectId = ref<string | null>(null)
const filter = ref<'all' | 'pending' | 'in_progress' | 'completed'>('all')

const priorityOptions = [
  { label: '紧急', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' }
]

const filteredTodos = computed(() => {
  let list = [...todosStore.todos]
  if (filter.value !== 'all') {
    list = list.filter(t => t.status === filter.value)
  }
  const pri: Record<string, number> = { high: 0, medium: 1, low: 2 }
  return list.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (a.status !== 'completed' && b.status === 'completed') return -1
    return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1)
  })
})

const filterCounts = computed(() => ({
  all: todosStore.todos.length,
  pending: todosStore.pendingTodos.length,
  in_progress: todosStore.inProgressTodos.length,
  completed: todosStore.completedTodos.length
}))

function getProjectName(id: string | null) {
  if (!id) return ''
  return projectsStore.projects.find(p => p.id === id)?.name || ''
}

function openAdd() {
  editingTodo.value = null
  formTitle.value = ''
  formDesc.value = ''
  formPriority.value = 'medium'
  formDueDate.value = new Date().toISOString().split('T')[0]
  formProjectId.value = null
  showModal.value = true
}

function openEdit(todo: Todo) {
  editingTodo.value = todo
  formTitle.value = todo.title
  formDesc.value = todo.description
  formPriority.value = todo.priority
  formDueDate.value = todo.dueDate
  formProjectId.value = todo.projectId
  showModal.value = true
}

function save() {
  if (!formTitle.value.trim()) return
  if (editingTodo.value) {
    todosStore.updateTodo(editingTodo.value.id, {
      title: formTitle.value,
      description: formDesc.value,
      priority: formPriority.value,
      dueDate: formDueDate.value,
      projectId: formProjectId.value
    })
  } else {
    todosStore.addTodo({
      title: formTitle.value,
      description: formDesc.value,
      status: 'pending',
      priority: formPriority.value,
      dueDate: formDueDate.value,
      projectId: formProjectId.value
    })
  }
  showModal.value = false
}

function toggleStatus(todo: Todo) {
  const next = todo.status === 'completed' ? 'pending' : 'completed'
  todosStore.updateTodo(todo.id, { status: next })
}

function remove(id: string) {
  todosStore.deleteTodo(id)
}

function statusLabel(s: string) {
  return s === 'completed' ? '已完成' : s === 'in_progress' ? '进行中' : '待处理'
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
        <p class="page-subtitle">管理任务和待跟进事项</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新建待办
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="filters">
          <button
            v-for="f in (['all', 'pending', 'in_progress', 'completed'] as const)"
            :key="f"
            :class="['btn', 'btn-sm', { 'btn-primary': filter === f }]"
            @click="filter = f"
          >
            {{ f === 'all' ? '全部' : statusLabel(f) }}
            <span class="filter-count">{{ filterCounts[f] }}</span>
          </button>
        </div>
      </div>

      <div v-if="filteredTodos.length === 0" class="card-empty">暂无待办</div>

      <div class="card-body">
        <div
          v-for="t in filteredTodos"
          :key="t.id"
          class="list-row"
          :class="{ done: t.status === 'completed' }"
          @click="openEdit(t)"
        >
          <button class="check-btn" :class="{ checked: t.status === 'completed' }" @click.stop="toggleStatus(t)">
            <svg v-if="t.status === 'completed'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </button>

          <span :class="['todo-title', { struck: t.status === 'completed' }]">{{ t.title }}</span>

          <span :class="['badge', t.priority === 'high' ? 'badge-rose' : t.priority === 'medium' ? 'badge-amber' : '']">
            {{ t.priority === 'high' ? '紧急' : t.priority === 'medium' ? '中' : '低' }}
          </span>

          <span v-if="getProjectName(t.projectId)" class="todo-project">{{ getProjectName(t.projectId) }}</span>

          <span v-if="t.dueDate" class="todo-date">{{ t.dueDate }}</span>

          <span style="flex:1"></span>

          <button class="btn-icon" @click.stop="remove(t.id)" title="删除">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingTodo ? '编辑待办' : '新建待办' }}</h3>
          <button class="btn-icon" @click="showModal = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>标题 <span class="req">*</span></label>
            <input v-model="formTitle" placeholder="待办标题" class="input" />
          </div>
          <div class="field">
            <label>描述</label>
            <textarea v-model="formDesc" placeholder="详细描述" class="input" rows="3"></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label>优先级</label>
              <select v-model="formPriority" class="input">
                <option v-for="p in priorityOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
            <div class="field">
              <label>截止日期</label>
              <input v-model="formDueDate" type="date" class="input" />
            </div>
          </div>
          <div class="field">
            <label>关联项目</label>
            <select v-model="formProjectId" class="input">
              <option :value="null">不关联</option>
              <option v-for="p in projectsStore.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
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
.filters {
  display: flex;
  gap: 4px;
}
.filter-count {
  font-size: 10px;
  margin-left: 2px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.2);
}
.btn:not(.btn-primary) .filter-count {
  background: var(--border-light);
}

.check-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid var(--border);
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  transition: all 0.15s;
}
.check-btn:hover { border-color: var(--primary); }
.check-btn.checked { background: var(--primary); border-color: var(--primary); }

.todo-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  flex-shrink: 0;
}
.todo-title.struck {
  text-decoration: line-through;
  color: var(--text-muted);
}

.todo-project {
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-50);
  padding: 1px 6px;
  border-radius: var(--radius-full);
}
.todo-date {
  font-size: 11.5px;
  color: var(--text-muted);
}

.done { opacity: 0.55; }

.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12.5px; font-weight: 500; color: var(--text-secondary); margin-bottom: 5px; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.req { color: var(--rose); }
</style>
