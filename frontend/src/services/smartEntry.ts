import type { Project, Todo, WorkLog, WorkCategoryId } from '../types'
import { WORK_CATEGORIES } from '../types'
import type { useProjectsStore } from '../stores/projects'
import type { useTodosStore } from '../stores/todos'
import type { useWorkLogsStore } from '../stores/workLogs'
import type { useClientsStore } from '../stores/clients'
import { chatWithAI } from './aiService'

type ProjectsStore = ReturnType<typeof useProjectsStore>
type TodosStore = ReturnType<typeof useTodosStore>
type WorkLogsStore = ReturnType<typeof useWorkLogsStore>
type ClientsStore = ReturnType<typeof useClientsStore>

export interface AnalyzedItem {
  type: 'project' | 'todo' | 'log' | 'client'
  title: string
  detail: string
  isNew?: boolean
  priority?: string
  dueDate?: string
  projectName?: string
  clientName?: string
  category?: string
}

export interface SmartEntryResult {
  projects: Project[]
  todos: Todo[]
  workLogs: WorkLog[]
  summary: string
  analyzedItems: AnalyzedItem[]
}

export interface PendingProject {
  name: string
  description: string
  isNew: boolean
  existingId?: string
}

export interface PendingTodo {
  title: string
  description: string
  priority: string
  dueDate: string
  projectName?: string
}

export interface PendingLog {
  date: string
  content: string
  categoryId: WorkCategoryId
  projectName?: string
  clientName?: string
}

export interface PendingClient {
  name: string
  isNew: boolean
}

export interface PendingEntry {
  rawText: string
  projects: PendingProject[]
  todos: PendingTodo[]
  logs: PendingLog[]
  client: PendingClient | null
  categoryId: WorkCategoryId
  analyzedItems: AnalyzedItem[]
  summary: string
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function parseDate(text: string): string {
  if (text.includes('后天')) return addDays(2)
  if (text.includes('明天')) return addDays(1)
  if (text.includes('昨天')) return addDays(-1)
  if (text.includes('前天')) return addDays(-2)

  const fullDate = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (fullDate) {
    return `${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`
  }

  const monthDay = text.match(/(\d{1,2})月(\d{1,2})[日号]?/)
  if (monthDay) {
    return `${new Date().getFullYear()}-${monthDay[1].padStart(2, '0')}-${monthDay[2].padStart(2, '0')}`
  }

  return today()
}

/** 常见动词/副词，不应作为项目名 */
const VERBS = /完成了|完成|进行|开始|结束|讨论|汇报|总结|整理|跟进|推进|协调|沟通|会议|评审|提交|编写|修改|更新|处理|确认|对接|准备|参加|出席|安排|部署|测试|上线|发布|检查|排查|修复|优化|设计|开发|实施|验收|交付|运维|支持|立项|调研|投标|中标|签约|谈判|回款|开票|出差|拜访|培训|演示|出差/

const CATEGORY_RULES: { pattern: RegExp; id: WorkCategoryId }[] = [
  { pattern: /拜访|走访|会见|接待|走访|回访|拜访了|去了.*局|去了.*厅|去了.*处|去了.*中心/, id: 'client_visit' },
  { pattern: /方案|标书|投标|招标|磋商|比选|应标|开标|评标|中标|竞标|采购文件/, id: 'bidding' },
  { pattern: /编写|撰写|编写了|写.*方案|编写.*方案|编写.*报告|编写.*文档|技术方案|解决方案|建设方案/, id: 'solution' },
  { pattern: /技术交流|技术对接|技术讨论|产品演示|选型|POC|测试验证|适配/, id: 'tech_exchange' },
  { pattern: /竞品|竞争分析|对手|对比分析|产品对比|厂商/, id: 'competitive' },
  { pattern: /需求调研|需求分析|需求对接|现场调研|业务调研|摸底/, id: 'requirement' },
  { pattern: /会议|开会|周会|月会|例会|专题会|协调会|推进会|评审会|联审/, id: 'meeting' },
  { pattern: /演示|汇报|展示|讲解|介绍.*方案|PPT|汇报材料/, id: 'demo' },
  { pattern: /培训|学习|考试|认证|研讨|分享/, id: 'training' },
  { pattern: /协调|内部.*沟通|跨部门|对接.*部门|催.*流程/, id: 'coordination' },
  { pattern: /审批|流程|签报|OA|走流程|报批/, id: 'approval' },
  { pattern: /出差|外出|去了|赶往|赶赴|飞往|高铁/, id: 'travel' }
]

function detectCategory(text: string): WorkCategoryId {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.id
  }
  return 'other'
}

