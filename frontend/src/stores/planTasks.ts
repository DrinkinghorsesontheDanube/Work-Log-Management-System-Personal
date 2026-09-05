import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlanTask } from '../types'
import { storage } from '../utils/storage'

/**
 * 计划任务集合。之前 ProjectDetail 直接持有数组并绕过 store 写 storage，
 * 现在统一收编到这里，与其他实体（projects/todos/...）的存储路径一致。
 */
export const usePlanTasksStore = defineStore('planTasks', () => {
  const planTasks = ref<PlanTask[]>([])

  function loadPlanTasks() {
    planTasks.value = storage.getPlanTasks()
  }

  function savePlanTasks() {
    storage.savePlanTasks(planTasks.value)
  }

  return {
    planTasks,
    loadPlanTasks,
    savePlanTasks,
  }
})
