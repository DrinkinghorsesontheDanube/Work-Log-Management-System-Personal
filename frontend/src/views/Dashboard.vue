<template>
  <div style="display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <n-gradient-text type="info" style="font-size: 24px; font-weight: bold;">
        {{ todayStr }}
      </n-gradient-text>
      <n-space>
        <n-button type="primary" size="medium" @click="showQuickEntry = true">
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          快速记一笔
        </n-button>
        <n-button :type="timerRunning ? 'warning' : 'default'" size="medium" @click="toggleTimer">
          <template #icon>
            <n-icon>{{ timerRunning ? '⏹️' : '⏱️' }}</n-icon>
          </template>
          {{ timerRunning ? `结束计时 ${formatTimer(timerSeconds)}` : '开始计时' }}
        </n-button>
      </n-space>
    </div>

    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen">
      <n-gi>
        <n-card :bordered="true" size="small">
          <n-statistic label="总工时" :value="todayStats.total_hours" precision="1">
            <template #suffix> 小时</template>
          </n-statistic>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card :bordered="true" size="small">
          <n-statistic label="项目性工作" :value="todayStats.project_hours" precision="1">
            <template #suffix> 小时</template>
          </n-statistic>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card :bordered="true" size="small">
          <n-statistic label="事务性工作" :value="todayStats.transaction_hours" precision="1">
            <template #suffix> 小时</template>
          </n-statistic>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card :bordered="true" size="small">
          <n-statistic label="记录数" :value="todayStats.count" />
        </n-card>
      </n-gi>
    </n-grid>

    <n-card :bordered="true" size="small">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <n-gradient-text type="info" style="font-size: 16px; font-weight: bold;">🤖 智能录入</n-gradient-text>
          <n-tag v-if="aiResult" type="success" size="small" round>已生成</n-tag>
        </div>
      </template>
      <n-input
        v-model:value="aiInput"
        type="textarea"
        :rows="3"
        placeholder="输入工作内容描述，AI帮你生成结构化日志，例如：今天上午给王总汇报了项目进展，下午参加了项目评审会"
        @keydown.ctrl.enter="handleAiSubmit"
      />
      <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
        <n-button type="primary" :loading="aiLoading" :disabled="!aiInput.trim()" size="small" @click="handleAiSubmit">
          <template #icon><n-icon><FlashOutline /></n-icon></template>
          AI生成
        </n-button>
        <n-button v-if="aiResult" text type="primary" size="small" @click="applyAiResult">应用到日志</n-button>
      </div>
      <div v-if="aiResult" style="margin-top: 12px; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 14px; line-height: 1.6;">
        <div v-if="aiResult.title"><strong>标题：</strong>{{ aiResult.title }}</div>
        <div v-if="aiResult.category" style="margin-top: 4px;"><strong>分类：</strong>{{ aiResult.category }}</div>
        <div v-if="aiResult.duration" style="margin-top: 4px;"><strong>耗时：</strong>{{ aiResult.duration }}分钟</div>
        <div v-if="aiResult.content" style="margin-top: 4px;"><strong>详情：</strong>{{ aiResult.content }}</div>
      </div>
    </n-card>

    <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
          <n-gi>
            <n-card :bordered="true" size="small">
              <template #header>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <n-gradient-text type="info" style="font-size: 16px; font-weight: bold;">📋 项目列表</n-gradient-text>
                  <n-button text size="tiny" @click="router.push('/projects')">查看全部</n-button>
                </div>
              </template>
              <n-empty v-if="ongoingProjects.length === 0" description="暂无进行中的项目" size="small" />
              <div v-else style="display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto;">
                <div
                  v-for="project in ongoingProjects.slice(0, 5)"
                  :key="project.id"
                  style="padding: 12px; background: #f7fafc; border-radius: 8px; cursor: pointer; transition: all 0.2s;"
                  @click="router.push(`/projects/${project.id}`)"
                  @mouseenter="$event.currentTarget.style.background = '#edf2f7'"
                  @mouseleave="$event.currentTarget.style.background = '#f7fafc'"
                >
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 14px; font-weight: 600; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ project.name }}</div>
                      <div v-if="project.customer" style="font-size: 12px; color: #718096; margin-top: 2px;">{{ project.customer }}</div>
                    </div>
                    <n-tag :type="project.is_closed ? 'default' : 'success'" size="small" round>{{ project.is_closed ? '已完结' : project.stage_label }}</n-tag>
                  </div>
                  <div v-if="getProjectTodos(project.id).length > 0" style="margin-top: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #718096;">
                      <span>待办:</span>
                      <n-tag type="info" size="tiny" round>{{ getProjectTodos(project.id).length }}</n-tag>
                      <span v-if="getProjectTodos(project.id).filter(t => t.priority === 'high').length > 0">
                        <n-tag type="error" size="tiny" round>高危: {{ getProjectTodos(project.id).filter(t => t.priority === 'high').length }}</n-tag>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" size="small">
              <template #header>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <n-gradient-text type="info" style="font-size: 16px; font-weight: bold;">✅ 待办事项</n-gradient-text>
                  <n-button text size="tiny" @click="router.push('/todos')">查看全部</n-button>
                </div>
              </template>
              <n-empty v-if="pendingTodos.length === 0" description="太棒了！暂无待办" size="small" />
              <div v-else style="display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto;">
                <div
                  v-for="todo in pendingTodos.slice(0, 5)"
                  :key="todo.id"
                  style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #f7fafc; border-radius: 8px; transition: all 0.2s;"
                  @mouseenter="$event.currentTarget.style.background = '#edf2f7'"
                  @mouseleave="$event.currentTarget.style.background = '#f7fafc'"
                >
                  <n-checkbox :checked="todo.status === 'done'" @update:checked="toggleTodo(todo, $event)" />
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-size: 14px; font-weight: 500; color: #2d3748; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ todo.title }}</span>
                      <n-tag v-if="todo.project_name" type="info" size="tiny" round @click.stop="router.push(`/projects/${todo.related_project_id}`)" style="cursor: pointer;">{{ todo.project_name }}</n-tag>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap;">
                      <span v-if="todo.due_date" style="font-size: 12px; color: #718096;">截止: {{ todo.due_date }}</span>
                      <span v-if="todo.priority === 'high'" style="font-size: 12px; color: #e53e3e;">高优先级</span>
                    </div>
                  </div>
                </div>
              </div>
            </n-card>
          </n-gi>
        </n-grid>

    <n-alert v-if="todayStats.count === 0" type="info" closable>
      今天还没有工作记录，点击「快速记一笔」开始记录吧！
    </n-alert>

    <n-timeline v-if="todayLogs.length > 0">
      <n-timeline-item
        v-for="log in todayLogs"
        :key="log.id"
        :type="log.category === '项目性工作' ? 'info' : 'default'"
        :time="timeRange(log)"
      >
        <template #header>
          <n-space align="center" size="small">
            <n-tag :type="log.category === '项目性工作' ? 'info' : 'default'" size="small" round>
              {{ log.sub_category }}
            </n-tag>
            <n-tag v-if="log.is_remedy" type="warning" size="tiny">补录</n-tag>
            <n-tag v-if="log.project_name" size="tiny" round>{{ log.project_name }}</n-tag>
          </n-space>
        </template>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <strong>{{ log.title }}</strong>
            <p v-if="log.content" style="margin: 4px 0; color: #888; font-size: 13px; white-space: pre-wrap;">{{ log.content }}</p>
            <div v-if="log.tags && log.tags.length > 0" style="margin-top: 4px;">
              <n-tag v-for="tag in log.tags" :key="tag" size="tiny" style="margin-right: 4px;">{{ tag }}</n-tag>
            </div>
          </div>
          <n-space>
            <n-button quaternary circle size="small" @click="editLog(log)">
              <template #icon><n-icon><CreateOutline /></n-icon></template>
            </n-button>
            <n-popconfirm @positive-click="handleDelete(log.id)">
              <template #trigger>
                <n-button quaternary circle size="small">
                  <template #icon><n-icon><TrashOutline /></n-icon></template>
                </n-button>
              </template>
              确认删除此记录？
            </n-popconfirm>
          </n-space>
        </div>
      </n-timeline-item>
    </n-timeline>

    <n-empty v-else description="暂无记录" />

    <n-drawer v-model:show="showQuickEntry" :width="500" placement="right">
      <n-drawer-content title="快速记一笔" closable>
        <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
          <n-form-item label="工作分类" path="category">
            <n-radio-group v-model:value="form.category">
              <n-radio value="项目性工作">项目性工作</n-radio>
              <n-radio value="事务性工作">事务性工作</n-radio>
            </n-radio-group>
          </n-form-item>

          <n-form-item label="二级分类" path="sub_category">
            <n-select v-model:value="form.sub_category" :options="subCategoryOptions" />
          </n-form-item>

          <n-form-item label="标题" path="title">
            <n-input v-model:value="form.title" placeholder="工作内容标题" />
          </n-form-item>

          <n-grid :cols="2" :x-gap="12">
            <n-gi>
              <n-form-item label="开始时间">
                <n-time-picker v-model:value="form.startTime" format="HH:mm" placeholder="开始时间" clearable />
              </n-form-item>
            </n-gi>
            <n-gi>
              <n-form-item label="结束时间">
                <n-time-picker v-model:value="form.endTime" format="HH:mm" placeholder="结束时间" clearable />
              </n-form-item>
            </n-gi>
          </n-grid>

          <n-form-item v-if="!form.startTime || !form.endTime" label="耗时（分钟）">
            <n-input-number v-model:value="form.duration" :min="0" placeholder="直接输入分钟数" style="width: 100%;" />
          </n-form-item>

          <n-form-item label="关联项目">
            <n-select v-model:value="form.projectId" :options="projectOptions" placeholder="选择关联项目" clearable />
          </n-form-item>

          <n-form-item label="标签">
            <n-dynamic-tags v-model:value="form.tags" />
          </n-form-item>

          <n-form-item v-if="isRemedy" label="标记为补录">
            <n-switch v-model:value="form.isRemedy" />
          </n-form-item>

          <n-form-item label="详细内容">
            <n-input v-model:value="form.content" type="textarea" :rows="4" placeholder="详细描述..." />
          </n-form-item>

          <n-button type="primary" block :loading="saving" @click="handleSave">
            {{ editingId ? '更新' : '保存' }}
          </n-button>
        </n-form>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline, FlashOutline } from '@vicons/ionicons5'
