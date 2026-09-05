<script setup lang="ts">
import { ref, onMounted, computed, inject } from 'vue'
import { useWorkLogsStore } from '../stores/workLogs'
import { useProjectsStore } from '../stores/projects'
import { useClientsStore } from '../stores/clients'
import { useTodosStore } from '../stores/todos'
import { WORK_CATEGORIES } from '../types'
import type { WorkLog, WorkCategoryId, Report } from '../types'
import { storage } from '../utils/storage'
import { chatWithAI, isAiConfigured } from '../services/aiService'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { formatDateTime, todayStr } from '../utils/date'
import { message } from '../utils/notify'

const workLogsStore = useWorkLogsStore()
const showAiConfigPrompt = inject<() => void>('showAiConfigPrompt', () => {})
const projectsStore = useProjectsStore()
const clientsStore = useClientsStore()
const todosStore = useTodosStore()

const currentDate = ref(new Date())
const selectedDate = ref(todayStr())
const showModal = ref(false)
const logContent = ref('')
const selectedProjectId = ref<string | null>(null)
const selectedCategoryId = ref<WorkCategoryId>('other')
const editingLogId = ref<string | null>(null)

const summaryTab = ref<'day' | 'week' | 'month'>('day')
const rangeStart = ref('')
const rangeEnd = ref('')
const rangePreset = ref('month')

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function initRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  rangeStart.value = fmt(new Date(y, m, 1))
  rangeEnd.value = fmt(now)
}
initRange()

function setRangePreset(preset: string) {
  rangePreset.value = preset
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  if (preset === 'week') {
    const day = now.getDay()
    rangeStart.value = fmt(new Date(y, m, d - day))
    rangeEnd.value = fmt(now)
  } else if (preset === 'month') {
    rangeStart.value = fmt(new Date(y, m, 1))
    rangeEnd.value = fmt(now)
  } else if (preset === 'quarter') {
    const qm = Math.floor(m / 3) * 3
    rangeStart.value = fmt(new Date(y, qm, 1))
    rangeEnd.value = fmt(now)
  } else if (preset === 'year') {
    rangeStart.value = fmt(new Date(y, 0, 1))
    rangeEnd.value = fmt(now)
  }
}

const rangeLogs = computed(() =>
  workLogsStore.workLogs.filter(l => l.date >= rangeStart.value && l.date <= rangeEnd.value)
)

const rangeStats = computed(() => {
  const logs = rangeLogs.value
  const catMap: Record<string, number> = {}
  const projMap: Record<string, number> = {}
  const clientMap: Record<string, number> = {}
  for (const l of logs) {
    const cat = l.categoryId || 'other'
    catMap[cat] = (catMap[cat] || 0) + 1
    if (l.projectId) projMap[l.projectId] = (projMap[l.projectId] || 0) + 1
    if (l.clientId) clientMap[l.clientId] = (clientMap[l.clientId] || 0) + 1
  }
  const catList = Object.entries(catMap)
    .map(([id, count]) => ({ id: id as WorkCategoryId, count, ...(WORK_CATEGORIES.find(c => c.id === id) || { name: '其他', icon: '📌', color: '#94a3b8' }) }))
    .sort((a, b) => b.count - a.count)
  const projList = Object.entries(projMap)
    .map(([id, count]) => ({ id, count, name: projectsStore.projects.find(p => p.id === id)?.name || '未知' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const clientList = Object.entries(clientMap)
    .map(([id, count]) => ({ id, count, name: clientsStore.clients.find(c => c.id === id)?.name || '未知' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const dateSet = new Set(logs.map(l => l.date))
  return { total: logs.length, days: dateSet.size, catList, projList, clientList }
})

const projectOptions = computed(() =>
  projectsStore.projects.map(p => ({ label: p.name, value: p.id }))
)

const loggedDates = computed(() => {
  const dates: Record<string, boolean> = {}
  workLogsStore.workLogs.forEach(log => { dates[log.date] = true })
  return dates
})

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days: Array<{ date: number; dateStr: string; isCurrentMonth: boolean; isToday: boolean; hasLog: boolean }> = []
  for (let i = firstDay.getDay() - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    const ds = fmt(d)
    days.push({ date: d.getDate(), dateStr: ds, isCurrentMonth: false, isToday: false, hasLog: !!loggedDates.value[ds] })
  }
  const today = new Date()
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    const ds = fmt(d)
    days.push({ date: i, dateStr: ds, isCurrentMonth: true, isToday: d.toDateString() === today.toDateString(), hasLog: !!loggedDates.value[ds] })
  }
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    const ds = fmt(d)
    days.push({ date: d.getDate(), dateStr: ds, isCurrentMonth: false, isToday: false, hasLog: !!loggedDates.value[ds] })
  }
  return days
})

function prevMonth() {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() - 1)
  currentDate.value = d
}

function nextMonth() {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() + 1)
  currentDate.value = d
}

