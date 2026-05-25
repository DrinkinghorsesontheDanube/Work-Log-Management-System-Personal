<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  NCard, 
  NButton, 
  NProgress, 
  NModal, 
  NForm, 
  NFormItem, 
  NInput,
  NSelect,
  NDatePicker,
  NPopconfirm,
  NTag,
  NList,
  NListItem,
  NIcon,
  NSpace,
  NGrid,
  NGridItem,
  NDivider,
  NInputNumber
} from 'naive-ui'
import { ArrowBackOutline, AddOutline, TrashOutline, CreateOutline, CheckmarkCircleOutline } from '@vicons/ionicons5'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import type { Project, Todo } from '../types'

const route = useRoute()
const router = useRouter()
const projectsStore = useProjectsStore()
const todosStore = useTodosStore()
const workLogsStore = useWorkLogsStore()

const projectId = computed(() =&gt; route.params.id as string)
const project = computed(() =&gt; projectsStore.getProjectById(projectId.value))

const showEditModal = ref(false)
const showAddTodoModal = ref(false)
const editFormData = ref&lt;Partial&lt;Project&gt;&gt;({})
const todoFormData = ref({
  title: '',
  description: '',
  status: 'pending' as Todo['status'],
  priority: 'medium' as Todo['priority'],
  dueDate: null as number | null
})

const statusOptions = [
  { label: '规划中', value: 'planning' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已暂停', value: 'paused' }
]

const todoStatusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' }
]

const todoPriorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' }
]

const statusColors: Record&lt;string, string&gt; = {
  planning: 'default',
  in_progress: 'info',
  completed: 'success',
  paused: 'warning'
}

const statusLabels: Record&lt;string, string&gt; = {
  planning: '规划中',
  in_progress: '进行中',
  completed: '已完成',
  paused: '已暂停'
}

const projectTodos = computed(() =&gt; todosStore.getTodosByProjectId(projectId.value))
const projectLogs = computed(() =&gt; workLogsStore.getWorkLogsByProjectId(projectId.value))

function getPriorityColor(priority: string) {
  switch(priority) {
    case 'high': return '#fa5252'
    case 'medium': return '#faad14'
    case 'low': return '#52c41a'
    default: return '#8c8c8c'
  }
}

function openEditModal() {
  if (!project.value) return
  editFormData.value = { ...project.value }
  showEditModal.value = true
}

function updateProject() {
  if (!project.value) return
  projectsStore.updateProject(project.value.id, editFormData.value)
  showEditModal.value = false
}

function openAddTodoModal() {
  todoFormData.value = {
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    dueDate: null
  }
  showAddTodoModal.value = true
}

function addTodo() {
  if (!todoFormData.value.title) return
  
  todosStore.addTodo({
    title: todoFormData.value.title,
    description: todoFormData.value.description || undefined,
    status: todoFormData.value.status,
    priority: todoFormData.value.priority,
    dueDate: todoFormData.value.dueDate ? new Date(todoFormData.value.dueDate).toISOString().split('T')[0] : undefined,
    projectId: projectId.value
  })
  
  showAddTodoModal.value = false
}

function deleteTodo(todoId: string) {
  todosStore.deleteTodo(todoId)
}

function toggleTodoStatus(todo: Todo) {
  const newStatus = todo.status === 'completed' ? 'pending' : 'completed'
  todosStore.updateTodo(todo.id, { status: newStatus })
}

function deleteProject() {
  projectsStore.deleteProject(projectId.value)
  router.push('/projects')
}
</script>