function detectClientName(text: string, clients: { name: string }[]): string {
  for (const c of clients) {
    if (text.includes(c.name)) return c.name
  }
  const pattern = /([\u4e00-\u9fa5]{2,10}(?:市|区|县|镇)?)((?:[\u4e00-\u9fa5]{1,6}(?:局|厅|处|委|办|中心|院|所)){1,2})/
  const match = text.match(pattern)
  if (match?.[0]) return match[0]
  const simplePattern = /([\u4e00-\u9fa5]{2,8}(?:集团|公司|企业|学校|医院))/
  const simpleMatch = text.match(simplePattern)
  if (simpleMatch?.[0]) return simpleMatch[0]
  return ''
}

/**
 * 智能识别项目名称
 * 策略：优先匹配已有项目，其次匹配明确的项目名模式
 */
function inferProjectName(text: string, projects: Project[]): string {
  // 1. 优先匹配已有项目名（精确匹配，按名称长度降序，避免短名误匹配）
  const sorted = [...projects].sort((a, b) => b.name.length - a.name.length)
  for (const p of sorted) {
    if (text.includes(p.name)) return p.name
  }

  // 2. 匹配 "XX项目" 模式 — 项目名必须是名词，不能是动词
  const projectPattern = /([a-zA-Z\u4e00-\u9fa5][a-zA-Z\u4e00-\u9fa5\d+（）()\-\s]{1,20}?)项目/g
  let match: RegExpExecArray | null
  while ((match = projectPattern.exec(text)) !== null) {
    const name = match[1].trim()
    // 排除动词开头
    if (!VERBS.test(name) && name.length >= 2) return name + '项目'
  }

  // 3. 匹配 "关于/跟进/推进 XX" 模式，且 XX 不是动词
  const aboutPattern = /(?:关于|跟进|推进|负责)[：:\s]*([a-zA-Z\u4e00-\u9fa5][a-zA-Z\u4e00-\u9fa5\d]{1,15}?)(?:[，。；;的]|$)/
  const aboutMatch = text.match(aboutPattern)
  if (aboutMatch?.[1]) {
    const name = aboutMatch[1].trim()
    if (!VERBS.test(name) && name.length >= 2 && name.length <= 20) return name
  }

  // 4. 匹配引号内的名称，如 "智慧城市" 项目
  const quotePattern = /[""「]([^""」]{2,20})[""」]/
  const quoteMatch = text.match(quotePattern)
  if (quoteMatch?.[1]) {
    const name = quoteMatch[1].trim()
    if (!VERBS.test(name)) return name
  }

  return ''
}

function splitTodoText(text: string) {
  // 待办关键词
  const markers = ['待办', '待处理', '需跟进', '需要跟进', '后续要', '明天要', '下周要', '提醒', '记得']
  const markerIndex = markers
    .map(marker => text.indexOf(marker))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0]

  if (markerIndex === undefined) {
    return { logText: text, todoText: '' }
  }

  return {
    logText: text.slice(0, markerIndex).replace(/[，。；;：:、\s]+$/, '').trim(),
    todoText: text.slice(markerIndex).replace(/^(待办|待处理|需跟进|需要跟进|后续|提醒|记得)[：:\s]*/, '').trim()
  }
}

