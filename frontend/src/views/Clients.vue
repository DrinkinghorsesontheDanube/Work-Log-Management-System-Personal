<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClientsStore } from '../stores/clients'
import { useProjectsStore } from '../stores/projects'
import type { Client, ContactPerson } from '../types'

const router = useRouter()
const clientsStore = useClientsStore()
const projectsStore = useProjectsStore()

const searchQuery = ref('')
const filterType = ref<string>('all')
const filterImportance = ref<string>('all')
const filterStatus = ref<string>('all')

const showModal = ref(false)
const editingClient = ref<Client | null>(null)
const formName = ref('')
const formType = ref<Client['type']>('government')
const formContacts = ref<ContactPerson[]>([createEmptyContact(true)])
const formRegion = ref('')
const formIndustry = ref('')
const formImportance = ref<Client['importance']>('B')
const formFollowUpStatus = ref<Client['followUpStatus']>('active')
const formSource = ref('')
const formNextFollowUpDate = ref('')
const formNotes = ref('')

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmDanger = ref(false)
let confirmResolve: ((v: boolean) => void) | null = null

function showConfirm(title: string, message: string, danger = false): Promise<boolean> {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmDanger.value = danger
  confirmVisible.value = true
  return new Promise(resolve => { confirmResolve = resolve })
}
function onConfirmOk() { confirmVisible.value = false; confirmResolve?.(true) }
function onConfirmCancel() { confirmVisible.value = false; confirmResolve?.(false) }

function createEmptyContact(isPrimary = false): ContactPerson {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: '',
    title: '',
    department: '',
    phone: '',
    email: '',
    role: 'executor',
    responsibility: '',
    isPrimary,
    notes: ''
  }
}

const roleOptions: { label: string; value: ContactPerson['role'] }[] = [
  { label: '负责人', value: 'leader' },
  { label: '经办人', value: 'executor' }
]

const roleLabel: Record<ContactPerson['role'], string> = {
  leader: '负责人',
  executor: '经办人'
}

function getPrimaryContact(client: Client): ContactPerson | undefined {
  return client.contacts.find(c => c.isPrimary) || client.contacts[0]
}

const typeOptions: { label: string; value: Client['type'] }[] = [
  { label: '政府单位', value: 'government' },
  { label: '企业', value: 'enterprise' },
  { label: '事业单位', value: 'institution' }
]

const importanceOptions: { label: string; value: Client['importance'] }[] = [
  { label: 'A级', value: 'A' },
  { label: 'B级', value: 'B' },
  { label: 'C级', value: 'C' }
]

const followUpOptions: { label: string; value: Client['followUpStatus'] }[] = [
  { label: '活跃', value: 'active' },
  { label: '待跟进', value: 'pending' },
  { label: '流失', value: 'lost' }
]

const typeLabel: Record<Client['type'], string> = {
  government: '政府单位',
  enterprise: '企业',
  institution: '事业单位'
}

const importanceLabel: Record<Client['importance'], string> = {
  A: 'A级', B: 'B级', C: 'C级'
}

const followUpLabel: Record<Client['followUpStatus'], string> = {
  active: '活跃', pending: '待跟进', lost: '流失'
}

function getClientProjectCount(clientId: string) {
  return projectsStore.projects.filter(p => p.clientId === clientId).length
}

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const stats = computed(() => ({
  total: clientsStore.clients.length,
  active: clientsStore.clients.filter(c => c.followUpStatus === 'active').length,
  pending: clientsStore.clients.filter(c => c.followUpStatus === 'pending').length,
  keyAccounts: clientsStore.clients.filter(c => c.importance === 'A').length
}))

const filteredClients = computed(() => {
  let list = [...clientsStore.clients]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.contacts.some(ct =>
        ct.name.toLowerCase().includes(q) ||
        ct.department.toLowerCase().includes(q) ||
        roleLabel[ct.role].includes(q)
      )
    )
  }
  if (filterType.value !== 'all') {
    list = list.filter(c => c.type === filterType.value)
  }
  if (filterImportance.value !== 'all') {
    list = list.filter(c => c.importance === filterImportance.value)
  }
  if (filterStatus.value !== 'all') {
    list = list.filter(c => c.followUpStatus === filterStatus.value)
  }
  return list
})

