<template>
  <div>
    <div style="font-size: 26px; font-weight: 700; color: #2c3e50; letter-spacing: -0.5px; margin-bottom: 24px;">
      待办事宜
    </div>

    <div style="max-width: 1600px;">
      <div style="
        background: #fff;
        border: 1px solid #edf2f7;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        margin-bottom: 20px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; gap: 12px; align-items: center;">
            <n-radio-group v-model:value="status" size="small" @update:value="loadTodos">
              <n-radio-button value="pending">待处理</n-radio-button>
              <n-radio-button value="done">已完成</n-radio-button>
            </n-radio-group>
          </div>
        </div>

        <div style="margin-top: 20px;">
          <n-input
            v-model:value="newTodo"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="添加新待办，例如：明天下班前发报价清单给张总"
            @keydown.ctrl.enter.prevent="handleCreate"
          />
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 16px;">
            <n-space>
              <n-select
                v-model:value="newPriority"
                :options="priorityOptions"
                placeholder="优先级"
                style="width: 120px;"
                size="small"
              />
              <n-select
                v-model:value="newProjectId"
                :options="projectOptions"
                placeholder="关联项目"
                clearable
                style="width: 180px;"
                size="small"
              />
              <n-date-picker
                v-model:value="newDueDate"
                type="date"
                placeholder="计划完成时间"
                clearable
                size="small"
                style="width: 150px;"
              />
              <n-time-picker
                v-model:value="newStartTime"
                format="HH:mm"
                placeholder="开始时间"
                clearable
                size="small"
                style="width: 100px;"
              />
            </n-space>
            <n-button type="primary" :disabled="!newTodo.trim()" :loading="saving" @click="handleCreate">添加待办</n-button>
          </div>
        </div>
      </div>

      <div style="
        background: #fff;
        border: 1px solid #edf2f7;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.02);
      ">
        <n-empty v-if="todos.length === 0" :description="status === 'pending' ? '太棒了！暂无待办' : '暂无已完成事项'" />
        <div v-else style="display: flex; flex-direction: column; gap: 16px;">
          <div
            v-for="todo in todos"
            :key="todo.id"
            style="
              display: flex;
              align-items: flex-start;
              gap: 16px;
              padding: 20px;
              background: #fafbfc;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
              transition: all 0.2s;
            "
            @mouseenter="$event.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'"
            @mouseleave="$event.currentTarget.style.boxShadow = 'none'"
          >
            <n-checkbox :checked="todo.status === 'done'" @update:checked="toggleTodo(todo, $event)" />
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                <strong
                  :style="{
                    fontSize: '17px',
                    color: todo.status === 'done' ? '#a0aec0' : '#2d3748',
                    textDecoration: todo.status === 'done' ? 'line-through' : 'none',
                    fontWeight: 600
                  }"
                >{{ todo.title }}</strong>
                <n-tag v-if="todo.priority === 'high'" type="error" size="small" round>高优先级</n-tag>
                <n-tag v-else-if="todo.priority === 'low'" type="default" size="small" round>低优先级</n-tag>
                <n-tag v-if="todo.project_name" type="info" size="small" round>{{ todo.project_name }}</n-tag>
              </div>
              <div v-if="todo.detail" style="font-size: 15px; color: #4a5568; margin-bottom: 12px; line-height: 1.6; white-space: pre-wrap;">
                {{ todo.detail }}
              </div>
              <div style="display: flex; gap: 20px; font-size: 14px; color: #718096;">
                <span v-if="todo.create_time" style="display: flex; align-items: center; gap: 6px;">
                  <n-icon size="14"><CreateOutline /></n-icon>
                  创建: {{ todo.create_time.split(' ')[0] }}
                </span>
                <span v-if="todo.due_date" style="display: flex; align-items: center; gap: 6px;" :style="{ color: status === 'pending' && dayjs().isAfter(dayjs(todo.due_date), 'day') ? '#e53e3e' : '#718096' }">
                  <n-icon size="14"><TimeOutline /></n-icon>
                  截止: {{ todo.due_date }}
                </span>
                <span v-if="todo.start_time" style="display: flex; align-items: center; gap: 6px;">
                  <n-icon size="14"><PlayCircleOutline /></n-icon>
                  开始: {{ todo.start_time }}
                </span>
                <span v-if="todo.complete_time" style="display: flex; align-items: center; gap: 6px; color: '#38a169';">
                  <n-icon size="14"><CheckmarkCircleOutline /></n-icon>
                  完成: {{ todo.complete_time.split(' ')[0] }}
                </span>
              </div>
            </div>
            <n-space>
              <n-button quaternary size="small" @click="startEdit(todo)">
                <template #icon><n-icon size="16"><CreateOutline /></n-icon></template>
                编辑
              </n-button>
              <n-popconfirm @positive-click="handleDelete(todo.id)">
                <template #trigger>
                  <n-button quaternary size="small" type="error" style="border-radius: 8px;">
                    <template #icon><n-icon size="16"><TrashOutline /></n-icon></template>
                    删除
                  </n-button>
                </template>
                确认删除此待办？
              </n-popconfirm>
            </n-space>
          </div>
        </div>
      </div>
    </div>

    <n-modal v-model:show="showEditTodo" preset="card" title="编辑待办" style="width: 500px;">
      <n-form>
        <n-form-item label="标题">
          <n-input v-model:value="editingTodo.newTitle" />
        </n-form-item>
        <n-form-item label="详情">
          <n-input v-model:value="editingTodo.newDetail" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </n-form-item>
        <n-grid :cols="2" :x-gap="12">
          <n-gi>
            <n-form-item label="优先级">
              <n-select v-model:value="editingTodo.newPriority" :options="priorityOptions" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="关联项目">
              <n-select v-model:value="editingTodo.newProjectId" :options="projectOptions" clearable />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="计划完成">
              <n-date-picker v-model:value="editingTodo.newDueDate" type="date" clearable style="width: 100%;" />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="开始时间">
              <n-time-picker v-model:value="editingTodo.newStartTime" format="HH:mm" clearable style="width: 100%;" />
            </n-form-item>
          </n-gi>
        </n-grid>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="editingTodo = null">取消</n-button>
          <n-button type="primary" :loading="saving" @click="saveEdit">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { CreateOutline, TimeOutline, PlayCircleOutline, CheckmarkCircleOutline, TrashOutline } from '@vicons/ionicons5'
