<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, inject, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import { useClientsStore } from '../stores/clients'
import { useOpportunitiesStore } from '../stores/opportunities'
import { analyzeEntry, confirmEntry, analyzeEntryWithAI } from '../services/smartEntry'
import type { PendingEntry } from '../services/smartEntry'
import { WORK_CATEGORIES } from '../types'
import type { Todo } from '../types'
import { isAiConfigured } from '../services/aiService'
import { message } from '../utils/notify'
import { addDaysStr, fmtDate, mondayOf, todayStr } from '../utils/date'

const router = useRouter()
const route = useRoute()
const projectsStore = useProjectsStore()
const todosStore = useTodosStore()
const workLogsStore = useWorkLogsStore()
const clientsStore = useClientsStore()
const opportunitiesStore = useOpportunitiesStore()
const showAiConfigPrompt = inject<() => void>('showAiConfigPrompt', () => {})

const aiInput = ref('')
const pending = ref<PendingEntry | null>(null)
const confirmed = ref(false)
const statusMsg = ref('')
const aiConfigured = ref(isAiConfigured())

function refreshAiStatus() {
  aiConfigured.value = isAiConfigured()
}

const todayFormatted = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
})

const clientCount = computed(() => clientsStore.clients.length)
const projectCount = computed(() => projectsStore.projects.length)
const activeProjectCount = computed(() => projectsStore.projects.filter(p => p.status === 'in_progress').length)
const logCount = computed(() => workLogsStore.workLogs.length)
const todoCount = computed(() => todosStore.todos.length)
const pendingTodoCount = computed(() => todosStore.todos.filter(t => t.status !== 'completed').length)
const activeProjects = computed(() => projectsStore.projects.filter(p => p.status === 'in_progress'))

const today = () => todayStr()
const overdueTodos = computed(() =>
  todosStore.todos.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < today())
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
)
const todayTodos = computed(() =>
  todosStore.todos.filter(t => t.status !== 'completed' && t.dueDate === today())
)
const upcomingTodos = computed(() => {
  const mon = mondayOf()
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const mStr = fmtDate(mon)
  const sStr = fmtDate(sun)
  return todosStore.todos.filter(t =>
    t.dueDate && t.dueDate >= mStr && t.dueDate <= sStr
  ).sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (a.status !== 'completed' && b.status === 'completed') return -1
    return (a.dueDate || '').localeCompare(b.dueDate || '')
  })
})

const nextWeekTodos = computed(() => {
  const now = new Date()
  const day = now.getDay() || 7
  const nextMon = new Date(now); nextMon.setDate(now.getDate() - day + 8)
  const nextSun = new Date(now); nextSun.setDate(now.getDate() - day + 14)
  const nmStr = fmtDate(nextMon)
  const nsStr = fmtDate(nextSun)
  return todosStore.todos.filter(t =>
    t.status !== 'completed' && t.dueDate && t.dueDate >= nmStr && t.dueDate <= nsStr
  ).concat(
    todosStore.todos.filter(t =>
      t.status !== 'completed' && !t.dueDate && t.priority === 'high'
    )
  ).sort((a, b) => {
    const pri: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return (pri[a.priority] ?? 3) - (pri[b.priority] ?? 3)
  })
})

function toggleTodoStatus(todo: Todo) {
  todosStore.updateTodo(todo.id, { status: todo.status === 'completed' ? 'pending' : 'completed' })
}

// —— 投标截止提醒（未来 7 天内递交截止的活跃商机）——
const bidDeadlines = computed(() => opportunitiesStore.deadlinesWithin(7))

function bidCountdown(dateStr: string): string {
  if (!dateStr) return ''
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const days = Math.ceil((target.getTime() - now.getTime()) / 86400000)
  if (days < 0) return `已逾期${Math.abs(days)}天`
  if (days === 0) return '今天截止'
  return `还剩${days}天`
}