function openAdd() {
  editingClient.value = null
  formName.value = ''
  formType.value = 'government'
  formContacts.value = [createEmptyContact(true)]
  formRegion.value = ''
  formIndustry.value = ''
  formImportance.value = 'B'
  formFollowUpStatus.value = 'active'
  formSource.value = ''
  formNextFollowUpDate.value = ''
  formNotes.value = ''
  showModal.value = true
}

function openEdit(client: Client, e: Event) {
  e.stopPropagation()
  editingClient.value = client
  formName.value = client.name
  formType.value = client.type
  formContacts.value = client.contacts.map(c => ({ ...c, role: c.role || 'executor' }))
  formRegion.value = client.region
  formIndustry.value = client.industry
  formImportance.value = client.importance
  formFollowUpStatus.value = client.followUpStatus
  formSource.value = client.source
  formNextFollowUpDate.value = client.nextFollowUpDate || ''
  formNotes.value = client.notes
  showModal.value = true
}

function addContact() {
  formContacts.value.push(createEmptyContact(false))
}

function removeContact(index: number) {
  if (formContacts.value.length <= 1) return
  formContacts.value.splice(index, 1)
  if (!formContacts.value.some(c => c.isPrimary)) {
    formContacts.value[0].isPrimary = true
  }
}

function setPrimary(index: number) {
  formContacts.value.forEach((c, i) => { c.isPrimary = i === index })
}

function save() {
  if (!formName.value.trim()) return
  const contacts = formContacts.value
    .filter(c => c.name.trim())
    .map((c, i, arr) => ({
      ...c,
      isPrimary: arr.some(x => x.isPrimary) ? c.isPrimary : i === 0
    }))
  if (contacts.length === 0) {
    contacts.push({ ...formContacts.value[0], isPrimary: true })
  }
  const data = {
    name: formName.value,
    type: formType.value,
    contacts,
    region: formRegion.value,
    industry: formIndustry.value,
    importance: formImportance.value,
    followUpStatus: formFollowUpStatus.value,
    source: formSource.value,
    nextFollowUpDate: formNextFollowUpDate.value || null,
    notes: formNotes.value
  }
  if (editingClient.value) {
    clientsStore.updateClient(editingClient.value.id, data)
  } else {
    clientsStore.addClient(data)
  }
  showModal.value = false
}

async function remove(id: string, e: Event) {
  e.stopPropagation()
  const ok = await showConfirm('删除客户', '确定要删除该客户吗？删除后相关数据将无法恢复。', true)
  if (ok) {
    clientsStore.deleteClient(id)
  }
}

function goToDetail(client: Client) {
  router.push(`/clients/${client.id}`)
}