function goToday() {
  currentDate.value = new Date()
  selectedDate.value = todayStr()
}

function selectDate(dateStr: string) {
  selectedDate.value = dateStr
  summaryTab.value = 'day'
}

function weekRangeOf(dateStr: string): [string, string] {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return [fmt(start), fmt(end)]
}

const summaryLogs = computed(() => {
  if (summaryTab.value === 'day') return workLogsStore.workLogs.filter(l => l.date === selectedDate.value)
  if (summaryTab.value === 'week') {
    const [s, e] = weekRangeOf(selectedDate.value)
    return workLogsStore.workLogs.filter(l => l.date >= s && l.date <= e).sort((a, b) => a.date.localeCompare(b.date))
  }
  const d = new Date(selectedDate.value + 'T00:00:00')
  const ms = fmt(new Date(d.getFullYear(), d.getMonth(), 1))
  const me = fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  return workLogsStore.workLogs.filter(l => l.date >= ms && l.date <= me).sort((a, b) => a.date.localeCompare(b.date))
})

/** 日志全文搜索：跨全部日期，按内容或所属项目名匹配 */
const logSearch = ref('')
const searchResults = computed(() => {
  const q = logSearch.value.trim().toLowerCase()
  if (!q) return []
  return workLogsStore.workLogs
    .filter(l => {
      if (l.content.toLowerCase().includes(q)) return true
      const proj = l.projectId ? getProjectName(l.projectId) : ''
      return proj.toLowerCase().includes(q)
    })
    .sort((a, b) => b.date.localeCompare(a.date))
})

const summaryTitle = computed(() => {
  if (summaryTab.value === 'day') return selectedDate.value
  if (summaryTab.value === 'week') {
    const [s, e] = weekRangeOf(selectedDate.value)
    return `${s} ~ ${e}`
  }
  const d = new Date(selectedDate.value + 'T00:00:00')
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const summaryText = computed(() => {
  const logs = summaryLogs.value
  if (logs.length === 0) return '暂无工作记录'
  const catMap: Record<string, number> = {}
  const projSet = new Set<string>()
  for (const l of logs) {
    const cat = l.categoryId || 'other'
    catMap[cat] = (catMap[cat] || 0) + 1
    if (l.projectId) projSet.add(l.projectId)
  }
  const catDesc = Object.entries(catMap)
    .map(([id, count]) => {
      const cat = WORK_CATEGORIES.find(c => c.id === id)
      return `${cat?.icon || ''}${cat?.name || '其他'} ${count}项`
    })
    .join('、')
  const projNames = [...projSet].map(id => projectsStore.projects.find(p => p.id === id)?.name).filter(Boolean)
  const parts: string[] = [`共${logs.length}条工作记录`]
  if (catDesc) parts.push(`工作类型：${catDesc}`)
  if (projNames.length) parts.push(`涉及项目：${projNames.join('、')}`)
  return parts.join('。')
})

const reportContent = ref('')
const reports = ref<Report[]>([])
const copyTip = ref(false)
const aiLoading = ref(false)
const previewMode = ref(true)

const renderedHtml = computed(() => {
  if (!reportContent.value) return ''
  // AI 输出/手动编辑/导入的历史报告都可能含恶意 HTML，必须消毒后再 v-html
  return DOMPurify.sanitize(marked.parse(reportContent.value) as string)
})

function buildLocalReport(): string {
  const logs = summaryLogs.value
  if (logs.length === 0) return '暂无工作记录'
  const lines: string[] = []
  const typeLabel = summaryTab.value === 'day' ? '日报' : summaryTab.value === 'week' ? '周报' : '月报'
  lines.push(`# 【${typeLabel}】${summaryTitle.value}`)
  lines.push('')
  lines.push('## 一、工作概况')
  lines.push(summaryText.value)
  lines.push('')
  lines.push('## 二、工作明细')
  const grouped: Record<string, WorkLog[]> = {}
  for (const l of logs) {
    const key = l.date
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(l)
  }
  for (const [date, items] of Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))) {
    if (summaryTab.value !== 'day') lines.push(`### ${date}`)
    for (const item of items) {
      const cat = WORK_CATEGORIES.find(c => c.id === item.categoryId)
      const proj = item.projectId ? projectsStore.projects.find(p => p.id === item.projectId) : null
      let prefix = ''
      if (cat) prefix += `**${cat.icon}${cat.name}**`
      if (proj) prefix += `｜${proj.name}`
      lines.push(prefix ? `- ${prefix}：${item.content}` : `- ${item.content}`)
    }
    lines.push('')
  }
  lines.push('## 三、下周计划')

  const now = new Date()
  const day = now.getDay() || 7
  const nextMon = new Date(now); nextMon.setDate(now.getDate() - day + 8)
  const nextSun = new Date(now); nextSun.setDate(now.getDate() - day + 14)
  const nmStr = fmt(nextMon)
  const nsStr = fmt(nextSun)

  const overdue = todosStore.todos.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < todayStr())
  const nextWeek = todosStore.todos.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate >= nmStr && t.dueDate <= nsStr)
  const highNoDate = todosStore.todos.filter(t => t.status !== 'completed' && !t.dueDate && t.priority === 'high')

  if (overdue.length) {
    lines.push('')
    lines.push('**优先处理（逾期未完成）：**')
    for (const t of overdue.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))) {
      const proj = t.projectId ? projectsStore.projects.find(p => p.id === t.projectId) : null
      const projTag = proj ? ` [${proj.name}]` : ''
      lines.push(`- 🔴 ${t.title}${projTag}（截止 ${t.dueDate}）`)
    }
  }

  if (nextWeek.length) {
    lines.push('')
    lines.push('**本周计划：**')
    for (const t of nextWeek.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))) {
      const proj = t.projectId ? projectsStore.projects.find(p => p.id === t.projectId) : null
      const projTag = proj ? ` [${proj.name}]` : ''
      const priTag = t.priority === 'high' ? '（紧急）' : ''
      lines.push(`- ${t.title}${projTag}${priTag}（截止 ${t.dueDate}）`)
    }
  }

  if (highNoDate.length) {
    lines.push('')
    lines.push('**持续推进（高优先级）：**')
    for (const t of highNoDate) {
      const proj = t.projectId ? projectsStore.projects.find(p => p.id === t.projectId) : null
      const projTag = proj ? ` [${proj.name}]` : ''
      lines.push(`- ${t.title}${projTag}`)
    }
  }

  if (!overdue.length && !nextWeek.length && !highNoDate.length) {
    lines.push('- （暂无待办事项）')
  }

  return lines.join('\n').trim()
}

