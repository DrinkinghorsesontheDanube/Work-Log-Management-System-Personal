import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Client, VisitRecord } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'
import { useProjectsStore } from './projects'
import { useWorkLogsStore } from './workLogs'

export const useClientsStore = defineStore('clients', () => {
  const clients = ref<Client[]>([])
  const visitRecords = ref<VisitRecord[]>([])

  function loadClients() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 旧数据迁移，字段结构未知
    clients.value = storage.getClients().map((c: any) => {
      if (!c.contacts) {
        return {
          ...c,
          contacts: [
            {
              id: c.id + '_ct1',
              name: c.contact || '',
              title: '',
              department: c.department || '',
              phone: c.phone || '',
              email: c.email || '',
              role: 'leader' as const,
              responsibility: '',
              isPrimary: true,
              notes: '',
            },
          ],
          region: c.region || '',
          industry: c.industry || '',
          importance: c.importance || 'B',
          followUpStatus: c.followUpStatus || 'active',
          lastContactDate: c.lastContactDate || null,
          nextFollowUpDate: c.nextFollowUpDate || null,
          source: c.source || '',
        }
      }
      return c
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 旧数据迁移，字段结构未知
    visitRecords.value = storage.getVisitRecords().map((v: any) => ({
      contactPersonId: '',
      ...v,
    }))
  }

  function saveClients() {
    storage.saveClients(clients.value)
  }

  function saveVisitRecords() {
    storage.saveVisitRecords(visitRecords.value)
  }

  function addClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
    const newClient: Client = createEntity(client, 'client')
    clients.value.push(newClient)
    saveClients()
    return newClient
  }

  function updateClient(id: string, updates: Partial<Client>) {
    const index = clients.value.findIndex((c) => c.id === id)
    if (index !== -1) {
      clients.value[index] = touchEntity(clients.value[index], updates)
      saveClients()
    }
  }

  function deleteClient(id: string) {
    const client = getClientById(id)
    if (client) storage.trash('client', client)
    visitRecords.value
      .filter((v) => v.clientId === id)
      .forEach((v) => storage.trash('visit', v))
    clients.value = clients.value.filter((c) => c.id !== id)
    visitRecords.value = visitRecords.value.filter((v) => v.clientId !== id)
    saveClients()
    saveVisitRecords()
    // 级联：解除项目上的客户引用（负责人/经办人是该客户的联系人，随客户一并失效），以及日志上的客户关联
    const projectsStore = useProjectsStore()
    let projectsChanged = false
    projectsStore.projects = projectsStore.projects.map((p) => {
      if (p.clientId === id) {
        projectsChanged = true
        return touchEntity(p, {
          clientId: null,
          clientLeaderId: null,
          clientExecutorId: null,
        })
      }
      return p
    })
    if (projectsChanged) projectsStore.saveProjects()
    useWorkLogsStore().clearClientRefs(id)
  }

  /** 级联：删除联系人时解除项目上的负责人/经办人引用、拜访记录上的联系人引用，并转移"主要联系人" */
  function removeContact(clientId: string, contactId: string) {
    const client = getClientById(clientId)
    if (!client) return
    client.contacts = client.contacts.filter((c) => c.id !== contactId)
    if (client.contacts.length && !client.contacts.some((c) => c.isPrimary)) {
      client.contacts[0].isPrimary = true
    }
    saveClients()

    const projectsStore = useProjectsStore()
    let projectsChanged = false
    projectsStore.projects = projectsStore.projects.map((p) => {
      if (
        p.clientId === clientId &&
        (p.clientLeaderId === contactId || p.clientExecutorId === contactId)
      ) {
        projectsChanged = true
        return touchEntity(p, {
          clientLeaderId: p.clientLeaderId === contactId ? null : p.clientLeaderId,
          clientExecutorId: p.clientExecutorId === contactId ? null : p.clientExecutorId,
        })
      }
      return p
    })
    if (projectsChanged) projectsStore.saveProjects()

    let visitsChanged = false
    visitRecords.value = visitRecords.value.map((v) => {
      if (v.clientId === clientId && v.contactPersonId === contactId) {
        visitsChanged = true
        return { ...v, contactPersonId: '' }
      }
      return v
    })
    if (visitsChanged) saveVisitRecords()
  }

  function findClientByName(name: string) {
    const normalized = name.trim()
    if (!normalized) return undefined
    return clients.value.find((c) => {
      const clientName = c.name.trim()
      if (!clientName) return false
      return (
        clientName === normalized ||
        clientName.includes(normalized) ||
        normalized.includes(clientName)
      )
    })
  }

  function ensureClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = findClientByName(data.name)
    if (existing) return existing
    return addClient(data)
  }

  function getClientById(id: string) {
    return clients.value.find((c) => c.id === id)
  }

  function getVisitsByClient(clientId: string) {
    return visitRecords.value
      .filter((v) => v.clientId === clientId)
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  function addVisit(visit: Omit<VisitRecord, 'id' | 'createdAt'>) {
    const newVisit: VisitRecord = {
      ...visit,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
    }
    visitRecords.value.push(newVisit)
    saveVisitRecords()
    const idx = clients.value.findIndex((c) => c.id === visit.clientId)
    if (idx !== -1) {
      clients.value[idx] = touchEntity(clients.value[idx], { lastContactDate: visit.date })
      saveClients()
    }
    return newVisit
  }

  function deleteVisit(id: string) {
    const visit = visitRecords.value.find((v) => v.id === id)
    if (visit) storage.trash('visit', visit)
    visitRecords.value = visitRecords.value.filter((v) => v.id !== id)
    saveVisitRecords()
  }

  return {
    clients,
    visitRecords,
    loadClients,
    addClient,
    updateClient,
    deleteClient,
    findClientByName,
    ensureClient,
    getClientById,
    getVisitsByClient,
    addVisit,
    deleteVisit,
    removeContact,
  }
})