function buildLogContent(text: string, projectName: string) {
  const clean = text.trim()
  if (!clean) return ''
  const prefix = projectName ? `【${projectName}】` : ''
  return `${prefix}${clean}`.slice(0, 500)
}

function buildTodoTitle(text: string) {
  return text
    .replace(/^(明天|今天|后天|下周|本周|之前|前)\s*/, '')
    .replace(/[。；;，,]+$/, '')
    .trim()
    .slice(0, 60) || '待办事项'
}

export function applySmartEntry(
  rawText: string,
  stores: {
    projectsStore: ProjectsStore
    todosStore: TodosStore
    workLogsStore: WorkLogsStore
    clientsStore?: ClientsStore
  }
): SmartEntryResult {
  const text = rawText.trim()
  const result: SmartEntryResult = { projects: [], todos: [], workLogs: [], summary: '', analyzedItems: [] }
  if (!text) return result

  const { projectsStore, todosStore, workLogsStore, clientsStore } = stores
  const { logText, todoText } = splitTodoText(text)
  const projectName = inferProjectName(text, projectsStore.projects)
  const existingProject = projectName ? projectsStore.findProjectByName(projectName) : undefined
  const categoryId = detectCategory(text)

  const clientName = clientsStore ? detectClientName(text, clientsStore.clients) : ''
  let clientId: string | null = null
  if (clientName && clientsStore) {
    const client = clientsStore.ensureClient({
      name: clientName,
      type: 'government',
      contacts: [],
      region: '',
      industry: '',
      importance: 'B',
      followUpStatus: 'active',
      lastContactDate: null,
      nextFollowUpDate: null,
      source: '',
      notes: ''
    })
    clientId = client.id
    if (!clientsStore.findClientByName(clientName)) {
      result.analyzedItems.push({
        type: 'client',
        title: clientName,
        detail: '新客户已自动创建',
        isNew: true
      })
    }
  }

  const project = projectName && projectName.length >= 2
    ? projectsStore.ensureProject({
        name: projectName,
        description: text.slice(0, 120),
        status: 'planning',
        progress: 0,
        startDate: today(),
        endDate: ''
      })
    : undefined

  if (project && !existingProject) {
    result.projects.push(project)
    result.analyzedItems.push({
      type: 'project',
      title: project.name,
      detail: '新项目已自动创建',
      isNew: true
    })
  } else if (project && existingProject) {
    result.analyzedItems.push({
      type: 'project',
      title: project.name,
      detail: '已关联到现有项目',
      isNew: false
    })
  }

  if (logText) {
    const log = workLogsStore.addWorkLog({
      date: parseDate(logText),
      content: buildLogContent(logText, project?.name || ''),
      categoryId,
      clientId,
      projectId: project?.id || null
    })
    result.workLogs.push(log)
    result.analyzedItems.push({
      type: 'log',
      title: logText.length > 40 ? logText.slice(0, 40) + '…' : logText,
      detail: `记录于 ${parseDate(logText)}`,
      projectName: project?.name,
      clientName: clientName || undefined,
      category: WORK_CATEGORIES.find(c => c.id === categoryId)?.name
    })
  }

  if (todoText) {
    const todo = todosStore.addTodo({
      title: buildTodoTitle(todoText),
      description: todoText,
      status: 'pending',
      priority: /紧急|重要|尽快|下班前|今天/.test(todoText) ? 'high' : 'medium',
      dueDate: parseDate(todoText),
      projectId: project?.id || null,
      planTaskId: null,
      category: 'project'
    })
    result.todos.push(todo)
    result.analyzedItems.push({
      type: 'todo',
      title: buildTodoTitle(todoText),
      detail: todo.description,
      priority: todo.priority,
      dueDate: todo.dueDate,
      projectName: project?.name
    })
  }

  const parts: string[] = []
  if (result.workLogs.length) parts.push('日志')
  if (result.todos.length) parts.push('待办')
  if (result.projects.length) parts.push(`新项目「${result.projects[0].name}」`)
  if (project && !existingProject && !result.projects.length) parts.push(`关联项目「${project.name}」`)
  if (clientName) parts.push(`客户「${clientName}」`)
  result.summary = parts.length ? `已记录 ${parts.join('、')}` : '已记录'

  return result
}

