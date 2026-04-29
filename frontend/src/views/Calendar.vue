<template>
  <div>
    <n-gradient-text type="info" style="font-size: 24px; font-weight: bold; display: block; margin-bottom: 16px;">
      日志日历
    </n-gradient-text>

    <n-grid :cols="2" :x-gap="16" :y-gap="16">
      <n-gi :span="1">
        <n-grid :cols="4" :x-gap="8" :y-gap="8" style="margin-bottom: 12px;">
          <n-gi>
            <n-card :bordered="true" size="small">
              <n-statistic label="总工时" :value="monthStats.totalHours" precision="1">
                <template #suffix> h</template>
              </n-statistic>
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" size="small">
              <n-statistic label="日均" :value="monthStats.avgHours" precision="1">
                <template #suffix> h</template>
              </n-statistic>
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" size="small">
              <n-statistic label="记录" :value="monthStats.count" />
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" size="small">
              <n-statistic label="天数" :value="monthStats.activeDays" />
            </n-card>
          </n-gi>
        </n-grid>

        <n-card :bordered="true" size="small">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <n-space>
              <n-button @click="prevMonth" quaternary size="small">
                <template #icon><n-icon><ChevronBackOutline /></n-icon></template>
              </n-button>
              <n-button @click="goToday" size="tiny" secondary>今天</n-button>
              <n-button @click="nextMonth" quaternary size="small">
                <template #icon><n-icon><ChevronForwardOutline /></n-icon></template>
              </n-button>
            </n-space>
            <n-gradient-text type="info" style="font-size: 16px; font-weight: bold;">
              {{ currentYear }}年{{ currentMonth + 1 }}月
            </n-gradient-text>
            <div style="font-size: 11px; color: #888;">
              <n-space size="small" align="center">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #e8f5e9;"></span>
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #c8e6c9;"></span>
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #a5d6a7;"></span>
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #66bb6a;"></span>
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: #43a047;"></span>
              </n-space>
            </div>
          </div>

          <n-grid :cols="7" :x-gap="2" :y-gap="2">
            <n-gi v-for="day in weekDays" :key="day">
              <div style="text-align: center; font-weight: bold; padding: 3px 0; font-size: 12px; color: #888;">{{ day }}</div>
            </n-gi>
            <n-gi v-for="(item, idx) in calendarDays" :key="idx">
              <div :style="dayCellStyle(item)" @click="selectDay(item)">
                <div :style="{ fontWeight: item.isToday ? 'bold' : 'normal', fontSize: '12px', color: item.isToday ? '#2080f0' : 'inherit' }">
                  {{ item.day }}
                </div>
                <div v-if="item.total > 0" style="font-size: 9px; font-weight: bold; line-height: 1.2;">{{ item.total }}h</div>
                <div v-else-if="item.isRemedy" style="font-size: 8px; color: #f0a020; line-height: 1.2;">补</div>
              </div>
            </n-gi>
          </n-grid>
        </n-card>
      </n-gi>

      <n-gi :span="1">
        <n-card v-if="selectedDate" :bordered="true" size="small" style="margin-bottom: 12px;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 15px; font-weight: bold;">{{ dayjs(selectedDate).format('M月D日') }}</span>
              <n-button size="small" type="primary" @click="addLogForDate">
                <template #icon><n-icon><AddOutline /></n-icon></template>
                补录
              </n-button>
            </div>
          </template>

          <div v-if="selectedLogs.length > 0" style="margin-bottom: 8px; font-size: 13px; display: flex; gap: 16px; flex-wrap: wrap;">
            <span style="color: #2080f0;">项目 {{ dayProjectMin }}min</span>
            <span style="color: #18a058;">事务 {{ dayTransactionMin }}min</span>
            <span style="font-weight: bold; color: #333;">合计 {{ dayTotalMin }}min ({{ (dayTotalMin/60).toFixed(1) }}h)</span>
          </div>

          <n-empty v-if="selectedLogs.length === 0" description="暂无记录" style="padding: 16px 0;" />

          <div v-else style="display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto;">
            <div v-for="log in selectedLogs" :key="log.id" style="border: 1px solid #efefef; border-radius: 6px; padding: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1; min-width: 0;">
                  <n-space size="small" align="center" style="margin-bottom: 4px;">
                    <n-tag :type="log.category === '项目性工作' ? 'info' : 'default'" size="small" round>{{ log.sub_category }}</n-tag>
                    <span v-if="log.is_remedy" style="font-size: 12px; color: #f0a020;">补录</span>
                  </n-space>
                  <div style="font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ log.title }}</div>
                  <div style="font-size: 12px; color: #888; margin-top: 2px;">{{ log.duration_min }}min{{ log.start_time ? ' ' + log.start_time : '' }}</div>
                </div>
                <n-space size="small" style="flex-shrink: 0;">
                  <n-button quaternary circle size="small" @click="editLog(log)">
                    <template #icon><n-icon size="16"><CreateOutline /></n-icon></template>
                  </n-button>
                  <n-popconfirm @positive-click="handleDelete(log.id)">
                    <template #trigger>
                      <n-button quaternary circle size="small">
                        <template #icon><n-icon size="16"><TrashOutline /></n-icon></template>
                      </n-button>
                    </template>
                    确认删除？
                  </n-popconfirm>
                </n-space>
              </div>
              <div v-if="log.content" style="font-size: 12px; color: #999; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ log.content }}</div>
            </div>
          </div>
        </n-card>

        <n-card v-else :bordered="true" size="small" style="margin-bottom: 12px;">
          <div style="text-align: center; padding: 30px 0; color: #888; font-size: 14px;">
            点击日期查看详情
          </div>
        </n-card>

        <n-card :bordered="true" size="small">
          <template #header>
            <span style="font-size: 15px; font-weight: bold;">{{ currentYear }}年{{ currentMonth + 1 }}月</span>
          </template>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">项目性</span>
              <span style="font-weight: bold; color: #2080f0;">{{ monthStats.projectHours }}h</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">事务性</span>
              <span style="font-weight: bold; color: #18a058;">{{ monthStats.transactionHours }}h</span>
            </div>
            <n-divider style="margin: 2px 0;" />
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">总计</span>
              <span style="font-weight: bold;">{{ monthStats.totalHours }}h</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">记录天数</span>
              <span style="font-weight: bold;">{{ monthStats.activeDays }}天</span>
            </div>
          </div>
        </n-card>
      </n-gi>
    </n-grid>

    <n-drawer v-model:show="showDrawer" :width="500" placement="right">
      <n-drawer-content :title="editingId ? '编辑日志' : '补录日志'" closable>
        <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
          <n-form-item label="日期">
            <n-date-picker v-model:value="form.logDate" type="date" />
          </n-form-item>
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
                <n-time-picker v-model:value="form.startTime" format="HH:mm" clearable />
              </n-form-item>
            </n-gi>
            <n-gi>
              <n-form-item label="结束时间">
                <n-time-picker v-model:value="form.endTime" format="HH:mm" clearable />
              </n-form-item>
            </n-gi>
          </n-grid>
          <n-form-item v-if="!form.startTime || !form.endTime" label="耗时（分钟）">
            <n-input-number v-model:value="form.duration" :min="0" style="width: 100%;" />
          </n-form-item>
          <n-form-item label="关联项目">
            <n-select v-model:value="form.projectId" :options="projectOptions" clearable />
          </n-form-item>
          <n-form-item label="标签">
            <n-dynamic-tags v-model:value="form.tags" />
          </n-form-item>
          <n-form-item label="标记为补录">
            <n-switch v-model:value="form.isRemedy" />
          </n-form-item>
          <n-form-item label="详细内容">
            <n-input v-model:value="form.content" type="textarea" :rows="4" />
          </n-form-item>
          <n-button type="primary" block :loading="saving" @click="handleSave">保存</n-button>
        </n-form>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { ChevronBackOutline, ChevronForwardOutline, AddOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5'
import { getLogs, createLog, updateLog, deleteLog, getCategories, getProjects } from '../api/index.js'
import dayjs from 'dayjs'

const message = useMessage()
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const currentYear = ref(dayjs().year())
const currentMonth = ref(dayjs().month())
const selectedDate = ref(null)
const selectedLogs = ref([])
const logsMap = ref({})
const categories = ref({})
const projects = ref([])
const showDrawer = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formRef = ref(null)

const form = ref({
  logDate: dayjs().valueOf(),
  category: '项目性工作',
  sub_category: '',
  title: '',
  startTime: null,
  endTime: null,
  duration: null,
  projectId: null,
  tags: [],
  isRemedy: true,
  content: ''
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  category: [{ required: true, trigger: 'change' }],
  sub_category: [{ required: true, trigger: 'change' }]
}

const dayTotalMin = computed(() => selectedLogs.value.reduce((s, l) => s + l.duration_min, 0))
const dayProjectMin = computed(() => selectedLogs.value.filter(l => l.category === '项目性工作').reduce((s, l) => s + l.duration_min, 0))
const dayTransactionMin = computed(() => selectedLogs.value.filter(l => l.category === '事务性工作').reduce((s, l) => s + l.duration_min, 0))

const monthStats = computed(() => {
  let totalMin = 0, projectMin = 0, transactionMin = 0, count = 0
  const activeDates = new Set()
  for (const logs of Object.values(logsMap.value)) {
    for (const l of logs) {
      totalMin += l.duration_min
      if (l.category === '项目性工作') projectMin += l.duration_min
      else transactionMin += l.duration_min
      count++
      activeDates.add(l.log_date)
    }
  }
  const daysInMonth = dayjs(new Date(currentYear.value, currentMonth.value + 1, 0)).date()
  const today = dayjs()
  const daysSoFar = today.year() === currentYear.value && today.month() === currentMonth.value
    ? today.date() : daysInMonth
  return {
    totalHours: Math.round(totalMin / 60 * 10) / 10,
    projectHours: Math.round(projectMin / 60 * 10) / 10,
    transactionHours: Math.round(transactionMin / 60 * 10) / 10,
    avgHours: daysSoFar > 0 ? Math.round(totalMin / 60 / daysSoFar * 10) / 10 : 0,
    count,
    activeDays: activeDates.size
  }
})

const subCategoryOptions = computed(() => {
  const cats = categories.value[form.value.category] || []
  return cats.map(c => ({ label: c, value: c }))
})

const projectOptions = computed(() => {
  return projects.value.filter(p => !p.is_closed).map(p => ({
    label: `${p.name} (${p.customer || ''})`,
    value: p.id
  }))
})

const calendarDays = computed(() => {
  const firstDay = dayjs(new Date(currentYear.value, currentMonth.value, 1))
  const lastDay = firstDay.endOf('month')
  const startDow = firstDay.day()
  const days = []
  for (let i = 0; i < startDow; i++) {
    days.push({ day: '', total: 0, isToday: false, isEmpty: true, isRemedy: false, hasLog: false })
  }
  for (let d = 1; d <= lastDay.date(); d++) {
    const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const logs = logsMap.value[dateStr] || []
    const total = logs.reduce((s, l) => s + l.duration_min, 0)
    const isToday = dateStr === dayjs().format('YYYY-MM-DD')
    const hasRemedy = logs.some(l => l.is_remedy)
    days.push({
      day: d, date: dateStr, total: Math.round(total / 60 * 10) / 10,
      isToday, isEmpty: false, isRemedy: hasRemedy, hasLog: logs.length > 0, minutes: total
    })
  }
  return days
})

function heatColor(minutes) {
  if (minutes === 0) return 'transparent'
  const h = Math.min(minutes / 480, 1)
  if (h <= 0.25) return '#e8f5e9'
  if (h <= 0.5) return '#c8e6c9'
  if (h <= 0.75) return '#a5d6a7'
  if (h <= 1) return '#66bb6a'
  return '#43a047'
}

function dayCellStyle(item) {
  const isSelected = selectedDate.value === item.date
  return {
    border: isSelected ? '2px solid #2080f0' : item.hasLog ? '1px solid #e0e0e0' : '1px solid transparent',
    borderRadius: '4px',
    padding: '4px 2px',
    minHeight: '44px',
    cursor: item.isEmpty ? 'default' : 'pointer',
    backgroundColor: item.isToday ? '#f0f7ff' : (item.hasLog ? heatColor(item.minutes) : 'transparent'),
    opacity: item.isEmpty ? 0.3 : 1,
    transition: 'all 0.2s',
    textAlign: 'center',
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
  }
}

function goToday() {
  currentYear.value = dayjs().year()
  currentMonth.value = dayjs().month()
  selectedDate.value = dayjs().format('YYYY-MM-DD')
  loadMonthLogs()
}

function prevMonth() {
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- }
  else { currentMonth.value-- }
  loadMonthLogs()
}

function nextMonth() {
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ }
  else { currentMonth.value++ }
  loadMonthLogs()
}