import { createTodo, deleteTodo, getTodos, updateTodo, getProjects } from '../api/index.js'
import dayjs from 'dayjs'

const message = useMessage()
const todos = ref([])
const projects = ref([])
const status = ref('pending')
const newTodo = ref('')
const newPriority = ref('medium')
const newDueDate = ref(null)
const newStartTime = ref(null)
const newProjectId = ref(null)
const saving = ref(false)
const editingTodo = ref(null)

const priorityOptions = [
  { label: '高优先级', value: 'high' },
  { label: '中优先级', value: 'medium' },
  { label: '低优先级', value: 'low' }
]

const projectOptions = computed(() => {
  return projects.value
    .filter(p => !p.is_closed)
    .map(p => ({ label: p.name, value: p.id }))
})

const showEditTodo = computed({
  get: () => editingTodo.value !== null,
  set: (value) => { if (!value) editingTodo.value = null }
})

async function loadTodos() {
  try {
    const res = await getTodos({ status: status.value })
    todos.value = res.data
  } catch (e) {
    message.error('加载待办失败')
  }
}

async function loadProjects() {
  try {
    const res = await getProjects()
    projects.value = res.data
  } catch (e) {
    message.error('加载项目失败')
  }
}

async function handleCreate() {
  const text = newTodo.value.trim()
  if (!text) return
  saving.value = true
  try {
    const dueDate = newDueDate.value ? dayjs(newDueDate.value).format('YYYY-MM-DD') : (text.includes('明天') ? dayjs().add(1, 'day').format('YYYY-MM-DD') : null)
    const startTime = newStartTime.value ? dayjs(newStartTime.value).format('HH:mm') : null
    
    await createTodo({
      title: text.replace(/明天|今天/g, '').trim() || text,
      detail: text,
      due_date: dueDate,
      priority: newPriority.value,
      start_time: startTime,
      related_project_id: newProjectId.value
    })
    
    newTodo.value = ''
    newPriority.value = 'medium'
    newDueDate.value = null
    newStartTime.value = null
    newProjectId.value = null
    message.success('待办已添加')
    await loadTodos()
  } catch (e) {
    message.error('添加失败')
  } finally {
    saving.value = false
  }
}

async function toggleTodo(todo, checked) {
  try {
    await updateTodo(todo.id, { status: checked ? 'done' : 'pending' })
    message.success(checked ? '已完成' : '已退回待办')
    await loadTodos()
  } catch (e) {
    message.error('更新失败')
  }
}

async function handleDelete(id) {
  try {
    await deleteTodo(id)
    message.success('已删除')
    await loadTodos()
  } catch (e) {
    message.error('删除失败')
  }
}

function startEdit(todo) {
  editingTodo.value = {
    ...todo,
    newTitle: todo.title,
    newDetail: todo.detail,
    newDueDate: todo.due_date ? dayjs(todo.due_date).valueOf() : null,
    newStartTime: todo.start_time ? dayjs(`2000-01-01 ${todo.start_time}`).valueOf() : null,
    newPriority: todo.priority,
    newProjectId: todo.related_project_id
  }
}

async function saveEdit() {
  if (!editingTodo.value) return
  saving.value = true
  try {
    const dueDate = editingTodo.value.newDueDate ? dayjs(editingTodo.value.newDueDate).format('YYYY-MM-DD') : null
    const startTime = editingTodo.value.newStartTime ? dayjs(editingTodo.value.newStartTime).format('HH:mm') : null
    
    await updateTodo(editingTodo.value.id, {
      title: editingTodo.value.newTitle,
      detail: editingTodo.value.newDetail,
      due_date: dueDate,
      start_time: startTime,
      priority: editingTodo.value.newPriority,
      related_project_id: editingTodo.value.newProjectId
    })
    
    message.success('更新成功')
    editingTodo.value = null
    await loadTodos()
  } catch (e) {
    message.error('更新失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadTodos()
  loadProjects()
})
</script>
