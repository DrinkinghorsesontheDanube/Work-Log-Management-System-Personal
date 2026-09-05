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
import { ref } from 'vue'

/**
 * 数据层：内存缓存 + 服务器 API 同步。
 *
 * 之前数据存 localStorage；迁移到可远程访问的架构后，数据统一存服务端 SQLite
 * （server/server.js）。为让上层（stores / views / services）保持原样，本模块
 * 维持旧的同步签名：get* 读内存缓存；save* 先写缓存，再异步推送到服务器。
 *
 * 生命周期：路由守卫中先 await ensureInit() 拉取全量状态；未登录时 authRequired
 * 置真并抛错，由登录组件处理；服务器不可达时进入离线模式（serverOnline = false），
 * 应用可继续使用，但更改无法持久化。
 */

const COLLECTION_NAMES = [
  'projects',
  'todos',
  'workLogs',
  'clients',
  'visitRecords',
  'reports',
  'planTasks',
  'aiMessages',
] as const
type CollectionName = (typeof COLLECTION_NAMES)[number]

const cache: Record<CollectionName, unknown[]> = {
  projects: [],
  todos: [],
  workLogs: [],
  clients: [],
  visitRecords: [],
  reports: [],
  planTasks: [],
  aiMessages: [],
}
let aiProviderCache: StoredAiProvider | null = null
let phasesCache: ProjectPhase[] | null = null

/** 服务器返回的 AI 配置不含 apiKey（Key 只存服务端），用 hasKey 表示是否已配置 */
export type StoredAiProvider = Omit<AiProvider, 'apiKey'> & { hasKey: boolean }

export const authRequired = ref(false)
export const serverOnline = ref(true)
export const needsSeed = ref(false)
/** 服务器当前数据来源：'demo'=演示数据（可被真实数据覆盖迁移），'legacy'=已迁移旧数据 */
export const seededWith = ref('')

let initialized = false

// —— 同步队列：同一 key 的写入按序推送，且始终推送最新快照 ——
const pendingChains = new Map<string, Promise<void>>()

function enqueue(key: string, task: () => Promise<void>): Promise<void> {
  const prev = pendingChains.get(key) || Promise.resolve()
  const next = prev.then(task, task)
  pendingChains.set(key, next)
  next.catch(() => {})
  return next
}

function handleSyncError(e: unknown) {
  serverOnline.value = false
  console.error('[storage] 同步到服务器失败：', e)
}