<template>
  <div v-if="project">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px">
      <div style="display: flex; align-items: center; gap: 12px">
        <n-button quaternary @click="router.back()">
          <template #icon><n-icon><ArrowBackOutline /></n-icon></template>
        </n-button>
        <h2>{{ project.name }}</h2>
        <n-tag :type="statusColors[project.status]">{{ statusLabels[project.status] }}</n-tag>
      </div>
      <n-space>
        <n-button @click="openEditModal">
          <template #icon><n-icon><CreateOutline /></n-icon></template>
          编辑
        </n-button>
        <n-popconfirm @positive-click="deleteProject">
          <template #trigger>
            <n-button type="error">
              <template #icon><n-icon><TrashOutline /></n-icon></template>
              删除
            </n-button>
          </template>
          确定要删除此项目吗？
        </n-popconfirm>
      </n-space>
    </div>

    <n-grid :x-gap="16" :cols="2">
      <!-- 项目信息 -->
      <n-grid-item>
        <n-card title="项目信息">
          <div style="margin-bottom: 20px">
            <p style="color: #666; margin: 0; white-space: pre-wrap">{{ project.description || '暂无描述' }}</p>
          </div>
          
          <n-divider />
          
          <div style="margin-bottom: 16px">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
              <span>项目进度</span>
              <span style="color: #1890ff; font-weight: bold">{{ project.progress }}%</span>
            </div>
            <n-progress :percentage="project.progress" />
          </div>
          
          <div style="display: grid; gap: 8px">
            <div style="display: flex; justify-content: space-between">
              <span style="color: #666">开始日期</span>
              <span>{{ project.startDate || '-' }}</span>
            </div>
            <div style="display: flex; justify-content: space-between">
              <span style="color: #666">结束日期</span>
              <span>{{ project.endDate || '-' }}</span>
            </div>
            <div style="display: flex; justify-content: space-between">
              <span style="color: #666">待办事项</span>
              <span>{{ projectTodos.length }} 个</span>
            </div>
            <div style="display: flex; justify-content: space-between">
              <span style="color: #666">工作记录</span>
              <span>{{ projectLogs.length }} 条</span>
            </div>
          </div>
        </n-card>
      </n-grid-item>

      <!-- 待办事项 -->
      <n-grid-item>
        <n-card title="待办事项">
          <template #header-extra>
            <n-button size="small" type="primary" @click="openAddTodoModal">
              <template #icon><n-icon><AddOutline /></n-icon></template>
              添加
            </n-button>
          </template>
          
          <template v-if="projectTodos.length === 0">
            <div style="text-align: center; padding: 24px; color: #999">暂无待办事项</div>
          </template>
          
          <n-list v-else>
            <n-list-item v-for="todo in projectTodos" :key="todo.id">
              <div style="display: flex; align-items: center; gap: 12px; width: 100%">
                <n-button 
                  :type="todo.status === 'completed' ? 'success' : 'default'" 
                  quaternary 
                  circle 
                  size="small"
                  @click="toggleTodoStatus(todo)"
                >
                  <template #icon>
                    <n-icon v-if="todo.status === 'completed'"><CheckmarkCircleOutline /></n-icon>
                  </template>
                </n-button>
                <div 
                  :style="{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getPriorityColor(todo.priority) }"
                />
                <span style="flex: 1" :style="{ textDecoration: todo.status === 'completed' ? 'line-through' : 'none' }">
                  {{ todo.title }}
                </span>
                <span style="color: #999; font-size: 12px">{{ todo.dueDate || '-' }}</span>
                <n-popconfirm @positive-click="deleteTodo(todo.id)">
                  <template #trigger>
                    <n-button size="small" type="error" quaternary>
                      <template #icon><n-icon><TrashOutline /></n-icon></template>
                    </n-button>
                  </template>
                </n-popconfirm>
              </div>
            </n-list-item>
          </n-list>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 编辑项目弹窗 -->
    <n-modal v-model:show="showEditModal" preset="card" title="编辑项目" style="width: 500px">
      <n-form :model="editFormData" label-placement="left">
        <n-form-item label="项目名称">
          <n-input v-model:value="editFormData.name" placeholder="请输入项目名称" />
        </n-form-item>
        <n-form-item label="项目描述">
          <n-input 
            v-model:value="editFormData.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入项目描述" 
          />
        </n-form-item>
        <n-form-item label="进度">
          <n-input-number 
            v-model:value="editFormData.progress" 
            :min="0" 
            :max="100" 
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="状态">
          <n-select v-model:value="editFormData.status" :options="statusOptions" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" @click="updateProject">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 添加待办弹窗 -->
    <n-modal v-model:show="showAddTodoModal" preset="card" title="添加待办" style="width: 500px">
      <n-form :model="todoFormData" label-placement="left">
        <n-form-item label="标题">
          <n-input v-model:value="todoFormData.title" placeholder="请输入待办标题" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input 
            v-model:value="todoFormData.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入描述（可选）" 
          />
        </n-form-item>
        <n-form-item label="优先级">
          <n-select v-model:value="todoFormData.priority" :options="todoPriorityOptions" />
        </n-form-item>
        <n-form-item label="截止日期">
          <n-date-picker v-model:value="todoFormData.dueDate" type="date" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddTodoModal = false">取消</n-button>
          <n-button type="primary" @click="addTodo">添加</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