export function analyzeEntry(
  rawText: string,
  stores: {
    projectsStore: ProjectsStore
    todosStore?: TodosStore
    clientsStore?: ClientsStore
  }
): PendingEntry {
  const text = rawText.trim()
  const empty: PendingEntry = { rawText: '', projects: [], todos: [], logs: [], client: null, categoryId: 'other', analyzedItems: [], summary: '' }
  if (!text) return empty

  const { projectsStore, clientsStore } = stores
  const { logText, todoText } = splitTodoText(text)
  const projectName = inferProjectName(text, projectsStore.projects)
  const existingProject = projectName ? projectsStore.findProjectByName(projectName) : undefined
  const categoryId = detectCategory(text)
  const clientName = clientsStore ? detectClientName(text, clientsStore.clients) : ''
  const existingClient = clientName && clientsStore ? clientsStore.findClientByName(clientName) : undefined

  const result: PendingEntry = {
    rawText: text,
    projects: [],
    todos: [],
    logs: [],
    client: null,
    categoryId,
    analyzedItems: [],
    summary: ''
  }

  if (clientName) {
    result.client = { name: clientName, isNew: !existingClient }
    result.analyzedItems.push({
      type: 'client',
      title: clientName,
      detail: existingClient ? '已关联现有客户' : '将自动创建新客户',
      isNew: !existingClient
    })
  }

  if (projectName && projectName.length >= 2) {
    result.projects.push({
      name: projectName,
      description: text.slice(0, 120),
      isNew: !existingProject,
      existingId: existingProject?.id
    })
    result.analyzedItems.push({
      type: 'project',
      title: projectName,
      detail: existingProject ? '已关联到现有项目' : '将自动创建新项目',
      isNew: !existingProject
    })
  }

  if (logText) {
    result.logs.push({
      date: parseDate(logText),
      content: buildLogContent(logText, projectName || ''),
      categoryId,
      projectName: projectName || undefined,
      clientName: clientName || undefined
    })
    result.analyzedItems.push({
      type: 'log',
      title: logText.length > 40 ? logText.slice(0, 40) + '…' : logText,
      detail: `记录于 ${parseDate(logText)}`,
      projectName: projectName || undefined,
      clientName: clientName || undefined,
      category: WORK_CATEGORIES.find(c => c.id === categoryId)?.name
    })
  }

  if (todoText) {
    const priority = /紧急|重要|尽快|下班前|今天/.test(todoText) ? 'high' : 'medium'
    result.todos.push({
      title: buildTodoTitle(todoText),
      description: todoText,
      priority,
      dueDate: parseDate(todoText),
      projectName: projectName || undefined
    })
    result.analyzedItems.push({
      type: 'todo',
      title: buildTodoTitle(todoText),
      detail: todoText,
      priority,
      dueDate: parseDate(todoText),
      projectName: projectName || undefined
    })
  }

  const parts: string[] = []
  if (result.logs.length) parts.push('日志')
  if (result.todos.length) parts.push('待办')
  if (result.projects.length && result.projects[0].isNew) parts.push(`新项目「${result.projects[0].name}」`)
  if (result.projects.length && !result.projects[0].isNew) parts.push(`关联项目「${result.projects[0].name}」`)
  if (clientName) parts.push(`客户「${clientName}」`)
  result.summary = parts.length ? `识别到 ${parts.join('、')}` : ''

  return result
}

