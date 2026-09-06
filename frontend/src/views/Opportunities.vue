<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useOpportunitiesStore } from '../stores/opportunities'
import { useClientsStore } from '../stores/clients'
import { OPPORTUNITY_STAGES, type Opportunity, type OpportunityStage } from '../types'
import { message } from '../utils/notify'

const opportunitiesStore = useOpportunitiesStore()
const clientsStore = useClientsStore()

const searchQuery = ref('')
const showEditModal = ref(false)
const editingId = ref<string | null>(null)

const formName = ref('')
const formStage = ref<OpportunityStage>('lead')
const formAmount = ref(0)
const formClientId = ref<string | null>(null)
const formCompetitor = ref('')
const formBidDeadline = ref('')
const formOpenBidDate = ref('')
const formDepositDueDate = ref('')
const formNote = ref('')

function getClientName(id: string | null) {
  if (!id) return ''
  return clientsStore.clients.find(c => c.id === id)?.name || ''
}

/** 距离截止日的天数（本地时区），空日期返回 null */
function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function deadlineLevel(dateStr: string): 'none' | 'overdue' | 'urgent' | 'warning' | 'normal' {
  const days = daysUntil(dateStr)
  if (days === null) return 'none'
  if (days < 0) return 'overdue'
  if (days <= 3) return 'urgent'
  if (days <= 7) return 'warning'
  return 'normal'
}

function countdownText(dateStr: string): string {
  const days = daysUntil(dateStr)
  if (days === null) return ''
  if (days < 0) return `已逾期${Math.abs(days)}天`
  if (days === 0) return '今天截止'
  return `还剩${days}天`
}

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return opportunitiesStore.opportunities
  return opportunitiesStore.opportunities.filter(o =>
    o.name.toLowerCase().includes(q) ||
    getClientName(o.clientId).toLowerCase().includes(q) ||
    o.competitor.toLowerCase().includes(q)
  )
})

/** 按阶段分组；活跃阶段按递交截止升序（空日期靠后），已定结果按更新时间倒序 */
const columns = computed(() =>
  OPPORTUNITY_STAGES.map(stage => {
    const items = filtered.value
      .filter(o => o.stage === stage.id)
      .sort((a, b) => {
        if (stage.id === 'won' || stage.id === 'lost') return b.updatedAt.localeCompare(a.updatedAt)
        const da = a.bidDeadline || '9999-12-31'
        const db = b.bidDeadline || '9999-12-31'
        return da.localeCompare(db)
      })
    return { ...stage, items }
  })
)

const stats = computed(() => {
  const all = opportunitiesStore.opportunities
  const bidding = all.filter(o => o.stage === 'bidding' || o.stage === 'waiting').length
  const urgent = opportunitiesStore.deadlinesWithin(7).length
  return {
    total: all.length,
    bidding,
    urgent,
    winRate: opportunitiesStore.winRate ?? null,
  }
})

function openAdd() {
  editingId.value = null
  formName.value = ''
  formStage.value = 'lead'
  formAmount.value = 0
  formClientId.value = null
  formCompetitor.value = ''
  formBidDeadline.value = ''
  formOpenBidDate.value = ''
  formDepositDueDate.value = ''
  formNote.value = ''
  showEditModal.value = true
}

function openEdit(o: Opportunity) {
  editingId.value = o.id
  formName.value = o.name
  formStage.value = o.stage
  formAmount.value = o.expectedAmount
  formClientId.value = o.clientId
  formCompetitor.value = o.competitor
  formBidDeadline.value = o.bidDeadline
  formOpenBidDate.value = o.openBidDate
  formDepositDueDate.value = o.depositDueDate
  formNote.value = o.note
  showEditModal.value = true
}

