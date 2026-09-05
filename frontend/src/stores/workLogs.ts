import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WorkLog } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'
import { addDaysStr } from '../utils/date'

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
    const index = workLogs.value.findIndex((w) => w.id === id)
    if (index !== -1) {
      workLogs.value[index] = touchEntity(workLogs.value[index], updates)
      saveWorkLogs()
    }
  }

  function deleteWorkLog(id: string) {
    const log = workLogs.value.find((w) => w.id === id)
    if (log) storage.trash('workLog', log)
    workLogs.value = workLogs.value.filter((w) => w.id !== id)
    saveWorkLogs()
  }

  /** 级联：删除项目时清理其下所有日志（移入回收站） */
  function deleteByProjectId(projectId: string) {
    const removed = workLogs.value.filter((w) => w.projectId === projectId)
    removed.forEach((w) => storage.trash('workLog', w))
    if (removed.length) {
      workLogs.value = workLogs.value.filter((w) => w.projectId !== projectId)
      saveWorkLogs()
    }
  }

  /** 级联：删除客户时解除日志上的客户关联（日志本身保留） */
  function clearClientRefs(clientId: string) {
    let changed = false
    workLogs.value = workLogs.value.map((w) => {
      if (w.clientId === clientId) {
        changed = true
        return touchEntity(w, { clientId: null })
      }
      return w
    })
    if (changed) saveWorkLogs()
  }

  function getWorkLogByDate(date: string) {
    return workLogs.value.find((w) => w.date === date)
  }

  function getWorkLogsByProjectId(projectId: string) {
    return workLogs.value.filter((w) => w.projectId === projectId)
  }

  const last7DaysStats = computed(() => {
    const stats: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const dateStr = addDaysStr(-i)
      stats[dateStr] = workLogs.value.filter((w) => w.date === dateStr).length
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
    deleteByProjectId,
    clearClientRefs,
    getWorkLogByDate,
    getWorkLogsByProjectId,
    last7DaysStats,
    categoryStats,
  }
})