async function loadMonthLogs() {
  const start = dayjs(new Date(currentYear.value, currentMonth.value, 1)).format('YYYY-MM-DD')
  const end = dayjs(new Date(currentYear.value, currentMonth.value + 1, 0)).format('YYYY-MM-DD')
  try {
    const res = await getLogs({ start_date: start, end_date: end, per_page: 500 })
    const map = {}
    for (const log of res.data.items) {
      if (!map[log.log_date]) map[log.log_date] = []
      map[log.log_date].push(log)
    }
    logsMap.value = map
    if (selectedDate.value && map[selectedDate.value]) selectedLogs.value = map[selectedDate.value]
    else if (selectedDate.value) selectedLogs.value = []
  } catch (e) { console.error(e) }
}

function selectDay(item) {
  if (item.isEmpty) return
  selectedDate.value = item.date
  selectedLogs.value = logsMap.value[item.date] || []
}

function addLogForDate() {
  editingId.value = null
  form.value = {
    logDate: dayjs(selectedDate.value).valueOf(), category: '项目性工作',
    sub_category: '', title: '', startTime: null, endTime: null, duration: null,
    projectId: null, tags: [], isRemedy: true, content: ''
  }
  showDrawer.value = true
}

function editLog(log) {
  editingId.value = log.id
  form.value = {
    logDate: dayjs(log.log_date).valueOf(), category: log.category,
    sub_category: log.sub_category, title: log.title,
    startTime: log.start_time ? dayjs(`2000-01-01 ${log.start_time}`).valueOf() : null,
    endTime: log.end_time ? dayjs(`2000-01-01 ${log.end_time}`).valueOf() : null,
    duration: log.duration_min, projectId: log.related_project_id,
    tags: log.tags || [], isRemedy: log.is_remedy, content: log.content || ''
  }
  showDrawer.value = true
}

