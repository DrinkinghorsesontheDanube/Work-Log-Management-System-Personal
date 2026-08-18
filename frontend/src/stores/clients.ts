import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Client, VisitRecord } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'

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
    clients.value = clients.value.filter((c) => c.id !== id)
    visitRecords.value = visitRecords.value.filter((v) => v.clientId !== id)
    saveClients()
    saveVisitRecords()
  }

  function findClientByName(name: string) {
    return clients.value.find((c) => c.name === name || name.includes(c.name))
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
  }
})