// 生成期间用户可能切换 tab/日期，序号不匹配的过期响应直接丢弃
let generateSeq = 0

async function generateReport() {
  const logs = summaryLogs.value
  const typeLabel = summaryTab.value === 'day' ? '日报' : summaryTab.value === 'week' ? '周报' : '月报'

  if (logs.length === 0) {
    reportContent.value = '暂无工作记录'
    return
  }

  if (isAiConfigured()) {
    const seq = ++generateSeq
    aiLoading.value = true
    try {
      const logTexts = logs.map(l => {
        const cat = WORK_CATEGORIES.find(c => c.id === l.categoryId)
        const proj = l.projectId ? projectsStore.projects.find(p => p.id === l.projectId)?.name : ''
        let prefix = `[${l.date}]`
        if (cat) prefix += `${cat.name}`
        if (proj) prefix += `/${proj}`
        return `${prefix}: ${l.content}`
      })

      const now = new Date()
      const todayLocal = todayStr()
      const day = now.getDay() || 7
      const nextMon = new Date(now); nextMon.setDate(now.getDate() - day + 8)
      const nextSun = new Date(now); nextSun.setDate(now.getDate() - day + 14)
      const nmStr = fmt(nextMon)
      const nsStr = fmt(nextSun)

      const overdueTodos = todosStore.todos.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < todayLocal)
      const nextWeekTodos = todosStore.todos.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate >= nmStr && t.dueDate <= nsStr)
      const highTodos = todosStore.todos.filter(t => t.status !== 'completed' && !t.dueDate && t.priority === 'high')

      let todoContext = ''
      if (overdueTodos.length || nextWeekTodos.length || highTodos.length) {
        todoContext = '\n\n待办事项参考（请据此生成下周计划）：'
        if (overdueTodos.length) {
          todoContext += '\n逾期未完成：' + overdueTodos.map(t => `${t.title}（截止${t.dueDate}）`).join('；')
        }
        if (nextWeekTodos.length) {
          todoContext += '\n下周截止：' + nextWeekTodos.map(t => `${t.title}（截止${t.dueDate}）`).join('；')
        }
        if (highTodos.length) {
          todoContext += '\n高优先级待处理：' + highTodos.map(t => t.title).join('；')
        }
      }

      let planLabel = '下周计划'
      let planDateRange = ''
      if (summaryTab.value === 'day') {
        planLabel = '明日计划'
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        planDateRange = `（${tomorrow.getMonth() + 1}月${tomorrow.getDate()}日）`
      } else if (summaryTab.value === 'week') {
        planLabel = '下周计划'
        planDateRange = `（${nextMon.getMonth() + 1}月${nextMon.getDate()}日-${nextSun.getMonth() + 1}月${nextSun.getDate()}日）`
      } else {
        planLabel = '下月计划'
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0)
        planDateRange = `（${nextMonth.getMonth() + 1}月${nextMonth.getDate()}日-${nextMonthEnd.getMonth() + 1}月${nextMonthEnd.getDate()}日）`
      }

      const prompt = `请根据以下工作日志记录，生成一份${typeLabel}（${summaryTitle.value}）。\n要求：\n1. 使用 Markdown 格式\n2. 包含工作概况、工作明细、${planLabel}三个部分（用二级标题）\n3. ${planLabel}${planDateRange}要结合待办事项数据，分为"优先处理（逾期）"、"本周计划"、"持续推进"三个小节\n4. 用简洁专业的语言\n5. 按项目或工作类型归纳总结\n6. 适合直接复制粘贴到工作汇报中\n\n工作日志：\n${logTexts.join('\n')}${todoContext}`
      const result = await chatWithAI([{ role: 'user', content: prompt }])
      if (seq !== generateSeq) return
      reportContent.value = result
    } catch {
      if (seq !== generateSeq) return
      reportContent.value = buildLocalReport()
    } finally {
      if (seq === generateSeq) aiLoading.value = false
    }
  } else {
    showAiConfigPrompt()
  }
}

