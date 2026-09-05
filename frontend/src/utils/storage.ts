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
  Opportunity,
} from '../types'
import { DEFAULT_PHASES } from '../types'
import { ref } from 'vue'

/**
 * 数据层：内存缓存 + 服务器 API 增量同步。
 *
 * 之前数据存 localStorage；迁移到可远程访问的架构后，数据统一存服务端 SQLite
 * （server/server.js）。为让上层（stores / views / services）保持原样，本模块
 * 维持旧的同步签名：get* 读内存缓存；save* 先写缓存，再异步把**增量**推送到服务器。
 *
 * 多设备并发安全：推送的不是整个集合，而是相对 lastSynced 的增量
 * （upsert 本地新增/修改的实体 + delete 本地删除的实体 id），服务器按实体应用，
 * 因此其他设备新增的数据不会被本页的旧缓存覆盖。窗口获得焦点时自动拉取服务器
 * 最新状态合并进缓存；页面关闭时用 sendBeacon 兜底推送未完成的增量。
 *
 * 生命周期：路由守卫中先 await ensureInit() 拉取全量状态；未登录时 authRequired
 * 置真并抛错，由登录组件处理；服务器不可达时进入离线模式（serverOnline = false），
 * 应用可继续使用，恢复后下次保存会把累积的增量一并推送。
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
  'opportunities',
  'deleted',
] as const
type CollectionName = (typeof COLLECTION_NAMES)[number]

interface CollectionDiff {
  upserts: unknown[]
  deletes: string[]
}

const cache: Record<CollectionName, unknown[]> = {
  projects: [],
  todos: [],
  workLogs: [],
  clients: [],
  visitRecords: [],
  reports: [],
  planTasks: [],
  aiMessages: [],
  opportunities: [],
  deleted: [],
}
/** 每个集合最近一次与服务器确认一致的状态（id -> JSON），用于计算增量 */
const lastSynced: Record<CollectionName, Map<string, string>> = {
  projects: new Map(),
  todos: new Map(),
  workLogs: new Map(),
  clients: new Map(),
  visitRecords: new Map(),
  reports: new Map(),
  planTasks: new Map(),
  aiMessages: new Map(),
  opportunities: new Map(),
  deleted: new Map(),
}
/** 本地有未同步到服务器的更改（推送成功后清除；期间不会做焦点刷新覆盖） */
const dirty: Record<CollectionName, boolean> = {
  projects: false,
  todos: false,
  workLogs: false,
  clients: false,
  visitRecords: false,
  reports: false,
  planTasks: false,
  aiMessages: false,
  opportunities: false,
  deleted: false,
}

let aiProviderCache: StoredAiProvider | null = null
let phasesCache: ProjectPhase[] | null = null

/** 服务器返回的 AI 配置不含 apiKey（Key 只存服务端），用 hasKey 表示是否已配置 */
export type StoredAiProvider = Omit<AiProvider, 'apiKey'> & { hasKey: boolean }

export const authRequired = ref(false)
export const serverOnline = ref(true)
export const needsSeed = ref(false)
/** 服务器当前数据来源：'demo'=演示数据（可被真实数据合并迁移），'legacy'=已迁移旧数据 */
export const seededWith = ref('')

/** 回收站条目 */
export interface DeletedEntry {
  id: string
  type: DeletedType
  deletedAt: string
  data: unknown
}

export type DeletedType =
  | 'todo'
  | 'workLog'
  | 'client'
  | 'project'
  | 'visit'
  | 'report'
  | 'planTask'
  | 'opportunity'

const DELETED_TYPE_COLLECTION: Record<DeletedType, CollectionName> = {
  todo: 'todos',
  workLog: 'workLogs',
  client: 'clients',
  project: 'projects',
  visit: 'visitRecords',
  report: 'reports',
  planTask: 'planTasks',
  opportunity: 'opportunities',
}

let initialized = false

// —— 同步队列：同一集合的写入按序推送，且始终推送执行时刻的最新增量 ——
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

function snapshotMap(name: CollectionName): Map<string, string> {
  return snapshotOf(cache[name])
}

function computeDiff(name: CollectionName): CollectionDiff {
  return diffOf(cache[name], lastSynced[name])
}

