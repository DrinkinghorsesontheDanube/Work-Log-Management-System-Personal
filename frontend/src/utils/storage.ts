import type {
  Project,
  Todo,
  WorkLog,
  AiMessage,
  AiProvider,
  ProjectPhase,
  Client,
  Report,
  PlanTask,
  VisitRecord,
} from '../types'
import { DEFAULT_PHASES } from '../types'

const STORAGE_KEYS = {
  projects: 'worklog_projects',
  todos: 'worklog_todos',
  workLogs: 'worklog_workLogs',
  aiMessages: 'worklog_aiMessages',
  aiProvider: 'worklog_aiProvider',
  projectPhases: 'worklog_projectPhases',
  clients: 'worklog_clients',
  visitRecords: 'worklog_visitRecords',
  reports: 'worklog_reports',
  planTasks: 'worklog_planTasks',
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
  getAiProvider(): AiProvider | null {
    const data = localStorage.getItem(STORAGE_KEYS.aiProvider)
    return data ? JSON.parse(data) : null
  },
  saveAiProvider(provider: AiProvider | null) {
    if (provider) {
      localStorage.setItem(STORAGE_KEYS.aiProvider, JSON.stringify(provider))
    } else {
      localStorage.removeItem(STORAGE_KEYS.aiProvider)
    }
  },
  getProjectPhases(): ProjectPhase[] {
    const data = localStorage.getItem(STORAGE_KEYS.projectPhases)
    return data ? JSON.parse(data) : DEFAULT_PHASES
  },
  saveProjectPhases(phases: ProjectPhase[]) {
    localStorage.setItem(STORAGE_KEYS.projectPhases, JSON.stringify(phases))
  },
  getClients(): Client[] {
    const data = localStorage.getItem(STORAGE_KEYS.clients)
    return data ? JSON.parse(data) : []
  },
  saveClients(clients: Client[]) {
    localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients))
  },
  getVisitRecords(): VisitRecord[] {
    const data = localStorage.getItem(STORAGE_KEYS.visitRecords)
    return data ? JSON.parse(data) : []
  },
  saveVisitRecords(records: VisitRecord[]) {
    localStorage.setItem(STORAGE_KEYS.visitRecords, JSON.stringify(records))
  },
  getReports(): Report[] {
    const data = localStorage.getItem(STORAGE_KEYS.reports)
    return data ? JSON.parse(data) : []
  },
  saveReports(reports: Report[]) {
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports))
  },
  getPlanTasks(): PlanTask[] {
    const data = localStorage.getItem(STORAGE_KEYS.planTasks)
    return data ? JSON.parse(data) : []
  },
  savePlanTasks(tasks: PlanTask[]) {
    localStorage.setItem(STORAGE_KEYS.planTasks, JSON.stringify(tasks))
  },
  exportAllData(): string {
    const provider = this.getAiProvider()
    const data = {
      projects: this.getProjects(),
      todos: this.getTodos(),
      workLogs: this.getWorkLogs(),
      clients: this.getClients(),
      reports: this.getReports(),
      planTasks: this.getPlanTasks(),
      aiMessages: this.getAiMessages(),
      // 备份文件可能被转发分享，不导出明文 apiKey（导入时会自动沿用本机已保存的 Key）
      aiProvider: provider ? { ...provider, apiKey: '' } : null,
      projectPhases: this.getProjectPhases(),
      exportTime: new Date().toISOString(),
    }
    return JSON.stringify(data, null, 2)
  },
  importAllData(data: Record<string, unknown>) {
    if (data.projects) this.saveProjects(data.projects as Project[])
    if (data.todos) this.saveTodos(data.todos as Todo[])
    if (data.workLogs) this.saveWorkLogs(data.workLogs as WorkLog[])
    if (data.clients) this.saveClients(data.clients as Client[])
    if (data.reports) this.saveReports(data.reports as Report[])
    if (data.planTasks) this.savePlanTasks(data.planTasks as PlanTask[])
    if (data.aiMessages) this.saveAiMessages(data.aiMessages as AiMessage[])
    if (data.aiProvider) {
      const imported = data.aiProvider as AiProvider
      if (!imported.apiKey) {
        const current = this.getAiProvider()
        if (current?.apiKey) imported.apiKey = current.apiKey
      }
      this.saveAiProvider(imported)
    }
    if (data.projectPhases) this.saveProjectPhases(data.projectPhases as ProjectPhase[])
  },
  clearAllData() {
    const aiProvider = this.getAiProvider()
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (key !== STORAGE_KEYS.aiProvider) {
        localStorage.removeItem(key)
      }
    })
    if (aiProvider) {
      this.saveAiProvider(aiProvider)
    }
  },
}