async function pushCollection(name: CollectionName) {
  const snapshot = [...cache[name]]
  const res = await fetch(`/api/collections/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
  if (!res.ok) throw new Error(`保存失败 (${res.status})`)
  serverOnline.value = true
}

function scheduleCollection(name: CollectionName) {
  enqueue(name, () => pushCollection(name)).catch(handleSyncError)
}

async function pushSettings(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`保存设置失败 (${res.status})`)
  serverOnline.value = true
}

// —— 初始化与认证 ——

export async function ensureInit(): Promise<void> {
  if (initialized) return
  let res: Response
  try {
    res = await fetch('/api/state')
  } catch {
    serverOnline.value = false
    initialized = true
    return
  }
  if (res.status === 401) {
    authRequired.value = true
    throw new Error('需要登录')
  }
  if (!res.ok) throw new Error(`加载数据失败 (${res.status})`)
  const payload = (await res.json()) as {
    collections: Record<CollectionName, unknown[]>
    settings: {
      aiProvider: StoredAiProvider | null
      projectPhases: ProjectPhase[] | null
      meta: { seeded?: boolean; seededWith?: string }
    }
  }
  for (const name of COLLECTION_NAMES) {
    cache[name] = payload.collections?.[name] ?? []
  }
  aiProviderCache = payload.settings?.aiProvider ?? null
  phasesCache = payload.settings?.projectPhases ?? null
  needsSeed.value = !(payload.settings?.meta?.seeded)
  seededWith.value = payload.settings?.meta?.seededWith ?? ''
  initialized = true
  authRequired.value = false
  serverOnline.value = true
}

export async function login(password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({} as { error?: string }))
    throw new Error(data.error || '登录失败')
  }
  authRequired.value = false
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // 网络异常也照常清本地状态
  }
}

/** 等待所有在途的服务器写入完成（导入/清空/播种后、页面刷新前调用） */
export async function flush(): Promise<void> {
  const tasks = [...pendingChains.values()]
  if (tasks.length) await Promise.all(tasks)
}

export async function markSeeded(kind: 'legacy' | 'demo'): Promise<void> {
  needsSeed.value = false
  await enqueue('meta', () =>
    pushSettings('/api/settings/meta', { seeded: true, seededWith: kind }),
  )
}

// —— 业务数据读写（同步签名，与旧 localStorage 版一致） ——

export const storage = {
  getProjects(): Project[] {
    return cache.projects as Project[]
  },
  saveProjects(projects: Project[]) {
    cache.projects = projects
    scheduleCollection('projects')
  },
  getTodos(): Todo[] {
    return cache.todos as Todo[]
  },
  saveTodos(todos: Todo[]) {
    cache.todos = todos
    scheduleCollection('todos')
  },
  getWorkLogs(): WorkLog[] {
    return cache.workLogs as WorkLog[]
  },
  saveWorkLogs(workLogs: WorkLog[]) {
    cache.workLogs = workLogs
    scheduleCollection('workLogs')
  },
  getAiMessages(): AiMessage[] {
    return cache.aiMessages as AiMessage[]
  },
  saveAiMessages(messages: AiMessage[]) {
    cache.aiMessages = messages
    scheduleCollection('aiMessages')
  },
  /** 返回已脱敏的 AI 配置（无 apiKey，带 hasKey 标记） */
  getAiProvider(): StoredAiProvider | null {
    return aiProviderCache
  },
  saveAiProvider(provider: AiProvider | null) {
    aiProviderCache = (provider
      ? { ...provider, apiKey: undefined, hasKey: !!provider.apiKey }
      : null) as unknown as StoredAiProvider
    enqueue('aiProvider', () => pushSettings('/api/settings/aiProvider', provider)).catch(
      handleSyncError,
    )
  },
  getProjectPhases(): ProjectPhase[] {
    return phasesCache ?? DEFAULT_PHASES
  },
  saveProjectPhases(phases: ProjectPhase[]) {
    phasesCache = phases
    enqueue('projectPhases', () => pushSettings('/api/settings/projectPhases', { phases })).catch(
      handleSyncError,
    )
  },
  getClients(): Client[] {
    return cache.clients as Client[]
  },
  saveClients(clients: Client[]) {
    cache.clients = clients
    scheduleCollection('clients')
  },
  getVisitRecords(): VisitRecord[] {
    return cache.visitRecords as VisitRecord[]
  },
  saveVisitRecords(records: VisitRecord[]) {
    cache.visitRecords = records
    scheduleCollection('visitRecords')
  },
  getReports(): Report[] {
    return cache.reports as Report[]
  },
  saveReports(reports: Report[]) {
    cache.reports = reports
    scheduleCollection('reports')
  },
  getPlanTasks(): PlanTask[] {
    return cache.planTasks as PlanTask[]
  },
  savePlanTasks(tasks: PlanTask[]) {
    cache.planTasks = tasks
    scheduleCollection('planTasks')
  },
  exportAllData(): string {
    const provider = this.getAiProvider()
    const data = {
      projects: this.getProjects(),
      todos: this.getTodos(),
      workLogs: this.getWorkLogs(),
      clients: this.getClients(),
      visitRecords: this.getVisitRecords(),
      reports: this.getReports(),
      planTasks: this.getPlanTasks(),
      aiMessages: this.getAiMessages(),
      // 备份文件可能被转发分享，不导出 apiKey（导入时会自动沿用服务端已保存的 Key）
      aiProvider: provider ? { ...provider, apiKey: '' } : null,
      projectPhases: this.getProjectPhases(),
      exportTime: new Date().toISOString(),
    }
    return JSON.stringify(data, null, 2)
  },
  importAllData(data: Record<string, unknown>) {
    for (const name of COLLECTION_NAMES) {
      if (Array.isArray(data[name])) {
        ;(cache[name] as unknown[]) = data[name] as unknown[]
        scheduleCollection(name)
      }
    }
    if (data.aiProvider !== undefined) {
      this.saveAiProvider((data.aiProvider as AiProvider) ?? null)
    }
    if (Array.isArray(data.projectPhases)) {
      this.saveProjectPhases(data.projectPhases as ProjectPhase[])
    }
    enqueue('meta', () => pushSettings('/api/settings/meta', { seeded: true })).catch(
      handleSyncError,
    )
  },
  clearAllData() {
    const aiProvider = this.getAiProvider()
    for (const name of COLLECTION_NAMES) {
      ;(cache[name] as unknown[]) = []
      scheduleCollection(name)
    }
    phasesCache = null
    this.saveProjectPhases([...DEFAULT_PHASES])
    if (aiProvider) {
      // 服务端仍保留已存的 Key，这里把 hasKey 标记带回去
      aiProviderCache = aiProvider
    }
  },
}
