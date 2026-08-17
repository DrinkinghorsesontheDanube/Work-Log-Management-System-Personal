<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClientsStore } from '../stores/clients'
import { useProjectsStore } from '../stores/projects'
import { useWorkLogsStore } from '../stores/workLogs'
import type { Client, ContactPerson, VisitRecord, Project, WorkLog } from '../types'
import { WORK_CATEGORIES } from '../types'

const route = useRoute()
const router = useRouter()
const clientsStore = useClientsStore()
const projectsStore = useProjectsStore()
const workLogsStore = useWorkLogsStore()

const client = ref<Client | null>(null)
const activeTab = ref<'overview' | 'contacts' | 'projects' | 'visits' | 'logs'>('overview')

const showEditModal = ref(false)
const formName = ref('')
const formType = ref<Client['type']>('government')
const formRegion = ref('')
const formIndustry = ref('')
const formImportance = ref<Client['importance']>('B')
const formFollowUpStatus = ref<Client['followUpStatus']>('active')
const formSource = ref('')
const formNextFollowUpDate = ref('')
const formNotes = ref('')

const showContactModal = ref(false)
const editingContactId = ref<string | null>(null)
const contactFormName = ref('')
const contactFormTitle = ref('')
const contactFormDepartment = ref('')
const contactFormPhone = ref('')
const contactFormEmail = ref('')
const contactFormRole = ref<'leader' | 'executor'>('executor')
const contactFormResponsibility = ref('')
const contactFormIsPrimary = ref(false)
const contactFormNotes = ref('')

const roleOptions: { label: string; value: 'leader' | 'executor' }[] = [
  { label: '负责人', value: 'leader' },
  { label: '经办人', value: 'executor' }
]

const showVisitModal = ref(false)
const visitDate = ref('')
const visitContact = ref('')
const visitContactPersonId = ref('')
const visitContent = ref('')
const visitResult = ref('')
const visitNextPlan = ref('')

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const pendingDeleteVisitId = ref<string | null>(null)
const pendingDeleteContactId = ref<string | null>(null)

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