/** 报告导出为 .md 文件（文件名：日报_2026-09-06.md 之类） */
function exportReport() {
  if (!reportContent.value.trim()) return message.warning('报告内容为空，请先生成或编辑')
  const typeLabel = summaryTab.value === 'day' ? '日报' : summaryTab.value === 'week' ? '周报' : '月报'
  const safeName = summaryTitle.value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_')
  const blob = new Blob([reportContent.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${typeLabel}_${safeName}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function fallbackCopy(text: string, done: () => void) {  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
    done()
  } catch {
    console.error('[copyReport] 复制失败')
  }
  document.body.removeChild(ta)
}

function copyReport() {
  const done = () => {
    copyTip.value = true
    setTimeout(() => copyTip.value = false, 1500)
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(reportContent.value).then(done).catch(() => fallbackCopy(reportContent.value, done))
  } else {
    fallbackCopy(reportContent.value, done)
  }
}

function saveReport() {
  const typeLabel = summaryTab.value === 'day' ? '日报' : summaryTab.value === 'week' ? '周报' : '月报'
  const [s, e] = summaryTab.value === 'day'
    ? [selectedDate.value, selectedDate.value]
    : summaryTab.value === 'week'
      ? weekRangeOf(selectedDate.value)
      : (() => { const d = new Date(selectedDate.value + 'T00:00:00'); return [fmt(new Date(d.getFullYear(), d.getMonth(), 1)), fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0))] })()
  const report: Report = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: summaryTab.value,
    periodLabel: `${typeLabel} ${summaryTitle.value}`,
    startDate: s,
    endDate: e,
    content: reportContent.value,
    createdAt: new Date().toISOString()
  }
  reports.value.unshift(report)
  storage.saveReports(reports.value)
}

function loadReport(r: Report) {
  reportContent.value = r.content
}

function deleteReport(id: string) {
  reports.value = reports.value.filter(r => r.id !== id)
  storage.saveReports(reports.value)
}

function openAddLog() {
  editingLogId.value = null
  logContent.value = ''
  selectedProjectId.value = null
  selectedCategoryId.value = 'other'
  showModal.value = true
}

function openEditLog(log: WorkLog) {
  editingLogId.value = log.id
  logContent.value = log.content
  selectedProjectId.value = log.projectId
  selectedCategoryId.value = log.categoryId || 'other'
  showModal.value = true
}

