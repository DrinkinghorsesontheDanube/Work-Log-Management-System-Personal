import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Client } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'

export const useClientsStore = defineStore('clients', () => {
  const clients = ref<Client[]>([])

  function loadClients() {
    clients.value = storage.getClients()
  }

  function saveClients() {
    storage.saveClients(clients.value)
  }

  function addClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
    const newClient: Client = createEntity(client, 'client')
    clients.value.push(newClient)
    saveClients()
    return newClient
  }

  function updateClient(id: string, updates: Partial<Client>) {
    const index = clients.value.findIndex(c => c.id === id)
    if (index !== -1) {
      clients.value[index] = touchEntity(clients.value[index], updates)
      saveClients()
    }
  }

  function deleteClient(id: string) {
    clients.value = clients.value.filter(c => c.id !== id)
    saveClients()
  }

  function findClientByName(name: string) {
    return clients.value.find(c => c.name === name || name.includes(c.name))
  }

  function ensureClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = findClientByName(data.name)
    if (existing) return existing
    return addClient(data)
  }

  function getClientById(id: string) {
    return clients.value.find(c => c.id === id)
  }

  return {
    clients,
    loadClients,
    addClient,
    updateClient,
    deleteClient,
    findClientByName,
    ensureClient,
    getClientById
  }
})