async function pushCollection(name: CollectionName) {
  const diff = computeDiff(name)
  if (diff.upserts.length === 0 && diff.deletes.length === 0) {
    dirty[name] = false
    return
  }
  const res = await fetch(`/api/collections/${name}/changes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(diff),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  })
  if (!res.ok) throw new Error(`保存失败 (${res.status})`)
  lastSynced[name] = snapshotMap(name)
  dirty[name] = false
  serverOnline.value = true
}

function scheduleCollection(name: CollectionName) {
  dirty[name] = true
  enqueue(name, () => pushCollection(name)).catch(handleSyncError)
}

async function pushSettings(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  })
  if (!res.ok) throw new Error(`保存设置失败 (${res.status})`)
  serverOnline.value = true
}

// —— 初始化与认证 ——

const FETCH_TIMEOUT = 15_000

export async function ensureInit(): Promise<void> {
  if (initialized) return
  let res: Response
  try {
    res = await fetch('/api/state', { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
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
  adoptServerState(await res.json())
  initialized = true
  authRequired.value = false
  serverOnline.value = true
}

function adoptServerState(payload: {
  collections: Record<CollectionName, unknown[]>
  settings: {
    aiProvider: StoredAiProvider | null
    projectPhases: ProjectPhase[] | null
    meta: { seeded?: boolean; seededWith?: string }
  }
}) {
  for (const name of COLLECTION_NAMES) {
    cache[name] = payload.collections?.[name] ?? []
    lastSynced[name] = snapshotMap(name)
    dirty[name] = false
  }
  aiProviderCache = payload.settings?.aiProvider ?? null
  phasesCache = payload.settings?.projectPhases ?? null
  needsSeed.value = !(payload.settings?.meta?.seeded)
  seededWith.value = payload.settings?.meta?.seededWith ?? ''
  // 回收站过期条目（>30 天）自动清理
  storage.purgeExpiredDeleted(30)
}

/**
 * 窗口重新可见/获得焦点时拉取服务器最新状态。
 * 仅当本页没有未同步更改时执行（有脏数据时跳过，避免覆盖本地编辑）；
 * 其他设备在此期间录入的数据会合并进本页。
 */
async function refreshFromServer(): Promise<void> {
  if (!initialized || authRequired.value) return
  if (COLLECTION_NAMES.some((name) => dirty[name])) return
  if (pendingChains.size > 0) return
  try {
    const res = await fetch('/api/state', { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
    if (!res.ok) return
    adoptServerState(await res.json())
    serverOnline.value = true
  } catch {
    // 网络抖动：保持现有缓存，不打扰用户
  }
}

function flushDirtyViaBeacon() {
  if (typeof navigator.sendBeacon !== 'function') return
  for (const name of COLLECTION_NAMES) {
    if (!dirty[name]) continue
    const diff = computeDiff(name)
    if (diff.upserts.length === 0 && diff.deletes.length === 0) continue
    const blob = new Blob([JSON.stringify(diff)], { type: 'application/json' })
    navigator.sendBeacon(`/api/collections/${name}/changes`, blob)
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshFromServer()
  })
}
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => void refreshFromServer())
  // 页面关闭时兜底：把还没推完的增量用 sendBeacon 发出去（幂等，重复应用无害）
  window.addEventListener('pagehide', flushDirtyViaBeacon)
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

/** 等待所有在途的服务器写入结束（无论成败），用于导入/清空/播种后、页面刷新前 */
export async function flush(): Promise<void> {
  const tasks = [...pendingChains.values()]
  if (tasks.length) await Promise.allSettled(tasks)
}

export async function markSeeded(kind: 'legacy' | 'demo'): Promise<void> {
  needsSeed.value = false
  await enqueue('meta', () =>
    pushSettings('/api/settings/meta', { seeded: true, seededWith: kind }),
  )
}

// —— 业务数据读写（同步签名，与旧 localStorage 版一致） ——

function isValidItem(item: unknown): item is { id: unknown } {
  return !!item && typeof item === 'object' && !Array.isArray(item) && (item as { id?: unknown }).id != null
}

// —— 纯函数（导出供单元测试）——

/** 键序无关的 JSON 序列化：字段插入顺序不同但内容相同的对象视为相等 */
export function stableStringify(item: unknown): string {
  return JSON.stringify(item, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = value[k]
          return acc
        }, {})
    }
    return value
  })
}

/** 集合当前条目的 id -> JSON 快照，跳过非对象条目 */
export function snapshotOf(items: unknown[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items as { id: unknown }[]) {
    if (!isValidItem(item)) continue
    map.set(String(item.id), stableStringify(item))
  }
  return map
}

/** 计算相对 lastSynced 的增量：本机新增/修改的实体 + 本机删除的实体 id */
export function diffOf(current: unknown[], synced: Map<string, string>): CollectionDiff {
  const currentIds = new Set<string>()
  const upserts: unknown[] = []
  for (const item of current as { id: unknown }[]) {
    if (!isValidItem(item)) continue
    const id = String(item.id)
    currentIds.add(id)
    if (synced.get(id) !== stableStringify(item)) upserts.push(item)
  }
  const deletes: string[] = []
  for (const id of synced.keys()) {
    if (!currentIds.has(id)) deletes.push(id)
  }
  return { upserts, deletes }
}

/** 按 id 合并两个集合：同 id 以 incoming 为准，仅 current 存在的条目保留 */
export function mergeById(current: unknown[], incoming: unknown[]): unknown[] {
  const map = new Map<string, unknown>()
  for (const item of current) if (isValidItem(item)) map.set(String(item.id), item)
  for (const item of incoming) if (isValidItem(item)) map.set(String(item.id), item)
  return [...map.values()]
}

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
  getOpportunities(): Opportunity[] {
    return cache.opportunities as Opportunity[]
  },
  saveOpportunities(items: Opportunity[]) {
    cache.opportunities = items
    scheduleCollection('opportunities')
  },

  // —— 回收站 ——

  /** 回收站条目：type 标识来源集合，data 为被删实体原样数据 */
  getDeleted(): DeletedEntry[] {
    return [...(cache.deleted as DeletedEntry[])].sort((a, b) =>
      (b.deletedAt || '').localeCompare(a.deletedAt || ''),
    )
  },
  /** 删除任意实体前调用：移入回收站（保留 30 天，可恢复） */
  trash(type: DeletedType, item: unknown) {
    if (!isValidItem(item)) return
    const entry: DeletedEntry = {
      id: 'del_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type,
      deletedAt: new Date().toISOString(),
      data: item,
    }
    ;(cache.deleted as unknown[]).push(entry)
    scheduleCollection('deleted')
  },
  /** 从回收站恢复条目到原集合 */
  restoreDeleted(entryId: string): boolean {
    const list = cache.deleted as DeletedEntry[]
    const idx = list.findIndex((e) => e.id === entryId)
    if (idx === -1) return false
    const entry = list[idx]
    const target = DELETED_TYPE_COLLECTION[entry.type]
    if (!target) return false
    list.splice(idx, 1)
    scheduleCollection('deleted')
    const targetCache = cache[target] as { id: unknown }[]
    const id = String((entry.data as { id: unknown }).id)
    const existIdx = targetCache.findIndex((t) => String(t.id) === id)
    if (existIdx !== -1) targetCache[existIdx] = entry.data as { id: unknown }
    else targetCache.push(entry.data as { id: unknown })
    scheduleCollection(target)
    return true
  },
  /** 彻底删除回收站条目（不进回收站） */
  purgeDeleted(entryId: string): boolean {
    const list = cache.deleted as DeletedEntry[]
    const idx = list.findIndex((e) => e.id === entryId)
    if (idx === -1) return false
    list.splice(idx, 1)
    scheduleCollection('deleted')
    return true
  },
  /** 清理超过保留期（默认 30 天）的回收站条目，应用初始化时调用 */
  purgeExpiredDeleted(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const before = (cache.deleted as unknown[]).length
    ;(cache.deleted as unknown[]) = (cache.deleted as DeletedEntry[]).filter(
      (e) => new Date(e.deletedAt).getTime() > cutoff,
    )
    if ((cache.deleted as unknown[]).length !== before) scheduleCollection('deleted')
  },
  /** 修改访问密码（成功后其他设备的会话将失效，当前会话保留） */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new Error(data.error || `修改失败 (${res.status})`)
  },

  /** 服务器自动备份列表（新→旧） */
  async listBackups(): Promise<{ file: string; sizeBytes: number; mtime: string }[]> {
    const res = await fetch('/api/backups', { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
    if (!res.ok) throw new Error(`获取备份列表失败 (${res.status})`)
    const data = (await res.json()) as { backups: { file: string; sizeBytes: number; mtime: string }[] }
    return data.backups || []
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
  /** 整体替换导入（备份恢复语义：集合内不在备份中的条目会被删除） */
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
    enqueue('meta', () => pushSettings('/api/settings/meta', { seeded: true, seededWith: 'legacy' })).catch(
      handleSyncError,
    )
  },
  /**
   * 合并导入（旧版 localStorage 数据迁移语义）：按 id 合并，同 id 以旧数据为准，
   * 服务器上独有的条目（例如其他设备新录的内容）原样保留。
   */
  mergeLegacyData(data: Record<string, unknown>) {
    for (const name of COLLECTION_NAMES) {
      if (Array.isArray(data[name])) {
        ;(cache[name] as unknown[]) = mergeById(cache[name], data[name] as unknown[])
        scheduleCollection(name)
      }
    }
    if (data.aiProvider !== undefined) {
      this.saveAiProvider((data.aiProvider as AiProvider) ?? null)
    }
    if (Array.isArray(data.projectPhases)) {
      this.saveProjectPhases(data.projectPhases as ProjectPhase[])
    }
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