onMounted(() => {
  clientsStore.loadClients()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">客户管理</h1>
        <p class="page-subtitle">管理政府、企业及事业单位客户信息</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card stat-blue">
        <div class="stat-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="stat-content">
          <div class="stat-val">{{ stats.total }}</div>
          <div class="stat-lbl">客户总数</div>
        </div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="stat-content">
          <div class="stat-val">{{ stats.active }}</div>
          <div class="stat-lbl">活跃客户</div>
        </div>
      </div>
      <div class="stat-card stat-amber">
        <div class="stat-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-content">
          <div class="stat-val">{{ stats.pending }}</div>
          <div class="stat-lbl">待跟进</div>
        </div>
      </div>
      <div class="stat-card stat-purple">
        <div class="stat-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="stat-content">
          <div class="stat-val">{{ stats.keyAccounts }}</div>
          <div class="stat-lbl">重点客户</div>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-wrap">
          <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="searchQuery" placeholder="搜索客户名称、联系人、部门..." class="search-input" />
        </div>
        <select v-model="filterType" class="filter-select">
          <option value="all">全部类型</option>
          <option value="government">政府单位</option>
          <option value="enterprise">企业</option>
          <option value="institution">事业单位</option>
        </select>
        <select v-model="filterImportance" class="filter-select">
          <option value="all">全部等级</option>
          <option value="A">A级</option>
          <option value="B">B级</option>
          <option value="C">C级</option>
        </select>
        <select v-model="filterStatus" class="filter-select">
          <option value="all">全部状态</option>
          <option value="active">活跃</option>
          <option value="pending">待跟进</option>
          <option value="lost">流失</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" @click="openAdd">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新增客户
        </button>
      </div>
    </div>

    <div v-if="filteredClients.length === 0" class="card">
      <div class="card-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <p style="margin-top: 10px">{{ searchQuery || filterType !== 'all' || filterImportance !== 'all' || filterStatus !== 'all' ? '没有找到匹配的客户' : '暂无客户数据，点击「新增客户」开始' }}</p>
      </div>
    </div>

    <div v-else class="client-grid">
      <div
        v-for="client in filteredClients"
        :key="client.id"
        class="client-card card"
        @click="goToDetail(client)"
      >
        <div class="client-card-header">
          <div class="client-main-info">
            <div class="client-name-row">
              <span class="client-name">{{ client.name }}</span>
              <span :class="['badge', client.type === 'government' ? 'badge-blue' : client.type === 'enterprise' ? 'badge-green' : 'badge-amber']">{{ typeLabel[client.type] }}</span>
              <span :class="['imp-badge', `imp-${client.importance}`]">{{ importanceLabel[client.importance] }}</span>
            </div>
            <div class="header-right">
              <span class="contacts-count-badge">{{ client.contacts.length }}人</span>
              <div :class="['follow-badge', `follow-${client.followUpStatus}`]">
                <span class="follow-dot"></span>
                {{ followUpLabel[client.followUpStatus] }}
              </div>
            </div>
          </div>
        </div>

        <div class="client-card-body">
          <div class="info-grid">
            <div class="info-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span class="contact-display">
                {{ getPrimaryContact(client)?.name || '-' }}
                <span v-if="getPrimaryContact(client)" :class="['role-badge', `role-${getPrimaryContact(client)!.role}`]">{{ roleLabel[getPrimaryContact(client)!.role] }}</span>
                <template v-if="getPrimaryContact(client)?.title"> · {{ getPrimaryContact(client)!.title }}</template>
              </span>
            </div>
            <div class="info-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>{{ getPrimaryContact(client)?.phone || '-' }}</span>
            </div>
            <div class="info-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>{{ getPrimaryContact(client)?.department || '-' }}</span>
            </div>
            <div class="info-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>{{ client.region || '-' }}</span>
            </div>
          </div>
        </div>

        <div class="client-card-footer">
          <div class="footer-meta">
            <span class="meta-tag" title="上次联系">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              上次: {{ formatDate(client.lastContactDate) }}
            </span>
            <span class="meta-tag" :class="{ 'meta-overdue': getDaysUntil(client.nextFollowUpDate) !== null && getDaysUntil(client.nextFollowUpDate)! < 0, 'meta-urgent': getDaysUntil(client.nextFollowUpDate) !== null && getDaysUntil(client.nextFollowUpDate)! >= 0 && getDaysUntil(client.nextFollowUpDate)! <= 3 }" title="下次跟进">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <template v-if="client.nextFollowUpDate">
                <template v-if="getDaysUntil(client.nextFollowUpDate)! < 0">逾期{{ Math.abs(getDaysUntil(client.nextFollowUpDate)!) }}天</template>
                <template v-else-if="getDaysUntil(client.nextFollowUpDate) === 0">今天跟进</template>
                <template v-else>还剩{{ getDaysUntil(client.nextFollowUpDate) }}天</template>
              </template>
              <template v-else>未设定</template>
            </span>
            <span class="meta-tag" title="关联项目">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              {{ getClientProjectCount(client.id) }}个项目
            </span>
          </div>
          <div class="card-actions">
            <button class="btn-icon" @click="openEdit(client, $event)" title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete-icon" @click="remove(client.id, $event)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            <button class="btn-icon" @click.stop="goToDetail(client)" title="客户详情">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>{{ editingClient ? '编辑客户' : '新增客户' }}</h3>
          <button class="btn-icon" @click="showModal = false" style="font-size:18px">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-field">
              <label>客户名称 <span class="required">*</span></label>
              <input v-model="formName" placeholder="请输入客户名称" class="input" />
            </div>
            <div class="form-field">
              <label>客户类型</label>
              <select v-model="formType" class="input">
                <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>

          <div class="contacts-section">
            <div class="contacts-header">
              <label class="contacts-title">联系人信息</label>
              <button class="btn btn-sm btn-outline" @click="addContact" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                添加联系人
              </button>
            </div>
            <div v-for="(contact, idx) in formContacts" :key="contact.id" class="contact-entry">
              <div class="contact-entry-header">
                <span class="contact-entry-title">联系人 {{ idx + 1 }}</span>
                <div class="contact-entry-actions">
                  <label class="primary-checkbox">
                    <input
                      type="checkbox"
                      :checked="contact.isPrimary"
                      @change="setPrimary(idx)"
                    />
                    <span>主要联系人</span>
                  </label>
                  <button
                    v-if="formContacts.length > 1"
                    class="btn-icon delete-icon"
                    @click="removeContact(idx)"
                    title="删除联系人"
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
              <div class="form-row form-row-3">
                <div class="form-field">
                  <label>姓名</label>
                  <input v-model="contact.name" placeholder="请输入联系人姓名" class="input" />
                </div>
                <div class="form-field">
                  <label>职务</label>
                  <input v-model="contact.title" placeholder="请输入职务" class="input" />
                </div>
                <div class="form-field">
                  <label>角色</label>
                  <select v-model="contact.role" class="input">
                    <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-field">
                  <label>部门</label>
                  <input v-model="contact.department" placeholder="请输入所属部门" class="input" />
                </div>
                <div class="form-field">
                  <label>联系电话</label>
                  <input v-model="contact.phone" placeholder="请输入联系电话" class="input" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-field">
                  <label>邮箱</label>
                  <input v-model="contact.email" type="email" placeholder="请输入邮箱地址" class="input" />
                </div>
                <div class="form-field">
                  <label>负责内容</label>
                  <input v-model="contact.responsibility" placeholder="请输入负责内容" class="input" />
                </div>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label>所在区域</label>
              <input v-model="formRegion" placeholder="请输入所在区域" class="input" />
            </div>
            <div class="form-field">
              <label>所属行业</label>
              <input v-model="formIndustry" placeholder="请输入所属行业" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>重要等级</label>
              <select v-model="formImportance" class="input">
                <option v-for="opt in importanceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>跟进状态</label>
              <select v-model="formFollowUpStatus" class="input">
                <option v-for="opt in followUpOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>客户来源</label>
              <input v-model="formSource" placeholder="请输入客户来源" class="input" />
            </div>
            <div class="form-field">
              <label>下次跟进日期</label>
              <input v-model="formNextFollowUpDate" type="date" class="input" />
            </div>
          </div>
          <div class="form-field">
            <label>备注</label>
            <textarea v-model="formNotes" placeholder="请输入备注信息" class="input" rows="3"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>

    <div v-if="confirmVisible" class="confirm-overlay" @click.self="onConfirmCancel">
      <div class="confirm-dialog">
        <div class="confirm-icon-wrap danger">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="confirm-title">{{ confirmTitle }}</div>
        <div class="confirm-desc">{{ confirmMessage }}</div>
        <div class="confirm-btns">
          <button class="confirm-btn cancel" @click="onConfirmCancel">取消</button>
          <button class="confirm-btn danger" @click="onConfirmOk">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}
.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-blue .stat-icon {
  background: #eff6ff;
  color: #3b82f6;
}
.stat-green .stat-icon {
  background: #f0fdf4;
  color: #22c55e;
}
.stat-amber .stat-icon {
  background: #fffbeb;
  color: #f59e0b;
}
.stat-purple .stat-icon {
  background: #faf5ff;
  color: #a855f7;
}

.stat-val {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}
.stat-lbl {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
}
.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 320px;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 7px 12px 7px 34px;
  font-size: 13px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
  font-family: var(--font);
}
.search-input:focus {
  border-color: var(--primary);
}
.search-input::placeholder {
  color: var(--text-muted);
}