function save() {
  if (!formName.value.trim()) return message.warning('请输入商机名称')
  const data = {
    name: formName.value.trim(),
    stage: formStage.value,
    expectedAmount: Number(formAmount.value) || 0,
    clientId: formClientId.value,
    competitor: formCompetitor.value.trim(),
    bidDeadline: formBidDeadline.value,
    openBidDate: formOpenBidDate.value,
    depositDueDate: formDepositDueDate.value,
    note: formNote.value.trim()
  }
  if (editingId.value) {
    opportunitiesStore.updateOpportunity(editingId.value, data)
    message.success('商机已更新')
  } else {
    opportunitiesStore.addOpportunity(data)
    message.success('商机已创建')
  }
  showEditModal.value = false
}

function remove(o: Opportunity) {
  if (!confirm(`删除商机「${o.name}」？可在回收站恢复。`)) return
  opportunitiesStore.removeOpportunity(o.id)
  message.success('已移入回收站')
}

function clientOptions() {
  return clientsStore.clients
}

onMounted(() => {
  opportunitiesStore.loadOpportunities()
  clientsStore.loadClients()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">商机管理</h1>
        <p class="page-subtitle">从线索到中标的完整跟进，关键日期自动提醒</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">+ 新建商机</button>
    </div>

    <div class="stats-row">
      <div class="stat-card card"><div class="stat-val">{{ stats.total }}</div><div class="stat-lbl">全部商机</div></div>
      <div class="stat-card card"><div class="stat-val">{{ stats.bidding }}</div><div class="stat-lbl">投标/等结果中</div></div>
      <div class="stat-card card" :class="{ 'stat-urgent': stats.urgent > 0 }">
        <div class="stat-val">{{ stats.urgent }}</div><div class="stat-lbl">7天内递交截止</div>
      </div>
      <div class="stat-card card">
        <div class="stat-val">{{ stats.winRate === null ? '—' : stats.winRate + '%' }}</div><div class="stat-lbl">中标率</div>
      </div>
    </div>

    <div class="toolbar">
      <input
        v-model="searchQuery"
        class="input opp-search"
        type="text"
        placeholder="搜索商机名称、客户、竞争对手..."
      />
    </div>

    <div class="kanban">
      <div v-for="col in columns" :key="col.id" class="kanban-col">
        <div class="col-header">
          <span class="col-dot" :style="{ background: col.color }"></span>
          <span class="col-title">{{ col.name }}</span>
          <span class="col-count">{{ col.items.length }}</span>
        </div>
        <div class="col-body">
          <div v-if="col.items.length === 0" class="col-empty">暂无</div>
          <div v-for="o in col.items" :key="o.id" class="opp-card" @click="openEdit(o)">
            <div class="opp-name">{{ o.name }}</div>
            <div v-if="o.expectedAmount" class="opp-amount">¥{{ o.expectedAmount }}万</div>
            <div v-if="getClientName(o.clientId)" class="opp-client">{{ getClientName(o.clientId) }}</div>
            <div v-if="o.bidDeadline" class="opp-date" :class="'dl-' + deadlineLevel(o.bidDeadline)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              递交 {{ o.bidDeadline.slice(5) }} · {{ countdownText(o.bidDeadline) }}
            </div>
            <div v-if="o.openBidDate" class="opp-date">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>
              开标 {{ o.openBidDate.slice(5) }}
            </div>
            <div v-if="o.competitor" class="opp-comp">对手：{{ o.competitor }}</div>
            <button class="opp-del" @click.stop="remove(o)" title="删除">&times;</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditModal" class="modal-mask" @click.self="showEditModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingId ? '编辑商机' : '新建商机' }}</h3>
          <button class="btn-icon" @click="showEditModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>商机名称 <span class="required">*</span></label>
            <input v-model="formName" class="input" type="text" placeholder="例如：某某局智慧XX平台采购项目" />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>阶段</label>
              <select v-model="formStage" class="input">
                <option v-for="s in OPPORTUNITY_STAGES" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>预计金额（万元）</label>
              <input v-model.number="formAmount" class="input" type="number" min="0" />
            </div>
          </div>
          <div class="form-field">
            <label>关联客户</label>
            <select v-model="formClientId" class="input">
              <option :value="null">不关联</option>
              <option v-for="c in clientOptions()" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>标书递交截止</label>
              <input v-model="formBidDeadline" class="input" type="date" />
            </div>
            <div class="form-field">
              <label>开标日</label>
              <input v-model="formOpenBidDate" class="input" type="date" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>保证金缴纳截止</label>
              <input v-model="formDepositDueDate" class="input" type="date" />
            </div>
            <div class="form-field">
              <label>主要竞争对手</label>
              <input v-model="formCompetitor" class="input" type="text" placeholder="选填" />
            </div>
          </div>
          <div class="form-field">
            <label>备注</label>
            <textarea v-model="formNote" class="input" rows="2" placeholder="当前进展、风险等"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { text-align: center; padding: 16px 12px; }