const statusLabel: Record<string, string> = {
  planning: '规划中', in_progress: '进行中', completed: '已完成', paused: '已暂停'
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

const primaryContact = computed<ContactPerson | null>(() => {
  if (!client.value) return null
  return client.value.contacts.find(c => c.isPrimary) || client.value.contacts[0] || null
})

const linkedProjects = computed<Project[]>(() => {
  if (!client.value) return []
  return projectsStore.projects.filter(p => p.clientId === client.value!.id)
})

const linkedWorkLogs = computed<WorkLog[]>(() => {
  if (!client.value) return []
  return workLogsStore.workLogs
    .filter(w => w.clientId === client.value!.id)
    .sort((a, b) => b.date.localeCompare(a.date))
})

const visitRecords = computed<VisitRecord[]>(() => {
  if (!client.value) return []
  return clientsStore.getVisitsByClient(client.value.id)
})

const recentVisits = computed(() => visitRecords.value.slice(0, 3))

function getContactById(contactId: string): ContactPerson | undefined {
  if (!client.value) return undefined
  return client.value.contacts.find(c => c.id === contactId)
}

function getContactDisplay(contactId: string): string {
  if (!contactId) return ''
  const c = getContactById(contactId)
  if (!c) return ''
  const parts = [c.name, c.title, c.department].filter(Boolean)
  return parts.join(' - ')
}

function getVisitContactDisplay(visit: VisitRecord): string {
  if (visit.contactPersonId) {
    const display = getContactDisplay(visit.contactPersonId)
    if (display) return display
  }
  return visit.contact || '-'
}

function getCategoryLabel(categoryId: string): string {
  return WORK_CATEGORIES.find(c => c.id === categoryId)?.name || '其他'
}

function getRoleLabel(role: 'leader' | 'executor'): string {
  return role === 'leader' ? '负责人' : '经办人'
}

function getRoleClass(role: 'leader' | 'executor'): string {
  return role === 'leader' ? 'role-leader' : 'role-executor'
}

function getCategoryColor(categoryId: string): string {
  return WORK_CATEGORIES.find(c => c.id === categoryId)?.color || '#94a3b8'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '无记录'
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const days = Math.floor((now.getTime() - target.getTime()) / 86400000)
  if (days < 0) return `${Math.abs(days)}天后`
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days}天前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

function openEdit() {
  if (!client.value) return
  formName.value = client.value.name
  formType.value = client.value.type
  formRegion.value = client.value.region
  formIndustry.value = client.value.industry
  formImportance.value = client.value.importance
  formFollowUpStatus.value = client.value.followUpStatus
  formSource.value = client.value.source
  formNextFollowUpDate.value = client.value.nextFollowUpDate || ''
  formNotes.value = client.value.notes
  showEditModal.value = true
}

function saveClient() {
  if (!client.value || !formName.value.trim()) return
  clientsStore.updateClient(client.value.id, {
    name: formName.value,
    type: formType.value,
    region: formRegion.value,
    industry: formIndustry.value,
    importance: formImportance.value,
    followUpStatus: formFollowUpStatus.value,
    source: formSource.value,
    nextFollowUpDate: formNextFollowUpDate.value || null,
    notes: formNotes.value
  })
  client.value = clientsStore.getClientById(client.value.id) || null
  showEditModal.value = false
}

function openAddContact() {
  editingContactId.value = null
  contactFormName.value = ''
  contactFormTitle.value = ''
  contactFormDepartment.value = ''
  contactFormPhone.value = ''
  contactFormEmail.value = ''
  contactFormResponsibility.value = ''
  contactFormIsPrimary.value = false
  contactFormNotes.value = ''
  showContactModal.value = true
}

function openEditContact(contactId: string) {
  const c = getContactById(contactId)
  if (!c) return
  editingContactId.value = c.id
  contactFormName.value = c.name
  contactFormTitle.value = c.title
  contactFormDepartment.value = c.department
  contactFormPhone.value = c.phone
  contactFormEmail.value = c.email
  contactFormRole.value = c.role || 'executor'
  contactFormResponsibility.value = c.responsibility
  contactFormIsPrimary.value = c.isPrimary
  contactFormNotes.value = c.notes
  showContactModal.value = true
}

function saveContact() {
  if (!client.value || !contactFormName.value.trim()) return
  const contacts = client.value.contacts.map(c => ({ ...c }))
  if (contactFormIsPrimary.value) {
    contacts.forEach(c => { c.isPrimary = false })
  }
  if (editingContactId.value) {
    const idx = contacts.findIndex(c => c.id === editingContactId.value)
    if (idx !== -1) {
      contacts[idx] = {
        ...contacts[idx],
        name: contactFormName.value,
        title: contactFormTitle.value,
        department: contactFormDepartment.value,
        phone: contactFormPhone.value,
        email: contactFormEmail.value,
        role: contactFormRole.value,
        responsibility: contactFormResponsibility.value,
        isPrimary: contactFormIsPrimary.value,
        notes: contactFormNotes.value
      }
    }
  } else {
    contacts.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: contactFormName.value,
      title: contactFormTitle.value,
      department: contactFormDepartment.value,
      phone: contactFormPhone.value,
      email: contactFormEmail.value,
      role: contactFormRole.value,
      responsibility: contactFormResponsibility.value,
      isPrimary: contactFormIsPrimary.value,
      notes: contactFormNotes.value
    })
  }
  clientsStore.updateClient(client.value.id, { contacts })
  client.value = clientsStore.getClientById(client.value.id) || null
  showContactModal.value = false
}

function confirmDeleteContact(contactId: string) {
  pendingDeleteContactId.value = contactId
  confirmTitle.value = '删除联系人'
  confirmMessage.value = '确定要删除该联系人吗？此操作不可撤销。'
  confirmVisible.value = true
}