.filter-select {
  padding: 7px 10px;
  font-size: 13px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  outline: none;
  cursor: pointer;
  font-family: var(--font);
  min-width: 100px;
}
.filter-select:focus {
  border-color: var(--primary);
}

.client-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.client-card {
  padding: 0;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}
.client-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  border-color: var(--primary);
}

.client-card-header {
  padding: 16px 18px 0;
}

.client-main-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.client-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.client-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.contacts-count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: #eff6ff;
  color: #3b82f6;
  white-space: nowrap;
}

.imp-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.imp-A {
  background: #fef2f2;
  color: #ef4444;
}
.imp-B {
  background: #fffbeb;
  color: #d97706;
}
.imp-C {
  background: #f1f5f9;
  color: #94a3b8;
}

.role-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  vertical-align: middle;
  flex-shrink: 0;
}
.role-leader {
  background: #eff6ff;
  color: #2563eb;
}
.role-executor {
  background: #f0fdf4;
  color: #16a34a;
}

.contact-display {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follow-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  white-space: nowrap;
}
.follow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.follow-active {
  background: #f0fdf4;
  color: #16a34a;
}
.follow-active .follow-dot {
  background: #22c55e;
}
.follow-pending {
  background: #fffbeb;
  color: #d97706;
}
.follow-pending .follow-dot {
  background: #f59e0b;
}
.follow-lost {
  background: #fef2f2;
  color: #dc2626;
}
.follow-lost .follow-dot {
  background: #ef4444;
}