import { getLogs, createLog, updateLog, deleteLog, getCategories, getProjects, createAiEntry, getTodos, updateTodo } from '../api/index.js'
import dayjs from 'dayjs'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const showQuickEntry = ref(false)
const editingId = ref(null)
const saving = ref(false)
const todayLogs = ref([])
const categories = ref({})
const projects = ref([])
const timerRunning = ref(false)
const timerSeconds = ref(0)
let timerInterval = null

const aiInput = ref('')
const aiLoading = ref(false)
const aiResult = ref(null)
const pendingTodos = ref([])

const todayStr = computed(() => dayjs().format('YYYY年MM月DD日 dddd'))
const isRemedy = ref(false)
const formRef = ref(null)

const form = ref({
  category: '项目性工作',
  sub_category: '',
  title: '',
  startTime: null,
  endTime: null,
  duration: null,
  projectId: null,
  tags: [],
  isRemedy: false,
  content: ''
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  sub_category: [{ required: true, message: '请选择二级分类', trigger: 'change' }]
}

const subCategoryOptions = computed(() => {
  const cats = categories.value[form.value.category] || []
  return cats.map(c => ({ label: c, value: c }))
})

const projectOptions = computed(() => {
  return projects.value
    .filter(p => !p.is_closed)
    .map(p => ({ label: `${p.name} (${p.customer || '无客户'})`, value: p.id }))
})

const ongoingProjects = computed(() => {
  return projects.value.filter(p => !p.is_closed)
})

function getProjectTodos(projectId) {
  return pendingTodos.value.filter(todo => todo.related_project_id === projectId)
}

const todayStats = computed(() => {
  const logs = todayLogs.value
  const total_min = logs.reduce((s, l) => s + l.duration_min, 0)
  return {
    total_hours: Math.round(total_min / 60 * 10) / 10,
    project_hours: Math.round(logs.filter(l => l.category === '项目性工作').reduce((s, l) => s + l.duration_min, 0) / 60 * 10) / 10,
    transaction_hours: Math.round(logs.filter(l => l.category === '事务性工作').reduce((s, l) => s + l.duration_min, 0) / 60 * 10) / 10,
    count: logs.length
  }
})

function timeRange(log) {
  if (log.start_time && log.end_time) {
    return `${log.start_time} - ${log.end_time} (${log.duration_min}min)`
  }
  return `${log.duration_min}分钟`
}

function formatTimer(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function toggleTimer() {
  if (timerRunning.value) {
    clearInterval(timerInterval)
    timerRunning.value = false
    form.value.duration = Math.round(timerSeconds.value / 60)
    form.value.startTime = null
    form.value.endTime = null
    showQuickEntry.value = true
  } else {
    timerSeconds.value = 0
    timerRunning.value = true
    timerInterval = setInterval(() => {
      timerSeconds.value++
    }, 1000)
    message.success('计时已开始，结束时点击「结束计时」')
  }
}

watch(isRemedy, (val) => {
  form.value.isRemedy = val
})

async function loadTodayLogs() {
  try {
    const res = await getLogs({ date: dayjs().format('YYYY-MM-DD'), per_page: 100 })
    todayLogs.value = res.data.items
  } catch (e) {
    console.error(e)
  }
}

async function loadCategories() {
  try {
    const res = await getCategories()
    categories.value = res.data
  } catch (e) {
    console.error(e)
  }
}

async function loadProjects() {
  try {
    const res = await getProjects()
    projects.value = res.data
  } catch (e) {
    console.error(e)
  }
}

function resetForm() {
  form.value = {
    category: '项目性工作',
    sub_category: '',
    title: '',
    startTime: null,
    endTime: null,
    duration: null,
    projectId: null,
    tags: [],
    isRemedy: false,
    content: ''
  }
  editingId.value = null
  isRemedy.value = false
}

function editLog(log) {
  editingId.value = log.id
  form.value = {
    category: log.category,
    sub_category: log.sub_category,
    title: log.title,
    startTime: log.start_time ? dayjs(`2000-01-01 ${log.start_time}`).valueOf() : null,
    endTime: log.end_time ? dayjs(`2000-01-01 ${log.end_time}`).valueOf() : null,
    duration: log.duration_min,
    projectId: log.related_project_id,
    tags: log.tags || [],
    isRemedy: log.is_remedy,
    content: log.content || ''
  }
  isRemedy.value = log.is_remedy
  showQuickEntry.value = true
}

async function handleSave() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    const data = {
      log_date: dayjs().format('YYYY-MM-DD'),
      category: form.value.category,
      sub_category: form.value.sub_category,
      title: form.value.title,
      content: form.value.content,
      related_project_id: form.value.projectId,
      tags: form.value.tags,
      is_remedy: form.value.isRemedy
    }

    if (form.value.startTime && form.value.endTime) {
      data.start_time = dayjs(form.value.startTime).format('HH:mm')
      data.end_time = dayjs(form.value.endTime).format('HH:mm')
      const diff = dayjs(form.value.endTime).diff(dayjs(form.value.startTime), 'minute')
      data.duration_min = diff > 0 ? diff : 0
    } else {
      data.duration_min = form.value.duration || 0
    }

    if (editingId.value) {
      await updateLog(editingId.value, data)
      message.success('已更新')
    } else {
      await createLog(data)
      message.success('保存成功')
    }

    showQuickEntry.value = false
    resetForm()
    await loadTodayLogs()
  } catch (e) {
    message.error('保存失败: ' + (e.response?.data?.error || e.message))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id) {
  try {
    await deleteLog(id)
    message.success('已删除')
    await loadTodayLogs()
  } catch (e) {
    message.error('删除失败')
  }
}

async function handleAiSubmit() {
  if (!aiInput.value.trim()) return
  aiLoading.value = true
  try {
    const res = await createAiEntry({ text: aiInput.value })
    aiResult.value = res.data
    message.success('AI生成成功')
  } catch (e) {
    message.error('AI生成失败：' + (e.response?.data?.error || e.message))
  } finally {
    aiLoading.value = false
  }
}

function applyAiResult() {
  if (!aiResult.value) return
  form.value.title = aiResult.value.title || ''
  form.value.content = aiResult.value.content || ''
  form.value.duration = aiResult.value.duration ? parseInt(aiResult.value.duration) : null
  if (aiResult.value.category) {
    form.value.category = aiResult.value.category
  }
  showQuickEntry.value = true
  aiInput.value = ''
  aiResult.value = null
}

async function loadTodos() {
  try {
    const res = await getTodos({ status: 'pending' })
    pendingTodos.value = res.data
  } catch (e) {
    console.error(e)
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

watch(showQuickEntry, (val) => {
  if (!val) resetForm()
})

onMounted(() => {
  loadTodayLogs()
  loadCategories()
  loadProjects()
  loadTodos()
})
</script>