function deleteContact(contactId: string) {
  if (!client.value) return
  const contacts = client.value.contacts.filter(c => c.id !== contactId)
  clientsStore.updateClient(client.value.id, { contacts })
  client.value = clientsStore.getClientById(client.value.id) || null
}

function onVisitContactSelect() {
  if (visitContactPersonId.value) {
    const c = getContactById(visitContactPersonId.value)
    if (c) visitContact.value = c.name
  }
}

function openAddVisit() {
  visitDate.value = new Date().toISOString().split('T')[0]
  visitContact.value = ''
  visitContactPersonId.value = ''
  visitContent.value = ''
  visitResult.value = ''
  visitNextPlan.value = ''
  showVisitModal.value = true
}

function saveVisit() {
  if (!client.value || !visitDate.value) return
  const contactPersonId = visitContactPersonId.value
  const selectedContact = contactPersonId ? getContactById(contactPersonId) : null
  clientsStore.addVisit({
    clientId: client.value.id,
    contactPersonId,
    date: visitDate.value,
    contact: selectedContact ? selectedContact.name : visitContact.value,
    content: visitContent.value,
    result: visitResult.value,
    nextPlan: visitNextPlan.value
  })
  client.value = clientsStore.getClientById(client.value.id) || null
  showVisitModal.value = false
}

function confirmDeleteVisit(id: string) {
  pendingDeleteVisitId.value = id
  confirmTitle.value = '删除拜访记录'
  confirmMessage.value = '确定要删除该拜访记录吗？此操作不可撤销。'
  confirmVisible.value = true
}

function onConfirmOk() {
  confirmVisible.value = false
  if (pendingDeleteVisitId.value) {
    clientsStore.deleteVisit(pendingDeleteVisitId.value)
    pendingDeleteVisitId.value = null
  } else if (pendingDeleteContactId.value) {
    deleteContact(pendingDeleteContactId.value)
    pendingDeleteContactId.value = null
  }
}

function onConfirmCancel() {
  confirmVisible.value = false
  pendingDeleteVisitId.value = null
  pendingDeleteContactId.value = null
}

onMounted(() => {
  clientsStore.loadClients()
  projectsStore.loadProjects()
  workLogsStore.loadWorkLogs()
  client.value = clientsStore.getClientById(route.params.id as string) || null
})
</script>