.client-card-body {
  padding: 14px 18px 0;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
.info-item svg {
  color: var(--text-muted);
  flex-shrink: 0;
}
.info-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.client-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  margin-top: 14px;
  border-top: 1px solid var(--border-light);
}

.footer-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}
.meta-overdue {
  color: #ef4444;
  font-weight: 600;
}
.meta-urgent {
  color: #d97706;
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.delete-icon:hover {
  background: var(--rose-bg);
  color: var(--rose);
}

.contacts-section {
  margin-bottom: 14px;
}
.contacts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.contacts-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.contact-entry {
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 12px;
  background: var(--bg-page, #f8fafc);
}
.contact-entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.contact-entry-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}
.contact-entry-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.primary-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  margin: 0;
  padding: 0;
}
.primary-checkbox input[type="checkbox"] {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--primary);
  cursor: pointer;
  flex-shrink: 0;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
.btn-outline {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  border-radius: var(--radius);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.btn-outline:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.form-row-3 {
  grid-template-columns: 1fr 1fr 1fr;
}
.form-field {
  margin-bottom: 0;
}
.form-field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 5px;
}
.required {
  color: var(--rose);
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.confirm-dialog {
  background: #fff;
  border-radius: 16px;
  padding: 32px 32px 24px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);
  text-align: center;
}
.confirm-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  background: #eef2ff;
  color: #6366f1;
}
.confirm-icon-wrap.danger {
  background: #fef2f2;
  color: #ef4444;
}
.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 6px;
}
.confirm-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 24px;
}
.confirm-btns {
  display: flex;
  gap: 10px;
}
.confirm-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}
.confirm-btn.cancel {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.confirm-btn.cancel:hover {
  background: #e2e8f0;
}
.confirm-btn.danger {
  background: #ef4444;
  color: #fff;
}
.confirm-btn.danger:hover {
  background: #dc2626;
}

@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .client-grid {
    grid-template-columns: 1fr;
  }
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar-left {
    flex-direction: column;
  }
  .search-wrap {
    max-width: none;
  }
  .filter-select {
    width: 100%;
  }
  .toolbar-right {
    justify-content: flex-end;
  }
}

@media (max-width: 600px) {
  .stats-row {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .stat-card {
    padding: 14px 12px;
    gap: 10px;
  }
  .stat-icon {
    width: 36px;
    height: 36px;
  }
  .stat-val {
    font-size: 20px;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .form-row-3 {
    grid-template-columns: 1fr;
  }
  .info-grid {
    grid-template-columns: 1fr;
  }
  .client-main-info {
    flex-direction: column;
    gap: 8px;
  }
  .footer-meta {
    flex-direction: column;
    gap: 4px;
  }
  .client-card-footer {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
}
</style>
