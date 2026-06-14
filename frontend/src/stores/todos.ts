
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Todo } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'

export const useTodosStore = defineStore('todos', () => {
  const todos = ref<Todo[]>([])

  function loadTodos() {
    todos.value = storage.getTodos().map((t: any) => ({
      category: 'project', ...t
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
    const index = todos.value.findIndex(t => t.id === id)
    if (index !== -1) {
      todos.value[index] = touchEntity(todos.value[index], updates)
      saveTodos()
    }
  }

  function setTodoCompleted(id: string, completed: boolean) {
    updateTodo(id, { status: completed ? 'completed' : 'pending' })
  }

  function deleteTodo(id: string) {
    todos.value = todos.value.filter(t => t.id !== id)
    saveTodos()
  }

  function getTodosByProjectId(projectId: string) {
    return todos.value.filter(t => t.projectId === projectId)
  }

  const pendingTodos = computed(() => 
    todos.value.filter(t => t.status === 'pending')
  )

  const inProgressTodos = computed(() => 
    todos.value.filter(t => t.status === 'in_progress')
  )

  const completedTodos = computed(() => 
    todos.value.filter(t => t.status === 'completed')
  )

  const todayTodos = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return todos.value.filter(t => t.dueDate === today && t.status !== 'completed')
  })

  return {
    todos,
    loadTodos,
    addTodo,
    updateTodo,
    setTodoCompleted,
    deleteTodo,
    getTodosByProjectId,
    pendingTodos,
    inProgressTodos,
    completedTodos,
    todayTodos
  }
})