// —— 客户跟进提醒（跟进日到期/超期，流失客户除外）——
const followUpClients = computed(() =>
  clientsStore.clients
    .filter(c => c.followUpStatus !== 'lost' && c.nextFollowUpDate && c.nextFollowUpDate <= today())
    .sort((a, b) => (a.nextFollowUpDate || '').localeCompare(b.nextFollowUpDate || ''))
)

function markFollowed(clientId: string) {
  clientsStore.updateClient(clientId, {
    lastContactDate: today(),
    nextFollowUpDate: null
  })
  message.success('已标记跟进')
}

function friendlyDate(dateStr: string) {
  if (dateStr === today()) return '今天'
  if (dateStr === addDaysStr(1)) return '明天'
  return dateStr.slice(5).replace('-', '/')
}

const recentLogs = computed(() =>
  [...workLogsStore.workLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
)

const hasContent = computed(() => {
  if (!pending.value) return false
  return pending.value.projects.length > 0 || pending.value.logs.length > 0 ||
         pending.value.todos.length > 0 || pending.value.client !== null
})

const categoryLabel = computed(() => {
  if (!pending.value) return ''
  return WORK_CATEGORIES.find(c => c.id === pending.value!.categoryId)?.name || ''
})

function getProjectName(id: string | null) {
  if (!id) return ''
  return projectsStore.projects.find(p => p.id === id)?.name || ''
}

const aiAnalyzing = ref(false)

async function handleAnalyze() {
  if (aiAnalyzing.value) return
  const text = aiInput.value.trim()
  if (!text) return
  confirmed.value = false
  statusMsg.value = ''

  if (isAiConfigured()) {
    aiAnalyzing.value = true
    try {
      pending.value = await analyzeEntryWithAI(text, { projectsStore, clientsStore })
    } catch {
      pending.value = analyzeEntry(text, { projectsStore, todosStore, clientsStore })
    } finally {
      aiAnalyzing.value = false
    }
  } else {
    pending.value = analyzeEntry(text, { projectsStore, todosStore, clientsStore })
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleAnalyze()
  }
}

function handleConfirm() {
  if (!pending.value) return
  const result = confirmEntry(pending.value, { projectsStore, todosStore, workLogsStore, clientsStore })
  statusMsg.value = result.summary
  confirmed.value = true
  aiInput.value = ''
  setTimeout(() => { pending.value = null; confirmed.value = false }, 2500)
}

function handleDiscard() {
  pending.value = null
  confirmed.value = false
  statusMsg.value = ''
}

function removeProject(idx: number) { pending.value?.projects.splice(idx, 1) }
function removeLog(idx: number) { pending.value?.logs.splice(idx, 1) }
function removeTodo(idx: number) { pending.value?.todos.splice(idx, 1) }
function removeClient() { if (pending.value) pending.value.client = null }

onMounted(() => {
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  clientsStore.loadClients()
  opportunitiesStore.loadOpportunities()
  refreshAiStatus()
  window.addEventListener('ai-config-changed', refreshAiStatus)
})

onBeforeUnmount(() => {
  window.removeEventListener('ai-config-changed', refreshAiStatus)
})

watch(() => route.path, () => {
  refreshAiStatus()
})
</script>

<template>
  <div class="dashboard">
    <div class="page-header" style="width:100%">
      <div>
        <h1 class="page-title">工作台</h1>
        <p class="page-subtitle">{{ todayFormatted }}</p>
      </div>
    </div>

    <div class="dash-left">
      <div class="stats-bar">
        <div class="stat-card" @click="router.push('/clients')">
          <span class="stat-num">{{ clientCount }}</span>
          <span class="stat-label">客户</span>
        </div>
        <div class="stat-card" @click="router.push('/projects')">
          <span class="stat-num">{{ projectCount }}</span>
          <span class="stat-label">项目</span>
          <span class="stat-sub">{{ activeProjectCount }} 进行中</span>
        </div>
        <div class="stat-card" @click="router.push('/calendar')">
          <span class="stat-num">{{ logCount }}</span>
          <span class="stat-label">工作日志</span>
        </div>
        <div class="stat-card" @click="router.push('/todos')">
          <span class="stat-num">{{ todoCount }}</span>
          <span class="stat-label">待办</span>
          <span class="stat-sub">{{ pendingTodoCount }} 待处理</span>
        </div>
      </div>

      <div class="card input-card">
        <div class="input-wrap">
          <textarea
            v-model="aiInput"
            placeholder="记录今天的工作内容，系统会自动识别项目、客户、日志和待办...&#10;例如：今天去了市大数据局汇报智慧城市项目方案，明天跟进预算确认&#10;按 Ctrl+Enter 开始分析"
            class="smart-input"
            rows="3"
            @keydown="handleKeydown"
          ></textarea>
          <button v-if="aiInput" class="clear-btn" @click="aiInput = ''; pending = null" title="清空">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="input-actions">
          <span class="input-hint">
            <template v-if="aiConfigured">Ctrl+Enter 分析 · AI 智能识别</template>
            <template v-else>Ctrl+Enter 分析 · 本地识别 <a class="ai-link" @click.stop="showAiConfigPrompt()">开启 AI 增强</a></template>
          </span>
          <button class="btn btn-primary btn-sm" :disabled="!aiInput.trim() || aiAnalyzing" @click="handleAnalyze">
            <span v-if="aiAnalyzing" class="btn-spinner"></span>
            {{ aiAnalyzing ? 'AI 分析中…' : '分析' }}
          </button>
        </div>
      </div>

      <div class="focus-row-wrap">
        <div class="focus-card">
          <div class="focus-header">
            <span class="focus-title"><svg class="focus-ico ico-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><circle cx="12" cy="15.5" r=".6" fill="currentColor"/></svg>今日关注</span>
            <span class="focus-count">{{ overdueTodos.length + todayTodos.length }}</span>
          </div>
          <div class="focus-body">
            <div v-if="!overdueTodos.length && !todayTodos.length" class="card-empty">✅ 无逾期或今日到期事项</div>
            <div v-if="overdueTodos.length" class="focus-tier">
              <div class="tier-head">
                <span class="tier-dot tier-dot-red"></span>
                <span class="tier-label">逾期</span>
              </div>
              <div v-for="t in overdueTodos.slice(0, 3)" :key="t.id" class="focus-item" @click="router.push('/todos')">
                <button class="focus-check" :class="{ 'check-done': t.status === 'completed' }" @click.stop="toggleTodoStatus(t)"></button>
                <span class="focus-text">{{ t.title }}</span>
                <span class="focus-date focus-date-red">{{ friendlyDate(t.dueDate) }}</span>
              </div>
            </div>
            <div v-if="todayTodos.length" class="focus-tier">
              <div class="tier-head">
                <span class="tier-dot tier-dot-blue"></span>
                <span class="tier-label">今日</span>
              </div>
              <div v-for="t in todayTodos.slice(0, 3)" :key="t.id" class="focus-item" @click="router.push('/todos')">
                <button class="focus-check" @click.stop="toggleTodoStatus(t)"></button>
                <span class="focus-text">{{ t.title }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="focus-card">
          <div class="focus-header">
            <span class="focus-title"><svg class="focus-ico ico-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>本周关注</span>
            <span class="focus-count">{{ upcomingTodos.filter(t => t.status !== 'completed').length }} 待处理</span>
          </div>
          <div class="focus-body">
            <div v-if="!upcomingTodos.length" class="card-empty">✅ 本周暂无到期事项</div>
            <div v-for="t in upcomingTodos.slice(0, 6)" :key="t.id" class="focus-item" @click="router.push('/todos')">
              <button class="focus-check" :class="{ 'check-done': t.status === 'completed' }" @click.stop="toggleTodoStatus(t)"></button>
              <span :class="['focus-text', { 'focus-text-done': t.status === 'completed' }]">{{ t.title }}</span>
              <span class="focus-date">{{ friendlyDate(t.dueDate) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="focus-row-wrap" style="margin-top:-2px">
        <div class="focus-card">
          <div class="focus-header">
            <span class="focus-title"><svg class="focus-ico ico-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M12 9v4"/><path d="M9.5 2h5M12 2v4"/></svg>投标截止提醒</span>
            <span class="focus-count">{{ bidDeadlines.length }}</span>
          </div>
          <div class="focus-body">
            <div v-if="!bidDeadlines.length" class="card-empty">✅ 近 7 天无标书递交截止</div>
            <div v-for="o in bidDeadlines.slice(0, 6)" :key="o.id" class="focus-item" @click="router.push('/opportunities')">
              <span class="focus-text">{{ o.name }}</span>
              <span class="focus-date" :class="{ 'focus-date-red': (o.bidDeadline || '') <= today() }">
                {{ o.bidDeadline?.slice(5) }} · {{ bidCountdown(o.bidDeadline) }}
              </span>
            </div>
          </div>
        </div>

        <div class="focus-card">
          <div class="focus-header">
            <span class="focus-title"><svg class="focus-ico ico-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M17.8 13.8a6.5 6.5 0 0 1 3.7 6.2"/></svg>客户跟进提醒</span>
            <span class="focus-count">{{ followUpClients.length }}</span>
          </div>
          <div class="focus-body">
            <div v-if="!followUpClients.length" class="card-empty">✅ 暂无待跟进客户</div>
            <div v-for="c in followUpClients.slice(0, 6)" :key="c.id" class="focus-item" @click="router.push('/clients/' + c.id)">
              <span class="focus-text">{{ c.name }}</span>
              <span class="focus-date" :class="{ 'focus-date-red': (c.nextFollowUpDate || '') < today() }">
                {{ c.nextFollowUpDate === today() ? '今天该跟进' : '已逾期' }}
              </span>
              <button class="fu-btn" @click.stop="markFollowed(c.id)">已跟进</button>
            </div>
          </div>
        </div>
      </div>

      <div class="focus-row-wrap" style="margin-top:-2px">
        <div class="focus-card" style="grid-column: 1 / -1">
          <div class="focus-header">
            <span class="focus-title"><svg class="focus-ico ico-violet" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>下周计划</span>
            <span class="focus-count">{{ nextWeekTodos.length }} 项</span>
          </div>
          <div class="focus-body focus-body-grid">
            <div v-if="!nextWeekTodos.length" class="card-empty">✅ 下周暂无计划事项</div>
            <div v-for="t in nextWeekTodos.slice(0, 6)" :key="t.id" class="focus-item" @click="router.push('/todos')">
              <button class="focus-check" @click.stop="toggleTodoStatus(t)"></button>
              <span class="focus-text">{{ t.title }}</span>
              <span :class="['focus-pri', 'pri-' + t.priority]">{{ t.priority === 'high' ? '紧急' : t.priority === 'medium' ? '重要' : '一般' }}</span>
              <span class="focus-date">{{ t.dueDate ? friendlyDate(t.dueDate) : '待定' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="mid-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">近期日志</span>
            <button class="link" @click="router.push('/calendar')">查看全部</button>
          </div>
          <div v-if="recentLogs.length === 0" class="card-empty">暂无日志记录</div>
          <div v-for="log in recentLogs.slice(0, 4)" :key="log.id" class="list-row" @click="router.push('/calendar')">
            <span class="row-date">{{ log.date.slice(5) }}</span>
            <span class="row-text">{{ log.content }}</span>
            <span v-if="getProjectName(log.projectId)" class="badge badge-blue">{{ getProjectName(log.projectId) }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">进行中项目</span>
            <button class="link" @click="router.push('/projects')">查看全部</button>
          </div>
          <div v-if="activeProjects.length === 0" class="card-empty">暂无进行中项目</div>
          <div v-for="p in activeProjects.slice(0, 4)" :key="p.id" class="list-row" @click="router.push(`/projects/${p.id}`)">
            <span class="row-text" style="flex:1">{{ p.name }}</span>
            <div class="mini-progress"><div class="mini-fill" :style="{ width: p.progress + '%' }"></div></div>
            <span class="row-pct">{{ p.progress }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="dash-right">
      <div class="right-head">
        <span class="right-title">智能梳理</span>
        <span v-if="categoryLabel" class="badge badge-blue">{{ categoryLabel }}</span>
      </div>

      <div class="right-body">
        <div v-if="confirmed" class="confirm-state">
          <div class="confirm-icon">✓</div>
          <p class="confirm-text">{{ statusMsg }}</p>
        </div>

        <div v-else-if="hasContent && pending">
          <div v-if="pending.client" class="section">
            <div class="section-label">客户</div>
            <div class="edit-card">
              <div class="edit-row">
                <label class="edit-label">名称</label>
                <input class="edit-input" v-model="pending.client.name" />
              </div>
              <button class="edit-remove" @click="removeClient">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div v-if="pending.projects.length" class="section">
            <div class="section-label">项目</div>
            <div v-for="(p, idx) in pending.projects" :key="'p'+idx" class="edit-card">
              <div class="edit-row">
                <label class="edit-label">名称</label>
                <input class="edit-input" v-model="p.name" />
              </div>
              <div class="edit-row">
                <label class="edit-label">描述</label>
                <input class="edit-input" v-model="p.description" />
              </div>
              <button class="edit-remove" @click="removeProject(idx)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div v-if="pending.logs.length" class="section">
            <div class="section-label">工作日志</div>
            <div v-for="(l, idx) in pending.logs" :key="'l'+idx" class="edit-card">
              <div class="edit-row">
                <label class="edit-label">内容</label>
                <textarea class="edit-input edit-textarea" v-model="l.content" rows="2"></textarea>
              </div>
              <div class="edit-row-cols">
                <div class="edit-col">
                  <label class="edit-label">日期</label>
                  <input class="edit-input" type="date" v-model="l.date" />
                </div>
                <div class="edit-col">
                  <label class="edit-label">类型</label>
                  <select class="edit-input" v-model="l.categoryId">
                    <option v-for="cat in WORK_CATEGORIES" :key="cat.id" :value="cat.id">{{ cat.icon }} {{ cat.name }}</option>
                  </select>
                </div>
              </div>
              <button class="edit-remove" @click="removeLog(idx)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div v-if="pending.todos.length" class="section">
            <div class="section-label">待办事项</div>
            <div v-for="(t, idx) in pending.todos" :key="'t'+idx" class="edit-card">
              <div class="edit-row">
                <label class="edit-label">标题</label>
                <input class="edit-input" v-model="t.title" />
              </div>
              <div class="edit-row-cols">
                <div class="edit-col">
                  <label class="edit-label">优先级</label>
                  <select class="edit-input" v-model="t.priority">
                    <option value="high">紧急</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
                <div class="edit-col">
                  <label class="edit-label">截止日期</label>
                  <input class="edit-input" type="date" v-model="t.dueDate" />
                </div>
              </div>
              <button class="edit-remove" @click="removeTodo(idx)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div class="confirm-actions">
            <button class="btn" @click="handleDiscard">放弃</button>
            <button class="btn btn-primary" @click="handleConfirm">确认记录</button>
          </div>
        </div>

        <div v-else class="guide-state">
          <div class="guide-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <p class="guide-title">智能梳理</p>
          <p class="guide-desc">在左侧输入工作内容，点击「分析」后，系统会自动识别并在此处展示。每项均可修改编辑，确认无误后点击「确认记录」完成录入。</p>
          <div class="guide-examples">
            <span class="guide-tag">识别客户</span>
            <span class="guide-tag">识别项目</span>
            <span class="guide-tag">识别类型</span>
            <span class="guide-tag">提取待办</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-wrap: wrap; gap: 20px; width: 100%; min-height: 100%; align-content: flex-start; }
.dashboard :deep(.page-header) { margin-bottom: 12px; }
.dashboard :deep(.page-title) { font-size: 18px; }
.dashboard :deep(.page-subtitle) { margin-top: 2px; }
.dash-left { flex: 1; min-width: 0; }

.stats { display: flex; gap: 10px; }
.stat-item {
  display: flex; flex-direction: column; align-items: center;
  padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer; transition: all 0.15s;
}
.stat-item:hover { border-color: var(--primary); box-shadow: var(--shadow-xs); }
.stat-num { font-size: 20px; font-weight: 700; color: var(--primary); line-height: 1.1; }
.stat-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-card .stat-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1;
}
.stat-card .stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}
.stat-sub {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}
@media (max-width: 600px) { .stats-bar { grid-template-columns: repeat(2, 1fr); } }

.focus-row-wrap {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;
}
/* 同行另一张卡片无内容被隐藏时，剩下的卡片占满整行，避免留空位 */
.focus-row-wrap .focus-card:only-child { grid-column: 1 / -1; }
.focus-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius);
}
.focus-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border-light, var(--border));
}
.focus-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--text);
}
.focus-ico { width: 15px; height: 15px; flex-shrink: 0; }
.ico-red { color: var(--rose); }
.ico-blue { color: var(--blue); }
.ico-amber { color: var(--amber); }
.ico-teal { color: var(--primary); }
.ico-violet { color: #8b5cf6; }
.focus-count {
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  background: var(--bg); padding: 1px 8px; border-radius: var(--radius-full);
}
.focus-body { padding: 4px 0; }
.focus-tier { padding: 0 16px; }
.focus-tier + .focus-tier { border-top: 1px solid var(--border-light, var(--border)); }
.tier-head {
  display: flex; align-items: center; gap: 6px; padding: 8px 0 2px;
}
.tier-dot { width: 6px; height: 6px; border-radius: 50%; }
.tier-dot-red { background: #ef4444; }
.tier-dot-blue { background: #2563eb; }
.tier-dot-amber { background: #f59e0b; }
.tier-label { font-size: 11px; font-weight: 600; color: var(--text-secondary, var(--text-muted)); }
.focus-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 16px; cursor: pointer; transition: background 0.1s;
}
.focus-item:hover { background: var(--bg-hover); }
.focus-check {
  width: 15px; height: 15px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border); background: transparent;
  cursor: pointer; padding: 0; transition: all 0.15s;
}
.focus-check:hover { border-color: var(--primary); }
.check-done { border-color: var(--primary); background: var(--primary); }
.focus-text { flex: 1; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.focus-date { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.focus-date-red { color: #ef4444; font-weight: 600; }
.focus-text-done { text-decoration: line-through; color: var(--text-muted); }
.focus-pri {
  font-size: 10px; font-weight: 600; padding: 1px 6px;
  border-radius: var(--radius-full); flex-shrink: 0;
}
.pri-high { background: #fef2f2; color: #dc2626; }
.pri-medium { background: #fffbeb; color: #d97706; }
.pri-low { background: #f0fdf4; color: #16a34a; }
.focus-body-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px;
}
@media (max-width: 768px) { .focus-row-wrap { grid-template-columns: 1fr; } .focus-body-grid { grid-template-columns: 1fr; } }

.mini-progress {
  width: 60px; height: 4px; background: var(--border-light, var(--border));
  border-radius: var(--radius-full); overflow: hidden; flex-shrink: 0;
}
.mini-fill { height: 100%; background: var(--primary); border-radius: var(--radius-full); transition: width 0.3s; }
.row-pct { font-size: 11px; color: var(--text-muted); width: 32px; text-align: right; flex-shrink: 0; }

.input-card { margin-bottom: 16px; }
.smart-input {
  width: 100%; border: none; outline: none; font-size: 14px; font-family: var(--font);
  line-height: 1.6; resize: none; background: transparent; color: var(--text);
  padding: 14px 18px 8px; min-height: 28px;
}
.smart-input::placeholder { color: var(--text-placeholder); }
.input-wrap { position: relative; }
.input-wrap .smart-input { padding-right: 36px; }
.clear-btn {
  position: absolute; top: 10px; right: 10px;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: var(--border-light, #e2e8f0);
  color: var(--text-muted, #94a3b8);
  cursor: pointer; transition: all 0.15s;
  padding: 0;
}
.clear-btn:hover { background: var(--border, #cbd5e1); color: var(--text, #1e293b); }
.input-actions { display: flex; justify-content: space-between; align-items: center; padding: 8px 18px 12px; }
.input-hint { font-size: 12px; color: var(--text-muted); }
.ai-link { color: var(--primary); cursor: pointer; text-decoration: underline; font-weight: 500; }
.ai-link:hover { color: #4f46e5; }
.btn-spinner {
  display: inline-block; width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.6s linear infinite;
  margin-right: 4px; vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

.mid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.row-date { font-size: 12px; font-weight: 500; color: var(--primary); flex-shrink: 0; min-width: 40px; }
.row-text { flex: 1; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }



.dash-right {
  width: 440px; flex-shrink: 0; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden; align-self: flex-start;
  position: sticky; top: 14px; margin-top: 0; min-height: 450px;
}
.right-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid var(--border-light);
}
.right-title { font-size: 14px; font-weight: 600; color: var(--text); }
.right-body { padding: 16px 18px; max-height: calc(100vh - 180px); overflow-y: auto; }

.section { margin-bottom: 16px; }
.section:last-of-type { margin-bottom: 0; }
.section-label {
  font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-light);
}

.edit-card {
  position: relative;
  background: var(--bg); border: 1px solid var(--border-light); border-radius: var(--radius-sm);
  padding: 10px 12px; margin-bottom: 8px;
}
.edit-card:focus-within { border-color: var(--primary); }
.edit-row { display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px; }
.edit-row:last-of-type { margin-bottom: 0; }
.edit-label { font-size: 11px; font-weight: 500; color: var(--text-muted); }
.edit-input {
  width: 100%; padding: 5px 8px; border: 1px solid var(--border); border-radius: 4px;
  font-size: 13px; font-family: var(--font); color: var(--text); background: var(--bg-card);
  outline: none; transition: border-color 0.15s;
}
.edit-input:focus { border-color: var(--primary); }
.edit-textarea { resize: vertical; min-height: 40px; line-height: 1.5; }
select.edit-input { cursor: pointer; }
.edit-row-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 0; }
.edit-col { display: flex; flex-direction: column; gap: 3px; }
.edit-remove {
  position: absolute; top: 6px; right: 6px;
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  padding: 2px; border-radius: 3px; display: flex; transition: all 0.12s;
}
.edit-remove:hover { color: var(--rose); background: var(--rose-bg); }

.confirm-actions {
  display: flex; gap: 8px; margin-top: 16px; padding-top: 14px;
  border-top: 1px solid var(--border-light);
}
.confirm-actions .btn { flex: 1; }

.confirm-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 16px; text-align: center;
}
.confirm-icon {
  width: 48px; height: 48px; border-radius: 50%; background: var(--green-bg); color: var(--green);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; margin-bottom: 12px;
}
.confirm-text { font-size: 14px; color: var(--text-secondary); }

.guide-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 32px 12px; text-align: center;
}
.guide-icon { margin-bottom: 12px; }
.guide-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.guide-desc { font-size: 12px; color: var(--text-muted); line-height: 1.7; margin-bottom: 16px; }
.guide-examples { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.guide-tag {
  font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full);
  background: var(--bg); color: var(--text-muted); border: 1px solid var(--border-light);
}

@media (max-width: 1024px) { .dashboard { flex-direction: column; } .dash-right { width: 100%; position: static; } }
@media (max-width: 768px) { .page-header { flex-direction: column; align-items: flex-start; gap: 12px; } .mid-grid { grid-template-columns: 1fr; } }

.fu-btn {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 11.5px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--t-fast);
}
.fu-btn:hover { border-color: var(--primary); color: var(--primary); }
</style>
