<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useClientsStore } from '../stores/clients'
import type { Client } from '../types'

const clientsStore = useClientsStore()

const showModal = ref(false)
const editingClient = ref<Client | null>(null)
const formName = ref('')
const formType = ref<Client['type']>('government')
const formContact = ref('')
const formPhone = ref('')
const formDepartment = ref('')
const formNotes = ref('')

const typeOptions: { label: string; value: Client['type'] }[] = [
  { label: '政府单位', value: 'government' },
  { label: '企业', value: 'enterprise' },
  { label: '事业单位', value: 'institution' }
]

const typeLabel: Record<Client['type'], string> = {
  government: '政府单位',
  enterprise: '企业',
  institution: '事业单位'
}

const typeBadge: Record<Client['type'], string> = {
  government: 'badge-blue',
  enterprise: 'badge-green',
  institution: 'badge-amber'
}

function openAdd() {
  editingClient.value = null
  formName.value = ''
  formType.value = 'government'
  formContact.value = ''
  formPhone.value = ''
  formDepartment.value = ''
  formNotes.value = ''
  showModal.value = true
}

function openEdit(client: Client) {
  editingClient.value = client
  formName.value = client.name
  formType.value = client.type
  formContact.value = client.contact
  formPhone.value = client.phone
  formDepartment.value = client.department
  formNotes.value = client.notes
  showModal.value = true
}

function save() {
  if (!formName.value.trim()) return

  if (editingClient.value) {
    clientsStore.updateClient(editingClient.value.id, {
      name: formName.value,
      type: formType.value,
      contact: formContact.value,
      phone: formPhone.value,
      department: formDepartment.value,
      notes: formNotes.value
    })
  } else {
    clientsStore.addClient({
      name: formName.value,
      type: formType.value,
      contact: formContact.value,
      phone: formPhone.value,
      department: formDepartment.value,
      notes: formNotes.value
    })
  }
  showModal.value = false
}

function remove(id: string) {
  if (confirm('确定要删除该客户吗？')) {
    clientsStore.deleteClient(id)
  }
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
      <button class="btn btn-primary" @click="openAdd">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        新增客户
      </button>
    </div>

    <div class="card">
      <div v-if="clientsStore.clients.length === 0" class="card-empty">
        暂无客户数据，点击「新增客户」开始
      </div>
      <div v-else class="card-body">
        <div
          v-for="client in clientsStore.clients"
          :key="client.id"
          class="list-row"
        >
          <div class="client-name">{{ client.name }}</div>
          <span class="badge" :class="typeBadge[client.type]">{{ typeLabel[client.type] }}</span>
          <div class="client-info">{{ client.contact }}</div>
          <div class="client-info">{{ client.phone }}</div>
          <div class="client-info">{{ client.department }}</div>
          <div class="row-actions">
            <button class="btn-icon" @click="openEdit(client)" title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete-icon" @click="remove(client.id)" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingClient ? '编辑客户' : '新增客户' }}</h3>
          <button class="btn-icon" @click="showModal = false" style="font-size:18px">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>客户名称 <span class="required">*</span></label>
            <input v-model="formName" placeholder="请输入客户名称" class="input" />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>客户类型</label>
              <select v-model="formType" class="input">
                <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>所属部门</label>
              <input v-model="formDepartment" placeholder="请输入部门" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>联系人</label>
              <input v-model="formContact" placeholder="请输入联系人" class="input" />
            </div>
            <div class="form-field">
              <label>联系电话</label>
              <input v-model="formPhone" placeholder="请输入电话" class="input" />
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
  </div>
</template>

<style scoped>
.client-name {
  font-weight: 600;
  font-size: 13px;
  min-width: 140px;
}

.client-info {
  font-size: 13px;
  color: var(--text-secondary);
}

.row-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.delete-icon:hover {
  background: var(--rose-bg);
  color: var(--rose);
}

.form-field {
  margin-bottom: 14px;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