export function confirmEntry(
  pending: PendingEntry,
  stores: {
    projectsStore: ProjectsStore
    todosStore: TodosStore
    workLogsStore: WorkLogsStore
    clientsStore?: ClientsStore
  }
): SmartEntryResult {
  const { projectsStore, todosStore, workLogsStore, clientsStore } = stores
  const result: SmartEntryResult = { projects: [], todos: [], workLogs: [], summary: '', analyzedItems: pending.analyzedItems }

  let clientId: string | null = null
  if (pending.client && clientsStore) {
    const client = clientsStore.ensureClient({
      name: pending.client.name,
      type: 'government',
      contacts: [],
      region: '',
      industry: '',
      importance: 'B',
      followUpStatus: 'active',
      lastContactDate: null,
      nextFollowUpDate: null,
      source: '',
      notes: ''
    })
    clientId = client.id
  }

  let projectId: string | null = null
  for (const p of pending.projects) {
    const project = projectsStore.ensureProject({
      name: p.name,
      description: p.description,
      status: 'planning',
      progress: 0,
      startDate: today(),
      endDate: ''
    })
    projectId = project.id
    result.projects.push(project)
  }

  for (const l of pending.logs) {
    const log = workLogsStore.addWorkLog({
      date: l.date,
      content: l.content,
      categoryId: l.categoryId,
      clientId,
      projectId
    })
    result.workLogs.push(log)

    if (clientId && clientsStore && l.categoryId === 'client_visit') {
      clientsStore.addVisit({
        clientId,
        date: l.date,
        contact: '',
        content: l.content,
        contactPersonId: '',
        result: '已拜访',
        nextPlan: ''
      })
    }
  }

  for (const t of pending.todos) {
    const todo = todosStore.addTodo({
      title: t.title,
      description: t.description,
      status: 'pending',
      priority: t.priority as 'high' | 'medium' | 'low',
      dueDate: t.dueDate,
      projectId,
      planTaskId: null,
      category: 'project'
    })
    result.todos.push(todo)
  }

  result.summary = pending.summary.replace('识别到', '已记录')
  return result
}