.stat-val { font-size: 24px; font-weight: 700; color: var(--text); }
.stat-lbl { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.stat-urgent .stat-val { color: var(--rose); }

.toolbar { margin-bottom: 14px; }
.opp-search { max-width: 360px; width: 100%; }

.kanban { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 12px; align-items: flex-start; }
.kanban-col {
  flex: 1 0 240px; min-width: 240px;
  background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: var(--radius); padding: 12px;
}
.col-header { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
.col-dot { width: 9px; height: 9px; border-radius: 50%; }
.col-title { font-size: 14px; font-weight: 600; color: var(--text); }
.col-count {
  margin-left: auto; font-size: 12.5px; color: var(--text-muted);
  background: var(--bg-hover); border-radius: var(--radius-full); padding: 1px 8px;
}
.col-body { display: flex; flex-direction: column; gap: 8px; min-height: 60px; }
.col-empty { text-align: center; color: var(--text-muted); font-size: 13px; padding: 16px 0; }

.opp-card {
  position: relative;
  background: var(--bg); border: 1px solid var(--border-light);
  border-radius: var(--radius-sm); padding: 10px 12px;
  cursor: pointer; transition: border-color var(--t-fast);
}
.opp-card:hover { border-color: var(--primary); }
.opp-name { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; padding-right: 16px; }
.opp-amount { font-size: 13.5px; font-weight: 600; color: var(--primary-hover, var(--primary)); margin-top: 3px; }
.opp-client { font-size: 12.5px; color: var(--text-secondary); margin-top: 3px; }
.opp-date {
  display: flex; align-items: center; gap: 4px;
  font-size: 12.5px; color: var(--text-muted); margin-top: 5px;
}
.opp-date.dl-overdue { color: var(--rose); font-weight: 600; }
.opp-date.dl-urgent { color: var(--rose); }
.opp-date.dl-warning { color: var(--amber); font-weight: 500; }
.opp-comp { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.opp-del {
  position: absolute; top: 6px; right: 6px;
  width: 18px; height: 18px; line-height: 1;
  border: none; background: none; cursor: pointer;
  color: var(--text-muted); font-size: 15px; border-radius: 4px;
  opacity: 0; transition: opacity var(--t-fast);
}
.opp-card:hover .opp-del { opacity: 1; }
.opp-del:hover { color: var(--rose); background: var(--rose-bg); }

.modal-mask {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15, 23, 42, 0.4);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.modal {
  background: var(--bg-card); border-radius: var(--radius-lg);
  width: 560px; max-width: 96vw; max-height: 88vh;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px 0;
}
.modal-header h3 { font-size: 17px; color: var(--text); }
.btn-icon { border: none; background: none; font-size: 20px; cursor: pointer; color: var(--text-muted); }
.modal-body { padding: 16px 22px; overflow-y: auto; }
.form-field { margin-bottom: 12px; flex: 1; }
.form-field label { display: block; font-size: 13.5px; color: var(--text-secondary); margin-bottom: 5px; }
.required { color: var(--rose); }
.form-row { display: flex; gap: 12px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 0 22px 18px; }

@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .form-row { flex-direction: column; gap: 0; }
}
</style>
