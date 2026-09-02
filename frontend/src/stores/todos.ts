import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Todo } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'
import { todayStr } from '../utils/date'

export const useTodosStore = defineStore('todos', () => {
  const todos = ref<Todo[]>([])

  function loadTodos() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 旧数据迁移，字段结构未知
    todos.value = storage.getTodos().map((t: any) => ({
      category: 'project',
      ...t,
    }))
  }

  function saveTodos() {
    storage.saveTodos(todos.value)
  }

  function addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) {
    const newTodo: Todo = createEntity(todo, 'todo')
    todos.value.push(newTodo)
    saveTodos()
    return newTodo
  }

  function updateTodo(id: string, updates: Partial<Todo>) {
    const index = todos.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      todos.value[index] = touchEntity(todos.value[index], updates)
      saveTodos()
    }
  }

  function setTodoCompleted(id: string, completed: boolean) {
    updateTodo(id, { status: completed ? 'completed' : 'pending' })
  }

  function deleteTodo(id: string) {
    todos.value = todos.value.filter((t) => t.id !== id)
    saveTodos()
  }

  /** 级联：删除项目时清理其下所有待办 */
  function deleteByProjectId(projectId: string) {
    const before = todos.value.length
    todos.value = todos.value.filter((t) => t.projectId !== projectId)
    if (todos.value.length !== before) saveTodos()
  }

  /** 级联：删除计划任务时解除待办上的悬挂引用 */
  function clearPlanTaskRefs(planTaskIds: string[]) {
    if (!planTaskIds.length) return
    let changed = false
    todos.value = todos.value.map((t) => {
      if (t.planTaskId && planTaskIds.includes(t.planTaskId)) {
        changed = true
        return touchEntity(t, { planTaskId: null })
      }
      return t
    })
    if (changed) saveTodos()
  }

  function getTodosByProjectId(projectId: string) {
    return todos.value.filter((t) => t.projectId === projectId)
  }

  const pendingTodos = computed(() => todos.value.filter((t) => t.status === 'pending'))

  const inProgressTodos = computed(() => todos.value.filter((t) => t.status === 'in_progress'))

  const completedTodos = computed(() => todos.value.filter((t) => t.status === 'completed'))

  const todayTodos = computed(() => {
    const today = todayStr()
    return todos.value.filter((t) => t.dueDate === today && t.status !== 'completed')
  })

  return {
    todos,
    loadTodos,
    addTodo,
    updateTodo,
    setTodoCompleted,
    deleteTodo,
    deleteByProjectId,
    clearPlanTaskRefs,
    getTodosByProjectId,
    pendingTodos,
    inProgressTodos,
    completedTodos,
    todayTodos,
  }
})