<template>
  <div class="page" v-if="client">
    <div class="page-header">
      <div class="header-left">
        <div class="back-row">
          <button class="back-btn" @click="router.push('/clients')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            <span>客户列表</span>
          </button>
        </div>
        <div class="header-title-row">
          <h1 class="page-title">{{ client.name }}</h1>
          <span :class="['badge', client.type === 'government' ? 'badge-blue' : client.type === 'enterprise' ? 'badge-green' : 'badge-amber']">{{ typeLabel[client.type] }}</span>
          <span :class="['imp-badge', `imp-${client.importance}`]">{{ importanceLabel[client.importance] }}</span>
          <span :class="['follow-badge', `follow-${client.followUpStatus}`]">
            <span class="follow-dot"></span>
            {{ followUpLabel[client.followUpStatus] }}
          </span>
        </div>
      </div>
      <button class="btn" @click="openEdit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        编辑
      </button>
    </div>

    <div class="tab-nav">
      <button
        v-for="tab in [{ key: 'overview', label: '概览' }, { key: 'contacts', label: '联系人' }, { key: 'projects', label: '关联项目' }, { key: 'visits', label: '拜访记录' }, { key: 'logs', label: '工作日志' }]"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key as any"
      >{{ tab.label }}</button>
    </div>

    <div v-if="activeTab === 'overview'" class="tab-content">
      <div class="overview-grid">
        <div class="card overview-info">
          <div class="card-header">
            <span class="card-title">基本信息</span>
          </div>
          <div class="info-grid-body">
            <div class="info-field">
              <span class="info-label">客户名称</span>
              <span class="info-value">{{ client.name }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">客户类型</span>
              <span class="info-value">{{ typeLabel[client.type] }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">所在区域</span>
              <span class="info-value">{{ client.region || '-' }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">所属行业</span>
              <span class="info-value">{{ client.industry || '-' }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">重要等级</span>
              <span class="info-value">
                <span :class="['imp-badge', `imp-${client.importance}`]">{{ importanceLabel[client.importance] }}</span>
              </span>
            </div>
            <div class="info-field">
              <span class="info-label">跟进状态</span>
              <span class="info-value">
                <span :class="['follow-badge', `follow-${client.followUpStatus}`]">
                  <span class="follow-dot"></span>
                  {{ followUpLabel[client.followUpStatus] }}
                </span>
              </span>
            </div>
            <div class="info-field">
              <span class="info-label">客户来源</span>
              <span class="info-value">{{ client.source || '-' }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">下次跟进</span>
              <span class="info-value">{{ formatDate(client.nextFollowUpDate) }}</span>
            </div>
            <div class="info-field full-width contact-info-field">
              <span class="info-label">联系人信息</span>
              <div v-if="primaryContact" class="contact-summary">
                <div class="cs-row">
                  <span class="cs-name">{{ primaryContact.name }}</span>
                  <span :class="['role-badge', getRoleClass(primaryContact.role)]">{{ getRoleLabel(primaryContact.role) }}</span>
                  <span v-if="primaryContact.title" class="title-badge">{{ primaryContact.title }}</span>
                  <span class="primary-tag">主要</span>
                </div>
                <div class="cs-sub">
                  <span v-if="primaryContact.department">{{ primaryContact.department }}</span>
                  <span v-if="primaryContact.phone">{{ primaryContact.phone }}</span>
                  <span v-if="primaryContact.email">{{ primaryContact.email }}</span>
                </div>
                <a v-if="client.contacts.length > 1" class="cs-link" @click.prevent="activeTab = 'contacts'">
                  共{{ client.contacts.length }}位联系人，查看全部 →
                </a>
              </div>
              <div v-else class="cs-empty">
                <span class="info-value">暂无联系人</span>
                <a class="cs-link" @click.prevent="activeTab = 'contacts'">去添加 →</a>
              </div>
            </div>
            <div class="info-field">
              <span class="info-label">创建时间</span>
              <span class="info-value">{{ formatDate(client.createdAt) }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">更新时间</span>
              <span class="info-value">{{ formatDate(client.updatedAt) }}</span>
            </div>
            <div class="info-field full-width">
              <span class="info-label">备注</span>
              <span class="info-value notes-value">{{ client.notes || '-' }}</span>
            </div>
          </div>
        </div>

        <div class="overview-sidebar">
          <div class="quick-stats">
            <div class="qs-card">
              <div class="qs-icon qs-blue">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div class="qs-info">
                <div class="qs-val">{{ linkedProjects.length }}</div>
                <div class="qs-lbl">关联项目数</div>
              </div>
            </div>
            <div class="qs-card">
              <div class="qs-icon qs-purple">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div class="qs-info">
                <div class="qs-val">{{ linkedWorkLogs.length }}</div>
                <div class="qs-lbl">累计工作日志</div>
              </div>
            </div>
            <div class="qs-card">
              <div class="qs-icon qs-green">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div class="qs-info">
                <div class="qs-val">{{ client.contacts.length }}</div>
                <div class="qs-lbl">联系人数</div>
              </div>
            </div>
            <div class="qs-card">
              <div class="qs-icon qs-amber">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div class="qs-info">
                <div class="qs-val">{{ getRelativeTime(client.lastContactDate) }}</div>
                <div class="qs-lbl">最近活跃</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card recent-visits-card">
        <div class="card-header">
          <span class="card-title">最近拜访记录</span>
          <button v-if="visitRecords.length > 3" class="btn btn-sm" @click="activeTab = 'visits'">查看全部</button>
        </div>
        <div v-if="recentVisits.length === 0" class="card-empty">暂无拜访记录</div>
        <div v-else>
          <div v-for="visit in recentVisits" :key="visit.id" class="visit-preview">
            <div class="visit-preview-header">
              <span class="visit-date">{{ formatDate(visit.date) }}</span>
              <span class="visit-contact">接待人: {{ getVisitContactDisplay(visit) }}</span>
            </div>
            <div class="visit-preview-body">
              <div class="visit-field-row">
                <span class="vf-label">拜访内容</span>
                <span class="vf-value">{{ visit.content || '-' }}</span>
              </div>
              <div class="visit-field-row">
                <span class="vf-label">拜访成果</span>
                <span class="vf-value">{{ visit.result || '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'contacts'" class="tab-content">
      <div class="contacts-toolbar">
        <button class="btn btn-primary" @click="openAddContact">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          添加联系人
        </button>
      </div>
      <div v-if="client.contacts.length === 0" class="card">
        <div class="card-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <p style="margin-top: 10px">暂无联系人，点击「添加联系人」开始</p>
        </div>
      </div>
      <div v-else class="contacts-grid">
        <div
          v-for="contact in client.contacts"
          :key="contact.id"
          :class="['contact-card', 'card', { primary: contact.isPrimary }]"
        >
          <div class="contact-card-header">
            <div class="contact-card-title-row">
              <span class="contact-card-name">{{ contact.name }}</span>
              <span :class="['role-badge', getRoleClass(contact.role)]">{{ getRoleLabel(contact.role) }}</span>
              <span v-if="contact.title" class="title-badge">{{ contact.title }}</span>
              <span v-if="contact.isPrimary" class="primary-tag">主要联系人</span>
            </div>
            <div class="contact-card-actions">
              <button class="btn-icon" @click="openEditContact(contact.id)" title="编辑">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon delete-icon" @click="confirmDeleteContact(contact.id)" title="删除">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div class="contact-card-body">
            <div v-if="contact.department" class="contact-field">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>{{ contact.department }}</span>
            </div>
            <div v-if="contact.phone" class="contact-field">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>{{ contact.phone }}</span>
            </div>
            <div v-if="contact.email" class="contact-field">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span>{{ contact.email }}</span>
            </div>
            <div v-if="contact.responsibility" class="contact-field">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>{{ contact.responsibility }}</span>
            </div>
            <div v-if="contact.notes" class="contact-field contact-notes">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>{{ contact.notes }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'projects'" class="tab-content">
      <div v-if="linkedProjects.length === 0" class="card">
        <div class="card-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <p style="margin-top: 10px">暂无关联项目</p>
        </div>
      </div>
      <div v-else class="project-list">
        <div
          v-for="project in linkedProjects"
          :key="project.id"
          class="project-item card"
          @click="router.push(`/projects/${project.id}`)"
        >
          <div class="project-item-header">
            <div class="project-name-row">
              <span class="project-name">{{ project.name }}</span>
              <span :class="['badge', project.status === 'in_progress' ? 'badge-green' : project.status === 'completed' ? 'badge-blue' : project.status === 'paused' ? 'badge-amber' : 'badge-amber']">
                {{ statusLabel[project.status] }}
              </span>
            </div>
            <span class="project-manager">{{ project.manager || '未分配' }}</span>
          </div>
          <div class="project-item-body">
            <div class="project-progress-row">
              <div class="progress-track" style="flex:1;height:6px">
                <div class="progress-fill" :style="{ width: project.progress + '%' }"></div>
              </div>
              <span class="project-pct">{{ project.progress }}%</span>
            </div>
            <div class="project-meta-row">
              <span class="pm-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {{ project.startDate }} ~ {{ project.endDate || '待定' }}
              </span>
              <span class="pm-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                预算: {{ project.budget ? project.budget.toLocaleString() : '-' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'visits'" class="tab-content">
      <div class="visits-toolbar">
        <button class="btn btn-primary" @click="openAddVisit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          记录拜访
        </button>
      </div>
      <div v-if="visitRecords.length === 0" class="card">
        <div class="card-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p style="margin-top: 10px">暂无拜访记录，点击「记录拜访」开始</p>
        </div>
      </div>
      <div v-else class="visit-timeline">
        <div v-for="visit in visitRecords" :key="visit.id" class="visit-card card">
          <div class="visit-card-header">
            <div class="visit-card-date">
              <span class="visit-date-badge">{{ formatDate(visit.date) }}</span>
              <span class="visit-contact-text">接待人: {{ getVisitContactDisplay(visit) }}</span>
            </div>
            <button class="btn-icon delete-icon" @click="confirmDeleteVisit(visit.id)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <div class="visit-card-body">
            <div class="visit-section">
              <span class="vs-label">拜访内容</span>
              <span class="vs-value">{{ visit.content || '未填写' }}</span>
            </div>
            <div class="visit-section">
              <span class="vs-label">拜访成果</span>
              <span class="vs-value">{{ visit.result || '未填写' }}</span>
            </div>
            <div v-if="visit.nextPlan" class="visit-section">
              <span class="vs-label">下次计划</span>
              <span class="vs-value">{{ visit.nextPlan }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'logs'" class="tab-content">
      <div v-if="linkedWorkLogs.length === 0" class="card">
        <div class="card-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p style="margin-top: 10px">暂无关联工作日志</p>
        </div>
      </div>
      <div v-else class="log-list">
        <div v-for="log in linkedWorkLogs" :key="log.id" class="log-item card">
          <div class="log-item-header">
            <span class="log-date">{{ formatDate(log.date) }}</span>
            <span class="log-cat-badge" :style="{ color: getCategoryColor(log.categoryId), background: getCategoryColor(log.categoryId) + '18' }">
              {{ getCategoryLabel(log.categoryId) }}
            </span>
          </div>
          <div class="log-item-body">
            <span class="log-content">{{ log.content }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditModal" class="modal-mask" @click.self="showEditModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>编辑客户</h3>
          <button class="btn-icon" @click="showEditModal = false" style="font-size:18px">&times;</button>
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
          <div class="form-hint">联系人信息请在「联系人」标签页中管理</div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary" @click="saveClient">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showContactModal" class="modal-mask" @click.self="showContactModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>{{ editingContactId ? '编辑联系人' : '添加联系人' }}</h3>
          <button class="btn-icon" @click="showContactModal = false" style="font-size:18px">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-field">
              <label>姓名 <span class="required">*</span></label>
              <input v-model="contactFormName" placeholder="请输入联系人姓名" class="input" />
            </div>
            <div class="form-field">
              <label>角色</label>
              <select v-model="contactFormRole" class="input">
                <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>职务</label>
              <input v-model="contactFormTitle" placeholder="请输入职务" class="input" />
            </div>
            <div class="form-field">
              <label>所属部门</label>
              <input v-model="contactFormDepartment" placeholder="请输入所属部门" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>联系电话</label>
              <input v-model="contactFormPhone" placeholder="请输入联系电话" class="input" />
            </div>
            <div class="form-field">
              <label>邮箱</label>
              <input v-model="contactFormEmail" type="email" placeholder="请输入邮箱地址" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>负责领域</label>
              <input v-model="contactFormResponsibility" placeholder="请输入负责领域" class="input" />
            </div>
            <div class="form-field"></div>
          </div>
          <div class="form-field">
            <label>备注</label>
            <textarea v-model="contactFormNotes" placeholder="请输入备注信息" class="input" rows="3"></textarea>
          </div>
          <div class="checkbox-field">
            <label class="checkbox-label" @click.prevent="contactFormIsPrimary = !contactFormIsPrimary">
              <span class="custom-checkbox" :class="{ checked: contactFormIsPrimary }">
                <svg v-if="contactFormIsPrimary" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span class="checkbox-text">设为主要联系人</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showContactModal = false">取消</button>
          <button class="btn btn-primary" @click="saveContact">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showVisitModal" class="modal-mask" @click.self="showVisitModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>记录拜访</h3>
          <button class="btn-icon" @click="showVisitModal = false" style="font-size:18px">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>日期</label>
            <input v-model="visitDate" type="date" class="input" />
          </div>
          <div class="form-field">
            <label>接待联系人</label>
            <select v-model="visitContactPersonId" class="input" @change="onVisitContactSelect">
              <option value="">请选择联系人</option>
              <option v-for="c in client.contacts" :key="c.id" :value="c.id">{{ c.name }} [{{ getRoleLabel(c.role) }}]{{ c.title ? ' · ' + c.title : '' }}{{ c.department ? ' · ' + c.department : '' }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>接待人</label>
            <input v-model="visitContact" placeholder="请输入接待人姓名" class="input" />
          </div>
          <div class="form-field">
            <label>拜访内容</label>
            <textarea v-model="visitContent" placeholder="请输入拜访内容" class="input" rows="3"></textarea>
          </div>
          <div class="form-field">
            <label>拜访成果</label>
            <textarea v-model="visitResult" placeholder="请输入拜访成果" class="input" rows="3"></textarea>
          </div>
          <div class="form-field">
            <label>下次计划</label>
            <textarea v-model="visitNextPlan" placeholder="请输入下次拜访计划" class="input" rows="3"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showVisitModal = false">取消</button>
          <button class="btn btn-primary" @click="saveVisit">保存</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="page">
    <div class="card">
      <div class="card-empty">
        <p style="margin-bottom: 14px">客户不存在</p>
        <button class="btn" @click="router.push('/clients')">返回客户列表</button>
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
</template>

<style scoped>
.back-row {
  margin-bottom: 14px;
}
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 8px;
  background: var(--bg-card, #fff);
  color: var(--text-secondary, #475569);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.back-btn:hover {
  background: var(--bg, #f1f5f9);
  color: var(--text, #1e293b);
  border-color: var(--border, #cbd5e1);
}
.back-btn svg {
  flex-shrink: 0;
}
.header-left {
  display: flex;
  flex-direction: column;
}
.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.imp-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.imp-A { background: #fef2f2; color: #ef4444; }
.imp-B { background: #fffbeb; color: #d97706; }
.imp-C { background: #f1f5f9; color: #94a3b8; }

.follow-badge {
  display: inline-flex;
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
.follow-active { background: #f0fdf4; color: #16a34a; }
.follow-active .follow-dot { background: #22c55e; }
.follow-pending { background: #fffbeb; color: #d97706; }
.follow-pending .follow-dot { background: #f59e0b; }
.follow-lost { background: #fef2f2; color: #dc2626; }
.follow-lost .follow-dot { background: #ef4444; }

.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.tab-btn {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  position: relative;
  transition: color 0.15s;
}
.tab-btn:hover { color: var(--text); }
.tab-btn.active {
  color: var(--primary);
  font-weight: 600;
}
.tab-btn.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--primary);
  border-radius: 1px;
}

.tab-content { animation: fadeIn 0.15s; }

.overview-grid {
  display: grid;
  grid-template-columns: 6fr 4fr;
  gap: 16px;
  margin-bottom: 16px;
  align-items: start;
}
.overview-info { min-width: 0; }

.info-grid-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 4px 0;
}
.info-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-light);
}
.info-field:nth-child(2n) {
  border-left: 1px solid var(--border-light);
}
.info-field.full-width {
  grid-column: 1 / -1;
  border-left: none;
}
.info-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}
.info-value {
  font-size: 13px;
  color: var(--text);
  word-break: break-all;
}
.notes-value {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--text-secondary);
}

.contact-info-field { padding: 12px 18px; }
.contact-summary { margin-top: 4px; }
.cs-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.cs-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.title-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  background: #eff6ff;
  color: #3b82f6;
}
.role-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.3px;
}
.role-leader {
  background: #eff6ff;
  color: #3b82f6;
}
.role-executor {
  background: #f0fdf4;
  color: #16a34a;
}
.primary-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0fdf4;
  color: #16a34a;
  letter-spacing: 0.3px;
}
.cs-sub {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.cs-link {
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  text-decoration: none;
}
.cs-link:hover { text-decoration: underline; }
.cs-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.quick-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qs-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}
.qs-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}
.qs-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.qs-blue { background: #eff6ff; color: #3b82f6; }
.qs-purple { background: #faf5ff; color: #a855f7; }
.qs-green { background: #f0fdf4; color: #22c55e; }
.qs-amber { background: #fffbeb; color: #f59e0b; }
.qs-val { font-size: 18px; font-weight: 700; color: var(--text); line-height: 1; }
.qs-lbl { font-size: 11px; color: var(--text-muted); margin-top: 3px; }

.recent-visits-card { margin-bottom: 0; }

.visit-preview {
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-light);
}
.visit-preview:last-child { border-bottom: none; }
.visit-preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.visit-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.visit-contact {
  font-size: 12px;
  color: var(--text-muted);
}
.visit-preview-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.visit-field-row {
  display: flex;
  gap: 8px;
  font-size: 12.5px;
}
.vf-label {
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 56px;
}
.vf-value {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.contacts-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 14px;
}
.contacts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.contact-card {
  padding: 0;
  transition: all 0.2s;
}
.contact-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
.contact-card.primary {
  border-left: 3px solid var(--primary);
}
.contact-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 18px 0;
}
.contact-card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.contact-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.contact-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.contact-card-body {
  padding: 12px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.contact-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
}
.contact-field svg {
  color: var(--text-muted);
  flex-shrink: 0;
}
.contact-notes {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

.visits-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 14px;
}

.visit-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.visit-card { padding: 0; }
.visit-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-light);
}
.visit-card-date {
  display: flex;
  align-items: center;
  gap: 12px;
}
.visit-date-badge {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-50);
  padding: 2px 10px;
  border-radius: var(--radius-sm);
}
.visit-contact-text {
  font-size: 12px;
  color: var(--text-muted);
}
.visit-card-body {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.visit-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.vs-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.vs-value {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.delete-icon:hover {
  background: var(--rose-bg);
  color: var(--rose);
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.project-item {
  cursor: pointer;
  transition: all 0.2s;
}
.project-item:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  border-color: var(--primary);
}
.project-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px 0;
}
.project-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.project-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.project-manager {
  font-size: 12px;
  color: var(--text-muted);
}
.project-item-body {
  padding: 10px 18px 14px;
}
.project-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.project-pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  min-width: 36px;
  text-align: right;
}
.project-meta-row {
  display: flex;
  gap: 16px;
  align-items: center;
}
.pm-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.pm-item svg { color: var(--text-muted); flex-shrink: 0; }

.log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.log-item { padding: 0; }
.log-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-light);
}
.log-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.log-cat-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.log-item-body {
  padding: 10px 18px;
}
.log-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
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
.form-hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 12px;
  background: var(--bg-secondary, #f8fafc);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--primary);
}
.checkbox-field {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}
.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.checkbox-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  line-height: 1;
}
.custom-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid #cbd5e1;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  background: #fff;
}
.custom-checkbox.checked {
  background: var(--primary);
  border-color: var(--primary);
}

.modal-lg { width: 600px; }

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

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 900px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
  .info-grid-body {
    grid-template-columns: 1fr;
  }
  .info-field:nth-child(2n) {
    border-left: none;
  }
  .quick-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .contacts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .header-title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .tab-btn {
    padding: 10px 12px;
    font-size: 12px;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .visit-preview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .visit-card-date {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .project-item-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .quick-stats {
    grid-template-columns: 1fr;
  }
  .contact-card-title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