export async function analyzeEntryWithAI(
  rawText: string,
  stores: {
    projectsStore: ProjectsStore
    clientsStore?: ClientsStore
  }
): Promise<PendingEntry> {
  const text = rawText.trim()
  const empty: PendingEntry = { rawText: '', projects: [], todos: [], logs: [], client: null, categoryId: 'other', analyzedItems: [], summary: '' }
  if (!text) return empty

  const { projectsStore, clientsStore } = stores
  const existingProjectNames = projectsStore.projects.map(p => p.name).join('、')
  const existingClientNames = clientsStore ? clientsStore.clients.map(c => c.name).join('、') : ''

  const today = new Date().toISOString().split('T')[0]
  const categoryList = WORK_CATEGORIES.map(c => `  - ${c.id}: ${c.name}`).join('\n')

  const prompt = `你是一个工作日志智能分析助手。请分析以下用户输入的工作内容，提取结构化信息。

## 今日日期
${today}

## 已有项目
${existingProjectNames || '（暂无）'}

## 已有客户
${existingClientNames || '（暂无）'}

## 工作分类（categoryId 必须是以下之一）
${categoryList}

## 用户输入
${text}

## 要求
请返回严格的 JSON 格式（不要包含 markdown 代码块标记），结构如下：
{
  "logs": [{ "content": "日志内容", "categoryId": "分类ID", "projectName": "关联项目名(可选)", "clientName": "关联客户名(可选)", "date": "日期YYYY-MM-DD(默认今天)" }],
  "todos": [{ "title": "待办标题", "description": "详细描述", "priority": "high/medium/low", "dueDate": "YYYY-MM-DD", "projectName": "关联项目名(可选)" }],
  "projects": [{ "name": "项目名", "description": "项目描述", "isNew": true/false }],
  "client": { "name": "客户名", "isNew": true/false } 或 null,
  "summary": "一句话总结识别结果"
}

规则：
1. 日志内容要保持用户原意，可适当润色但不要改变含义
2. 如果用户提到的项目名与已有项目匹配，isNew 设为 false
3. 如果用户提到的客户名与已有客户匹配，isNew 设为 false
4. 分类要准确，参考工作分类列表
5. 如果没有待办相关内容，todos 数组为空
6. 如果没有项目相关内容，projects 数组为空
7. 如果内容中有日期信息（如"明天"、"下周"、具体日期），提取到对应字段`

  const response = await chatWithAI([{ role: 'user', content: prompt }])

  let parsed: any
  try {
    const jsonStr = response.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()
    parsed = JSON.parse(jsonStr)
  } catch {
    return analyzeEntry(rawText, stores)
  }

  const result: PendingEntry = {
    rawText: text,
    projects: [],
    todos: [],
    logs: [],
    client: null,
    categoryId: 'other',
    analyzedItems: [],
    summary: ''
  }

  if (parsed.client && parsed.client.name) {
    const existingClient = clientsStore ? clientsStore.findClientByName(parsed.client.name) : undefined
    result.client = { name: parsed.client.name, isNew: !existingClient }
    result.analyzedItems.push({
      type: 'client',
      title: parsed.client.name,
      detail: existingClient ? '已关联现有客户' : '将自动创建新客户',
      isNew: !existingClient
    })
  }

  for (const p of (parsed.projects || [])) {
    if (!p.name) continue
    const existing = projectsStore.findProjectByName(p.name)
    result.projects.push({
      name: p.name,
      description: p.description || text.slice(0, 120),
      isNew: !existing,
      existingId: existing?.id
    })
    result.analyzedItems.push({
      type: 'project',
      title: p.name,
      detail: existing ? '已关联到现有项目' : '将自动创建新项目',
      isNew: !existing
    })
  }

  const projectName = result.projects.length ? result.projects[0].name : ''
  for (const l of (parsed.logs || [])) {
    const catId = (WORK_CATEGORIES.some(c => c.id === l.categoryId) ? l.categoryId : 'other') as WorkCategoryId
    result.logs.push({
      date: l.date || today,
      content: l.content || text,
      categoryId: catId,
      projectName: l.projectName || projectName || undefined,
      clientName: l.clientName || parsed.client?.name || undefined
    })
    result.analyzedItems.push({
      type: 'log',
      title: (l.content || text).slice(0, 40) + ((l.content || text).length > 40 ? '…' : ''),
      detail: `记录于 ${l.date || today}`,
      projectName: l.projectName || projectName || undefined,
      clientName: l.clientName || parsed.client?.name || undefined,
      category: WORK_CATEGORIES.find(c => c.id === catId)?.name
    })
    if (!result.categoryId || result.categoryId === 'other') result.categoryId = catId
  }

  for (const t of (parsed.todos || [])) {
    if (!t.title) continue
    const priority = ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium'
    result.todos.push({
      title: t.title,
      description: t.description || t.title,
      priority,
      dueDate: t.dueDate || today,
      projectName: t.projectName || projectName || undefined
    })
    result.analyzedItems.push({
      type: 'todo',
      title: t.title,
      detail: t.description || t.title,
      priority,
      dueDate: t.dueDate || today,
      projectName: t.projectName || projectName || undefined
    })
  }

  result.summary = parsed.summary || ''

  if (!result.logs.length && text.length > 5) {
    result.logs.push({
      date: today,
      content: text,
      categoryId: result.categoryId || 'other',
      projectName: projectName || undefined,
      clientName: parsed.client?.name || undefined
    })
    result.analyzedItems.push({
      type: 'log',
      title: text.slice(0, 40) + (text.length > 40 ? '…' : ''),
      detail: `记录于 ${today}`,
      category: WORK_CATEGORIES.find(c => c.id === result.categoryId)?.name
    })
  }

  return result
}