function saveLog() {
  if (!logContent.value.trim()) return
  if (editingLogId.value) {
    workLogsStore.updateWorkLog(editingLogId.value, {
      content: logContent.value,
      projectId: selectedProjectId.value,
      categoryId: selectedCategoryId.value
    })
  } else {
    workLogsStore.addWorkLog({
      date: selectedDate.value,
      content: logContent.value,
      projectId: selectedProjectId.value,
      categoryId: selectedCategoryId.value,
      clientId: null
    })
  }
  showModal.value = false
}

function deleteLog(id: string) {
  workLogsStore.deleteWorkLog(id)
}

function getProjectName(id: string | null) {
  if (!id) return ''
  return projectsStore.projects.find(p => p.id === id)?.name || ''
}

function getCatInfo(id: string) {
  return WORK_CATEGORIES.find(c => c.id === id) || { icon: '📌', name: '其他', color: '#94a3b8' }
}

onMounted(() => {
  workLogsStore.loadWorkLogs()
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  clientsStore.loadClients()
  todosStore.loadTodos()
  reports.value = storage.getReports()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">日历与统计</h1>
        <p class="page-subtitle">工作日志统计分析与日程管理</p>
      </div>
      <button class="btn btn-primary" @click="openAddLog">+ 记录日志</button>
    </div>

    <div class="range-bar card">
      <div class="range-presets">
        <button v-for="p in [{k:'week',l:'本周'},{k:'month',l:'本月'},{k:'quarter',l:'本季度'},{k:'year',l:'本年'}]"
          :key="p.k" :class="['range-btn', { active: rangePreset === p.k }]" @click="setRangePreset(p.k)">{{ p.l }}</button>
      </div>
      <div class="range-inputs">
        <input type="date" v-model="rangeStart" class="input range-date" />
        <span class="range-sep">至</span>
        <input type="date" v-model="rangeEnd" class="input range-date" />
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card card">
        <div class="stat-val">{{ rangeStats.total }}</div>
        <div class="stat-lbl">工作记录</div>
      </div>
      <div class="stat-card card">
        <div class="stat-val">{{ rangeStats.days }}</div>
        <div class="stat-lbl">活跃天数</div>
      </div>
      <div class="stat-card card">
        <div class="stat-val">{{ rangeStats.projList.length }}</div>
        <div class="stat-lbl">涉及项目</div>
      </div>
      <div class="stat-card card">
        <div class="stat-val">{{ rangeStats.clientList.length }}</div>
        <div class="stat-lbl">涉及客户</div>
      </div>
    </div>

    <div class="main-grid">
      <div class="left-col">
        <div class="card">
          <div class="card-header">
            <div class="cal-nav">
              <button class="btn-icon" @click="prevMonth">&lsaquo;</button>
              <span class="cal-month">{{ currentYear }}年{{ currentMonth + 1 }}月</span>
              <button class="btn-icon" @click="nextMonth">&rsaquo;</button>
            </div>
            <button class="btn btn-sm" @click="goToday">今天</button>
          </div>
          <div class="weekdays">
            <div v-for="d in weekDays" :key="d" class="wd">{{ d }}</div>
          </div>
          <div class="days">
            <div
              v-for="day in calendarDays"
              :key="day.dateStr"
              :class="['day', { other: !day.isCurrentMonth, today: day.isToday, selected: selectedDate === day.dateStr }]"
              @click="selectDate(day.dateStr)"
            >
              <span class="day-num">{{ day.date }}</span>
              <span v-if="day.hasLog" class="day-dot"></span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">分类统计</span>
          </div>
          <div class="cat-list">
            <div v-for="cat in rangeStats.catList" :key="cat.id" class="cat-row">
              <span class="cat-icon">{{ cat.icon }}</span>
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-count">{{ cat.count }}</span>
            </div>
            <div v-if="rangeStats.catList.length === 0" class="card-empty">暂无数据</div>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div class="report-split">
          <div class="card report-right">
            <div class="card-header">
              <div class="summary-tabs">
                <button :class="['stab', { active: summaryTab === 'day' }]" :disabled="aiLoading" @click="summaryTab = 'day'">日报</button>
                <button :class="['stab', { active: summaryTab === 'week' }]" :disabled="aiLoading" @click="summaryTab = 'week'">周报</button>
                <button :class="['stab', { active: summaryTab === 'month' }]" :disabled="aiLoading" @click="summaryTab = 'month'">月报</button>
              </div>
              <div class="report-actions">
                <button class="btn btn-sm" @click="generateReport" :disabled="aiLoading">{{ aiLoading ? '生成中...' : '生成' }}</button>
                <button class="btn btn-sm" @click="previewMode = !previewMode">{{ previewMode ? '编辑' : '预览' }}</button>
                <button class="btn btn-sm" @click="copyReport">{{ copyTip ? '已复制 ✓' : '复制' }}</button>
                <button class="btn btn-sm" @click="exportReport" title="下载 Markdown 文件">导出 .md</button>
                <button class="btn btn-sm btn-primary" @click="saveReport">保存</button>
              </div>
            </div>
            <div class="report-body">
              <div v-if="aiLoading" class="ai-loading">AI 正在生成工作总结...</div>
              <div v-if="previewMode" class="report-preview" v-html="renderedHtml"></div>
              <textarea v-else v-model="reportContent" class="report-editor" placeholder="点击[生成]自动总结，或直接编辑..."></textarea>
            </div>
          </div>

          <div class="card report-left">
            <div class="card-header">
              <span class="card-title">{{ logSearch.trim() ? '搜索结果' : '原始日志' }}</span>
              <span class="summary-date">{{ logSearch.trim() ? `${searchResults.length} 条匹配` : summaryTitle }}</span>
            </div>
            <div class="log-list-body">
              <div class="log-search">
                <input
                  v-model="logSearch"
                  class="log-search-input"
                  type="text"
                  placeholder="搜索全部日志：内容、项目名..."
                />
                <button v-if="logSearch" class="log-search-clear" @click="logSearch = ''" title="清除">&times;</button>
              </div>
              <div class="log-section">
                <template v-if="logSearch.trim()">
                  <div v-if="searchResults.length === 0" class="card-empty">没有匹配的日志</div>
                  <div v-for="log in searchResults" :key="log.id" class="log-item" @click="openEditLog(log)">
                    <div class="log-head">
                      <span class="log-date">{{ log.date }}</span>
                      <span class="log-cat" :style="{ color: getCatInfo(log.categoryId).color }">
                        {{ getCatInfo(log.categoryId).icon }} {{ getCatInfo(log.categoryId).name }}
                      </span>
                      <span v-if="getProjectName(log.projectId)" class="badge badge-blue">{{ getProjectName(log.projectId) }}</span>
                      <button class="log-del" @click.stop="deleteLog(log.id)" title="删除">&times;</button>
                    </div>
                    <p class="log-content">{{ log.content }}</p>
                  </div>
                </template>
                <template v-else>
                <div v-if="summaryLogs.length === 0" class="card-empty">暂无工作记录</div>
                <div v-for="log in summaryLogs" :key="log.id" class="log-item" @click="openEditLog(log)">
                  <div class="log-head">
                    <span class="log-date">{{ log.date }}</span>
                    <span class="log-cat" :style="{ color: getCatInfo(log.categoryId).color }">
                      {{ getCatInfo(log.categoryId).icon }} {{ getCatInfo(log.categoryId).name }}
                    </span>
                    <span v-if="getProjectName(log.projectId)" class="badge badge-blue">{{ getProjectName(log.projectId) }}</span>
                    <button class="log-del" @click.stop="deleteLog(log.id)" title="删除">&times;</button>
                  </div>
                  <p class="log-content">{{ log.content }}</p>
                </div>
                </template>
              </div>
              <div class="history-section">
                <div class="history-title">历史报告</div>
                <div v-if="reports.length === 0" class="card-empty">暂无历史报告</div>
                <div v-for="r in reports" :key="r.id" class="history-item" @click="loadReport(r)">
                  <span class="history-label">{{ r.periodLabel }}</span>
                  <span class="history-time">{{ formatDateTime(r.createdAt) }}</span>
                  <button class="log-del" @click.stop="deleteReport(r.id)" title="删除">&times;</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="two-cols">
          <div class="card">
            <div class="card-header"><span class="card-title">项目分布 TOP5</span></div>
            <div class="mini-list">
              <div v-for="p in rangeStats.projList" :key="p.id" class="mini-row">
                <span class="mini-name">{{ p.name }}</span>
                <span class="mini-count">{{ p.count }}</span>
              </div>
              <div v-if="rangeStats.projList.length === 0" class="card-empty">暂无</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">客户分布 TOP5</span></div>
            <div class="mini-list">
              <div v-for="c in rangeStats.clientList" :key="c.id" class="mini-row">
                <span class="mini-name">{{ c.name }}</span>
                <span class="mini-count">{{ c.count }}</span>
              </div>
              <div v-if="rangeStats.clientList.length === 0" class="card-empty">暂无</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingLogId ? '编辑日志' : '记录日志' }} · {{ selectedDate }}</h3>
          <button class="btn-icon" @click="showModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-row">
            <div class="modal-field">
              <label class="field-label">工作类型</label>
              <select v-model="selectedCategoryId" class="input">
                <option v-for="cat in WORK_CATEGORIES" :key="cat.id" :value="cat.id">{{ cat.icon }} {{ cat.name }}</option>
              </select>
            </div>
            <div class="modal-field">
              <label class="field-label">关联项目</label>
              <select v-model="selectedProjectId" class="input">
                <option :value="null">不关联</option>
                <option v-for="p in projectOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="field-label">工作内容 <span style="color: var(--rose);">*</span></label>
            <textarea v-model="logContent" placeholder="记录今天的工作内容..." class="input" rows="8" style="resize: vertical;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="saveLog">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.range-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 18px; margin-bottom: 16px;
}
.range-presets { display: flex; gap: 4px; }
.range-btn {
  padding: 5px 14px; border-radius: var(--radius-full); border: 1px solid var(--border);
  background: var(--bg-card); font-size: 12px; font-family: var(--font); color: var(--text-secondary);
  cursor: pointer; transition: all 0.12s;
}
.range-btn:hover { border-color: var(--primary); color: var(--primary); }
.range-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.range-inputs { display: flex; align-items: center; gap: 8px; }
.range-date { width: 140px; padding: 5px 10px; font-size: 13px; }
.range-sep { font-size: 13px; color: var(--text-muted); }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { text-align: center; padding: 16px 12px; }
.stat-val { font-size: 28px; font-weight: 700; color: var(--primary); line-height: 1.1; }
.stat-lbl { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.main-grid {
  display: grid; grid-template-columns: 380px 1fr; gap: 16px;
  height: calc(100vh - 290px); min-height: 400px;
}
.left-col {
  display: flex; flex-direction: column; gap: 16px; height: 100%; min-height: 0;
}
.left-col > .card:first-child { flex: 0 0 auto; }
.left-col > .card:last-child { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.left-col > .card:last-child .cat-list { flex: 1; min-height: 0; overflow-y: auto; }
.right-col {
  display: flex; flex-direction: column; gap: 16px; min-width: 0; height: 100%; min-height: 0;
}
.report-split {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1; min-height: 0;
}
.report-left { display: flex; flex-direction: column; min-height: 0; }
.log-list-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.log-search {
  position: relative;
  padding: 10px 14px 0;
  flex-shrink: 0;
}
.log-search-input {
  width: 100%;
  padding: 7px 30px 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text);
  font-size: 12.5px;
  outline: none;
  box-sizing: border-box;
}
.log-search-input:focus { border-color: var(--primary); }
.log-search-clear {
  position: absolute;
  right: 22px;
  top: 50%;
  transform: translateY(calc(-50% - 3px));
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}
.log-section { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px; }
.report-right { display: flex; flex-direction: column; min-height: 0; }
.report-right .card-header { flex-wrap: wrap; gap: 8px; }
.report-body { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 12px 14px; }
.report-preview {
  flex: 1; min-height: 120px; overflow-y: auto; padding: 14px 16px;
  border: 1px solid var(--border-light); border-radius: var(--radius-sm);
  background: var(--bg-card); font-size: 13px; color: var(--text); line-height: 1.8;
}
.report-preview :deep(h1) { font-size: 18px; font-weight: 700; margin: 0 0 10px; color: var(--text); }
.report-preview :deep(h2) { font-size: 15px; font-weight: 600; margin: 14px 0 8px; color: var(--text); border-bottom: 1px solid var(--border-light); padding-bottom: 4px; }
.report-preview :deep(h3) { font-size: 14px; font-weight: 600; margin: 10px 0 6px; color: var(--text); }
.report-preview :deep(p) { margin: 0 0 8px; }
.report-preview :deep(ul), .report-preview :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.report-preview :deep(li) { margin-bottom: 4px; }
.report-preview :deep(strong) { font-weight: 600; color: var(--text); }
.report-preview :deep(em) { font-style: italic; }
.report-preview :deep(blockquote) {
  margin: 8px 0; padding: 8px 12px; border-left: 3px solid var(--primary);
  background: var(--primary-50); color: var(--text-secondary);
}
.right-col > .two-cols { flex: 0 0 auto; }

.cal-nav { display: flex; align-items: center; gap: 4px; }
.cal-month { font-size: 15px; font-weight: 600; color: var(--text); min-width: 100px; text-align: center; }
.weekdays { display: grid; grid-template-columns: repeat(7, 1fr); padding: 8px 14px 2px; }
.wd { text-align: center; font-size: 12px; font-weight: 600; color: var(--text-muted); padding: 4px 0; }
.days { display: grid; grid-template-columns: repeat(7, 1fr); padding: 2px 14px 12px; gap: 2px; }
.day {
  padding: 7px 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  border-radius: var(--radius-sm); cursor: pointer; transition: background 0.12s;
}
.day:hover { background: var(--bg-hover); }
.day.other { opacity: 0.2; }
.day.today { background: var(--primary-light); }
.day.today .day-num { color: var(--primary); font-weight: 600; }
.day.selected { background: var(--primary); border-radius: var(--radius); }
.day.selected .day-num { color: #fff; font-weight: 600; }
.day.selected .day-dot { background: #fff; }
.day-num { font-size: 13px; color: var(--text); line-height: 1; }
.day-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--primary); }

.cat-list { padding: 8px 18px; }
.cat-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border-light); }
.cat-row:last-child { border-bottom: none; }
.cat-icon { font-size: 14px; flex-shrink: 0; }
.cat-name { flex: 1; font-size: 13px; color: var(--text); }
.cat-count { font-size: 13px; font-weight: 600; color: var(--text-secondary); }

