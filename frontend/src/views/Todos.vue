<script setup>
import { ref, onMounted, computed } from 'vue'
import { NCard, NButton, NModal, NForm, NFormItem, NInput, NSelect, NTag, NSpace, NText, NIcon, NEmpty, NGrid, NGridItem, NPopconfirm } from 'naive-ui'
import { AddOutline, EditOutline, TrashOutline } from '@vicons/ionicons5'
import { useTodosStore } from '../stores/todos'
import { useProjectsStore } from '../stores/projects'

const todosStore = useTodosStore()
const projectsStore = useProjectsStore()

const showModal = ref(false)
const editingTodo = ref(null)
const todoTitle = ref('')
const todoDescription = ref('')
const todoStatus = ref('pending')
const todoPriority = ref('medium')
const todoDueDate = ref('')
const todoProjectId = ref(null)

const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' }
]

const priorityOptions = [
  { label: '高优先级', value: 'high' },
  { label: '中优先级', value: 'medium' },
  { label: '低优先级', value: 'low' }
]

const projectOptions = computed(() => [
  { label: '不关联项目', value: null },
  ...projectsStore.projects.map(p => ({ label: p.name, value: p.id }))
])

function openAddModal() {
  editingTodo.value = null
  todoTitle.value = ''
  todoDescription.value = ''
  todoStatus.value = 'pending'
  todoPriority.value = 'medium'
  const today = new Date().toISOString().split('T')[0]
  todoDueDate.value = today
  todoProjectId.value = null
  showModal.value = true
}

function openEditModal(todo) {
  editingTodo.value = todo
  todoTitle.value = todo.title
  todoDescription.value = todo.description
  todoStatus.value = todo.status
  todoPriority.value = todo.priority
  todoDueDate.value = todo.dueDate
  todoProjectId.value = todo.projectId
  showModal.value = true
}

function saveTodo() {
  if (editingTodo.value) {
    todosStore.updateTodo(editingTodo.value.id, {
      title: todoTitle.value,
      description: todoDescription.value,
      status: todoStatus.value,
      priority: todoPriority.value,
      dueDate: todoDueDate.value,
      projectId: todoProjectId.value
    })
  } else {
    todosStore.addTodo({
      title: todoTitle.value,
      description: todoDescription.value,
      status: todoStatus.value,
      priority: todoPriority.value,
      dueDate: todoDueDate.value,
      projectId: todoProjectId.value
    })
  }
  showModal.value = false
}

function deleteTodo(id) {
  todosStore.deleteTodo(id)
}

function getPriorityType(priority) {
  const types = { high: 'error', medium: 'warning', low: 'success' }
  return types[priority] || 'default'
}

function getPriorityText(priority) {
  const texts = { high: '高', medium: '中', low: '低' }
  return texts[priority] || priority
}

function getProjectName(projectId) {
  if (!projectId) return ''
  const project = projectsStore.projects.find(p => p.id === projectId)
  return project ? project.name : ''
}

onMounted(() => {
  todosStore.loadTodos()
  projectsStore.loadProjects()
})
</script>

