
import type { Project, Todo, WorkLog, AiMessage } from '../types'

const STORAGE_KEYS = {
  projects: 'worklog_projects',
  todos: 'worklog_todos',
  workLogs: 'worklog_workLogs',
  aiMessages: 'worklog_aiMessages'
}

export const storage = {
  getProjects(): Project[] {
    const data = localStorage.getItem(STORAGE_KEYS.projects)
    return data ? JSON.parse(data) : []
  },
  saveProjects(projects: Project[]) {
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects))
  },
  getTodos(): Todo[] {
    const data = localStorage.getItem(STORAGE_KEYS.todos)
    return data ? JSON.parse(data) : []
  },
  saveTodos(todos: Todo[]) {
    localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(todos))
  },
  getWorkLogs(): WorkLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.workLogs)
    return data ? JSON.parse(data) : []
  },
  saveWorkLogs(workLogs: WorkLog[]) {
    localStorage.setItem(STORAGE_KEYS.workLogs, JSON.stringify(workLogs))
  },
  getAiMessages(): AiMessage[] {
    const data = localStorage.getItem(STORAGE_KEYS.aiMessages)
    return data ? JSON.parse(data) : []
  },
  saveAiMessages(messages: AiMessage[]) {
    localStorage.setItem(STORAGE_KEYS.aiMessages, JSON.stringify(messages))
  },
  exportAllData(): string {
    const data = {
      projects: this.getProjects(),
      todos: this.getTodos(),
      workLogs: this.getWorkLogs(),
      aiMessages: this.getAiMessages(),
      exportTime: new Date().toISOString()
    }
    return JSON.stringify(data, null, 2)
  },
  clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
  }
}
