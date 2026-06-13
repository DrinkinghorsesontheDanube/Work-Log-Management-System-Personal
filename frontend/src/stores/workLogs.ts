import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WorkLog, WorkCategoryId } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'

export const useWorkLogsStore = defineStore('workLogs', () => {
  const workLogs = ref<WorkLog[]>([])

  function loadWorkLogs() {
    workLogs.value = storage.getWorkLogs()
  }

  function saveWorkLogs() {
    storage.saveWorkLogs(workLogs.value)
  }

  function addWorkLog(workLog: Omit<WorkLog, 'id' | 'createdAt' | 'updatedAt'>) {
    const newWorkLog: WorkLog = createEntity(workLog, 'log')
    workLogs.value.push(newWorkLog)
    saveWorkLogs()
    return newWorkLog
  }

  function updateWorkLog(id: string, updates: Partial<WorkLog>) {
    const index = workLogs.value.findIndex(w => w.id === id)
    if (index !== -1) {
      workLogs.value[index] = touchEntity(workLogs.value[index], updates)
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

  function getWorkLogsByProjectId(projectId: string) {
    return workLogs.value.filter(w => w.projectId === projectId)
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

  const categoryStats = computed(() => {
    const stats: Record<string, number> = {}
    for (const log of workLogs.value) {
      const cat = log.categoryId || 'other'
      stats[cat] = (stats[cat] || 0) + 1
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
    getWorkLogsByProjectId,
    last7DaysStats,
    categoryStats
  }
})