<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px">
      <h2 style="font-size: 24px; font-weight: 600; color: #262626; margin: 0">待办事项</h2>
      <n-button type="primary" @click="openAddModal">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        添加待办
      </n-button>
    </div>

    <!-- 三栏看板 -->
    <n-grid :x-gap="20" :cols="3">
      <!-- 待处理 -->
      <n-grid-item>
        <n-card title="待处理" :bordered="false" style="background: #fafafa">
          <template #header-extra>
            <n-tag type="default" size="small">{{ todosStore.pendingTodos.length }}</n-tag>
          </template>
          <n-space vertical :size="12">
            <template v-if="todosStore.pendingTodos.length === 0">
              <n-empty description="暂无待处理任务" />
            </template>
            <template v-else>
              <div 
                v-for="todo in todosStore.pendingTodos" 
                :key="todo.id" 
                style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08)"
              >
                <div style="margin-bottom: 8px">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
                    <strong style="font-size: 14px; color: #262626">{{ todo.title }}</strong>
                    <n-tag :type="getPriorityType(todo.priority)" size="small">{{ getPriorityText(todo.priority) }}</n-tag>
                  </div>
                  <n-text depth="3" style="font-size: 13px; line-height: 1.5">{{ todo.description }}</n-text>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f0f0f0">
                  <n-text depth="3" style="font-size: 12px">{{ todo.dueDate }}</n-text>
                  <n-space>
                    <n-button text size="small" @click="openEditModal(todo)">
                      <template #icon><n-icon :size="16"><EditOutline /></n-icon></template>
                    </n-button>
                    <n-popconfirm @positive-click="deleteTodo(todo.id)">
                      <template #trigger>
                        <n-button text size="small">
                          <template #icon><n-icon :size="16" color="#ff4d4f"><TrashOutline /></n-icon></template>
                        </n-button>
                      </template>
                      确定要删除吗？
                    </n-popconfirm>
                  </n-space>
                </div>
              </div>
            </template>
          </n-space>
        </n-card>
      </n-grid-item>

      <!-- 进行中 -->
      <n-grid-item>
        <n-card title="进行中" :bordered="false" style="background: #f6ffed">
          <template #header-extra>
            <n-tag type="info" size="small">{{ todosStore.inProgressTodos.length }}</n-tag>
          </template>
          <n-space vertical :size="12">
            <template v-if="todosStore.inProgressTodos.length === 0">
              <n-empty description="暂无进行中任务" />
            </template>
            <template v-else>
              <div 
                v-for="todo in todosStore.inProgressTodos" 
                :key="todo.id" 
                style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08)"
              >
                <div style="margin-bottom: 8px">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
                    <strong style="font-size: 14px; color: #262626">{{ todo.title }}</strong>
                    <n-tag :type="getPriorityType(todo.priority)" size="small">{{ getPriorityText(todo.priority) }}</n-tag>
                  </div>
                  <n-text depth="3" style="font-size: 13px; line-height: 1.5">{{ todo.description }}</n-text>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #d9f7be">
                  <n-text depth="3" style="font-size: 12px">{{ todo.dueDate }}</n-text>
                  <n-space>
                    <n-button text size="small" @click="openEditModal(todo)">
                      <template #icon><n-icon :size="16"><EditOutline /></n-icon></template>
                    </n-button>
                    <n-popconfirm @positive-click="deleteTodo(todo.id)">
                      <template #trigger>
                        <n-button text size="small">
                          <template #icon><n-icon :size="16" color="#ff4d4f"><TrashOutline /></n-icon></template>
                        </n-button>
                      </template>
                      确定要删除吗？
                    </n-popconfirm>
                  </n-space>
                </div>
              </div>
            </template>
          </n-space>
        </n-card>
      </n-grid-item>

      <!-- 已完成 -->
      <n-grid-item>
        <n-card title="已完成" :bordered="false" style="background: #f9f9f9">
          <template #header-extra>
            <n-tag type="success" size="small">{{ todosStore.completedTodos.length }}</n-tag>
          </template>
          <n-space vertical :size="12">
            <template v-if="todosStore.completedTodos.length === 0">
              <n-empty description="暂无已完成任务" />
            </template>
            <template v-else>
              <div 
                v-for="todo in todosStore.completedTodos.slice(0, 10)" 
                :key="todo.id" 
                style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08)"
              >
                <div style="margin-bottom: 8px">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
                    <strong style="font-size: 14px; color: #999; text-decoration: line-through">{{ todo.title }}</strong>
                    <n-tag :type="getPriorityType(todo.priority)" size="small">{{ getPriorityText(todo.priority) }}</n-tag>
                  </div>
                  <n-text depth="3" style="font-size: 13px; line-height: 1.5; text-decoration: line-through">{{ todo.description }}</n-text>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f0f0f0">
                  <n-text depth="3" style="font-size: 12px">{{ todo.dueDate }}</n-text>
                  <n-space>
                    <n-button text size="small" @click="openEditModal(todo)">
                      <template #icon><n-icon :size="16"><EditOutline /></n-icon></template>
                    </n-button>
                    <n-popconfirm @positive-click="deleteTodo(todo.id)">
                      <template #trigger>
                        <n-button text size="small">
                          <template #icon><n-icon :size="16" color="#ff4d4f"><TrashOutline /></n-icon></template>
                        </n-button>
                      </template>
                      确定要删除吗？
                    </n-popconfirm>
                  </n-space>
                </div>
              </div>
            </template>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 新增/编辑待办模态框 -->
    <n-modal v-model:show="showModal" preset="card" :style="{ width: '500px' }" :title="editingTodo ? '编辑待办' : '添加待办'">
      <n-form>
        <n-form-item label="标题" required>
          <n-input v-model:value="todoTitle" placeholder="请输入待办标题" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="todoDescription" type="textarea" placeholder="请输入待办描述" :rows="3" />
        </n-form-item>
        <n-form-item label="状态">
          <n-select v-model:value="todoStatus" :options="statusOptions" />
        </n-form-item>
        <n-form-item label="优先级">
          <n-select v-model:value="todoPriority" :options="priorityOptions" />
        </n-form-item>
        <n-form-item label="截止日期">
          <n-input v-model:value="todoDueDate" type="date" />
        </n-form-item>
        <n-form-item label="关联项目">
          <n-select v-model:value="todoProjectId" :options="projectOptions" placeholder="选择关联项目（可选）" clearable />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" @click="saveTodo">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
:deep(.n-card) {
  border-radius: 12px;
}
</style>
