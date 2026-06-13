<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import { useClientsStore } from '../stores/clients'
import { analyzeEntry, confirmEntry } from '../services/smartEntry'
import type { PendingEntry } from '../services/smartEntry'
import { WORK_CATEGORIES } from '../types'

const router = useRouter()
const projectsStore = useProjectsStore()
const todosStore = useTodosStore()
const workLogsStore = useWorkLogsStore()
const clientsStore = useClientsStore()

const aiInput = ref('')
const pending = ref<PendingEntry | null>(null)
const confirmed = ref(false)
const statusMsg = ref('')

const todayStr = new Date().toISOString().split('T')[0]
const todayFormatted = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
})

const stats = computed(() => ({
  activeProjects: projectsStore.inProgressProjects.length,
  pendingTodos: todosStore.pendingTodos.length + todosStore.inProgressTodos.length,
  todayLogs: workLogsStore.workLogs.filter(w => w.date === todayStr).length
}))

const recentLogs = computed(() =>
  [...workLogsStore.workLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
)

const recentTodos = computed(() =>
  [...todosStore.todos]
    .filter(t => t.status !== 'completed')
    .sort((a, b) => {
      const pri: Record<string, number> = { high: 0, medium: 1, low: 2 }
      return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1)
    })
    .slice(0, 6)
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

function handleAnalyze() {
  const text = aiInput.value.trim()
  if (!text) return
  confirmed.value = false
  statusMsg.value = ''
  pending.value = analyzeEntry(text, { projectsStore, todosStore, clientsStore })
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnalyze() }
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

function priorityLabel(p: string) {
  return p === 'high' ? '紧急' : p === 'low' ? '低' : '中'
}

onMounted(() => {
  projectsStore.loadProjects()
  projectsStore.loadPhases()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  clientsStore.loadClients()
})
</script>

<template>
  <div class="dashboard">
    <div class="dash-left">
      <div class="page-header">
        <div>
          <h1 class="page-title">工作台</h1>
          <p class="page-subtitle">{{ todayFormatted }}</p>
        </div>
        <div class="stats">
          <div class="stat-item" @click="router.push('/projects')">
            <span class="stat-num">{{ stats.activeProjects }}</span>
            <span class="stat-label">进行中</span>
          </div>
          <div class="stat-item" @click="router.push('/todos')">
            <span class="stat-num">{{ stats.pendingTodos }}</span>
            <span class="stat-label">待办</span>
          </div>
          <div class="stat-item" @click="router.push('/calendar')">
            <span class="stat-num">{{ stats.todayLogs }}</span>
            <span class="stat-label">今日日志</span>
          </div>
        </div>
      </div>

      <div class="card input-card">
        <textarea
          v-model="aiInput"
          placeholder="记录今天的工作内容，系统会自动识别项目、客户、日志和待办...&#10;例如：今天去了市大数据局汇报智慧城市项目方案，明天跟进预算确认"
          class="smart-input"
          rows="2"
          @keydown="handleKeydown"
        ></textarea>
        <div class="input-actions">
          <span class="input-hint">Enter 分析 · 系统自动识别</span>
          <button class="btn btn-primary btn-sm" :disabled="!aiInput.trim()" @click="handleAnalyze">分析</button>
        </div>
      </div>

      <div class="mid-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">近期日志</span>
            <button class="link" @click="router.push('/calendar')">查看全部</button>
          </div>
          <div v-if="recentLogs.length === 0" class="card-empty">暂无日志记录</div>
          <div v-for="log in recentLogs" :key="log.id" class="list-row" @click="router.push('/calendar')">
            <span class="row-date">{{ log.date.slice(5) }}</span>
            <span class="row-text">{{ log.content }}</span>
            <span v-if="getProjectName(log.projectId)" class="badge badge-blue">{{ getProjectName(log.projectId) }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">待办事项</span>
            <button class="link" @click="router.push('/todos')">查看全部</button>
          </div>
          <div v-if="recentTodos.length === 0" class="card-empty">暂无待办</div>
          <div v-for="t in recentTodos" :key="t.id" class="list-row">
            <span :class="['dot', t.priority === 'high' ? 'dot-rose' : t.priority === 'medium' ? 'dot-amber' : 'dot-muted']"></span>
            <span class="row-text">{{ t.title }}</span>
            <span class="row-date">{{ t.dueDate?.slice(5) || '' }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">项目概览</span>
          <button class="link" @click="router.push('/projects')">查看全部</button>
        </div>
        <div v-if="projectsStore.projects.length === 0" class="card-empty">暂无项目</div>
        <div class="project-grid">
          <div v-for="p in projectsStore.projects.slice(0, 6)" :key="p.id" class="project-item" @click="router.push(`/projects/${p.id}`)">
            <div class="project-top">
              <span class="project-name">{{ p.name }}</span>
              <span class="project-pct">{{ p.progress }}%</span>
            </div>
            <div class="progress-track"><div class="progress-fill" :style="{ width: p.progress + '%' }"></div></div>
            <span class="project-phase">{{ projectsStore.phases.find(ph => ph.id === p.currentPhaseId)?.name || '' }}</span>
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
.dashboard { display: flex; gap: 20px; width: 100%; min-height: 100%; }
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

.input-card { margin-bottom: 16px; }
.smart-input {
  width: 100%; border: none; outline: none; font-size: 14px; font-family: var(--font);
  line-height: 1.6; resize: none; background: transparent; color: var(--text);
  padding: 14px 18px 8px; min-height: 28px;
}
.smart-input::placeholder { color: var(--text-placeholder); }
.input-actions { display: flex; justify-content: space-between; align-items: center; padding: 8px 18px 12px; }
.input-hint { font-size: 12px; color: var(--text-muted); }

.mid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.row-date { font-size: 12px; font-weight: 500; color: var(--primary); flex-shrink: 0; min-width: 40px; }
.row-text { flex: 1; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; padding: 14px 18px; }
.project-item {
  background: var(--bg); border: 1px solid var(--border-light); border-radius: var(--radius-sm);
  padding: 12px; cursor: pointer; transition: all 0.15s;
}
.project-item:hover { border-color: var(--primary); box-shadow: var(--shadow-xs); }
.project-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.project-name { font-size: 13px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project-pct { font-size: 12px; font-weight: 700; color: var(--primary); flex-shrink: 0; }
.project-phase { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block; }

.dash-right {
  width: 440px; flex-shrink: 0; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden; align-self: flex-start;
  position: sticky; top: 0; margin-top: 82px;
}
.right-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid var(--border-light);
}
.right-title { font-size: 14px; font-weight: 600; color: var(--text); }
.right-body { padding: 16px 18px; max-height: calc(100vh - 242px); overflow-y: auto; }

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
@media (max-width: 768px) { .page-header { flex-direction: column; align-items: flex-start; gap: 12px; } .mid-grid { grid-template-columns: 1fr; } .project-grid { grid-template-columns: 1fr; } }
</style>
