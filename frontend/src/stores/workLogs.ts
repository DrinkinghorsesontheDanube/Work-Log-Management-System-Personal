
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WorkLog } from '../types'
import { storage } from '../utils/storage'

export const useWorkLogsStore = defineStore('workLogs', () => {
  const workLogs = ref<WorkLog[]>([])

  function loadWorkLogs() {
    workLogs.value = storage.getWorkLogs()
  }

  function saveWorkLogs() {
    storage.saveWorkLogs(workLogs.value)
  }

  function addWorkLog(workLog: Omit<WorkLog, 'id' | 'createdAt' | 'updatedAt'>) {
    const newWorkLog: WorkLog = {
      ...workLog,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    workLogs.value.push(newWorkLog)
    saveWorkLogs()
    return newWorkLog
  }

  function updateWorkLog(id: string, updates: Partial<WorkLog>) {
    const index = workLogs.value.findIndex(w => w.id === id)
    if (index !== -1) {
      workLogs.value[index] = {
        ...workLogs.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      saveWorkLogs()
    }
  }

  function deleteWorkLog(id: string) {
    workLogs.value = workLogs.value.filter(w => w.id !== id)
    saveWorkLogs()
  }

  function getWorkLogByDate(date: string) {
    return workLogs.value.find(w => w.date === date)
  }

  const last7DaysStats = computed(() => {
    const stats: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      stats[dateStr] = workLogs.value.filter(w => w.date === dateStr).length
    }
    return stats
  })

  return {
    workLogs,
    loadWorkLogs,
    addWorkLog,
    updateWorkLog,
    deleteWorkLog,
    getWorkLogByDate,
    last7DaysStats
  }
})
