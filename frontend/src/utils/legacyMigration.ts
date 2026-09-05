/**
 * 旧版数据迁移：v1.1 及之前数据存在浏览器 localStorage（键前缀 worklog_）。
 * 首次登录新版应用且服务器还没有数据时，自动把 localStorage 里的存量数据
 * 上传到服务器，实现无缝迁移（数据仍保留在 localStorage 作为本地备份，不删除）。
 */

const COLLECTION_KEYS: Record<string, string> = {
  projects: 'worklog_projects',
  todos: 'worklog_todos',
  workLogs: 'worklog_workLogs',
  clients: 'worklog_clients',
  visitRecords: 'worklog_visitRecords',
  reports: 'worklog_reports',
  planTasks: 'worklog_planTasks',
  aiMessages: 'worklog_aiMessages',
}

const CONTENT_COLLECTIONS = ['projects', 'todos', 'workLogs', 'clients']

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key)
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** 返回可迁移的旧数据；没有任何实质内容时返回 null（此时应走演示数据播种） */
export function readLegacyData(): Record<string, unknown> | null {
  const data: Record<string, unknown> = {}
  let hasContent = false

  for (const [name, key] of Object.entries(COLLECTION_KEYS)) {
    const parsed = readJson(key)
    if (Array.isArray(parsed)) {
      data[name] = parsed
      if (CONTENT_COLLECTIONS.includes(name) && parsed.length > 0) hasContent = true
    }
  }
  if (!hasContent) return null

  const aiProvider = readJson('worklog_aiProvider')
  if (aiProvider && typeof aiProvider === 'object') data.aiProvider = aiProvider
  const phases = readJson('worklog_projectPhases')
  if (Array.isArray(phases)) data.projectPhases = phases

  return data
}