async function handleSave() {
  try { await formRef.value.validate() } catch { return }
  saving.value = true
  try {
    const data = {
      log_date: dayjs(form.value.logDate).format('YYYY-MM-DD'),
      category: form.value.category, sub_category: form.value.sub_category,
      title: form.value.title, content: form.value.content,
      related_project_id: form.value.projectId, tags: form.value.tags,
      is_remedy: form.value.isRemedy
    }
    if (form.value.startTime && form.value.endTime) {
      data.start_time = dayjs(form.value.startTime).format('HH:mm')
      data.end_time = dayjs(form.value.endTime).format('HH:mm')
      data.duration_min = Math.max(0, dayjs(form.value.endTime).diff(dayjs(form.value.startTime), 'minute'))
    } else {
      data.duration_min = form.value.duration || 0
    }
    if (editingId.value) { await updateLog(editingId.value, data); message.success('已更新') }
    else { await createLog(data); message.success('保存成功') }
    showDrawer.value = false
    await loadMonthLogs()
    if (selectedDate.value && logsMap.value[selectedDate.value]) selectedLogs.value = logsMap.value[selectedDate.value]
  } catch (e) { message.error('保存失败') }
  finally { saving.value = false }
}

async function handleDelete(id) {
  try {
    await deleteLog(id)
    message.success('已删除')
    await loadMonthLogs()
    if (selectedDate.value && logsMap.value[selectedDate.value]) selectedLogs.value = logsMap.value[selectedDate.value]
    else if (selectedDate.value) selectedLogs.value = []
  } catch (e) { message.error('删除失败') }
}

onMounted(() => {
  loadMonthLogs()
  getCategories().then(r => categories.value = r.data)
  getProjects().then(r => projects.value = r.data)
  selectedDate.value = dayjs().format('YYYY-MM-DD')
})
</script>