.summary-tabs { display: flex; gap: 2px; background: var(--bg); border-radius: var(--radius-sm); padding: 2px; }
.stab {
  padding: 5px 16px; border: none; background: transparent; border-radius: 4px;
  font-size: 13px; font-family: var(--font); color: var(--text-muted); cursor: pointer; transition: all 0.12s;
}
.stab:hover { color: var(--text); }
.stab.active { background: var(--bg-card); color: var(--primary); font-weight: 600; box-shadow: var(--shadow-xs); }
.summary-date { font-size: 12px; color: var(--text-muted); }
.summary-body { padding: 16px 18px; }
.report-actions { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.report-editor {
  width: 100%; flex: 1; min-height: 120px; padding: 14px 16px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-size: 13px; font-family: var(--font); color: var(--text);
  line-height: 1.8; resize: vertical; background: var(--bg-card); outline: none;
  transition: border-color 0.15s;
}
.report-editor:focus { border-color: var(--primary); }
.ai-loading {
  padding: 8px 12px; margin-bottom: 8px; font-size: 12px; color: var(--primary);
  background: var(--primary-50); border-radius: var(--radius-sm); text-align: center;
}
.history-section {
  border-top: 1px solid var(--border-light); padding: 10px 14px;
  max-height: 180px; overflow-y: auto; flex-shrink: 0;
}
.history-title { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
.history-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer;
  border-bottom: 1px solid var(--border-light); transition: background 0.12s;
}
.history-item:last-child { border-bottom: none; }
.history-item:hover { background: var(--bg-hover); }
.history-label { flex: 1; font-size: 13px; color: var(--text); }
.history-time { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.summary-overview {
  background: var(--bg); border: 1px solid var(--border-light); border-radius: var(--radius-sm);
  padding: 14px 16px; margin-bottom: 14px;
}
.summary-text { font-size: 13px; color: var(--text-secondary); line-height: 1.8; margin: 0; }
.summary-logs { display: flex; flex-direction: column; gap: 8px; }

.log-item {
  padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: var(--radius-sm); cursor: pointer; transition: all 0.12s;
}
.log-item:hover { border-color: var(--primary); box-shadow: var(--shadow-xs); }
.log-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.log-date { font-size: 12px; font-weight: 600; color: var(--primary); }
.log-cat { font-size: 11px; font-weight: 500; }
.log-del {
  margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer;
  font-size: 16px; padding: 0 4px; line-height: 1; transition: color 0.12s;
}
.log-del:hover { color: var(--rose); }
.log-content { font-size: 13px; color: var(--text); line-height: 1.6; margin: 0; }

.two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.mini-list { padding: 10px 18px; }
.mini-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-light); }
.mini-row:last-child { border-bottom: none; }
.mini-name { font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini-count { font-size: 13px; font-weight: 600; color: var(--primary); flex-shrink: 0; }

.modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.modal-field { display: flex; flex-direction: column; }
.field-label { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 5px; }

@media (max-width: 1100px) {
  .main-grid { grid-template-columns: 1fr; height: auto; }
  .left-col, .right-col { height: auto; }
  .report-split { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .two-cols { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .range-bar { flex-direction: column; gap: 10px; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .modal-row { grid-template-columns: 1fr; }
}
</style>
