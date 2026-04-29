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
import { useMessage, useDialog } from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5'
import { getLogs, createLog, updateLog, deleteLog, getCategories, getProjects } from '../api/index.js'
import dayjs from 'dayjs'

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

watch(showQuickEntry, (val) => {
  if (!val) resetForm()
})

onMounted(() => {
  loadTodayLogs()
  loadCategories()
  loadProjects()
})
</script>
