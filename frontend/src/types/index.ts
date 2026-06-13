export interface ProjectPhase {
  id: string
  name: string
  order: number
  color: string
}

export const DEFAULT_PHASES: ProjectPhase[] = [
  { id: 'initiation', name: '项目立项', order: 0, color: '#6366f1' },
  { id: 'survey', name: '需求调研', order: 1, color: '#8b5cf6' },
  { id: 'solution', name: '方案设计', order: 2, color: '#a855f7' },
  { id: 'bidding', name: '招投标', order: 3, color: '#ec4899' },
  { id: 'contract', name: '合同签订', order: 4, color: '#f43f5e' },
  { id: 'detail_design', name: '详细设计', order: 5, color: '#f97316' },
  { id: 'implementation', name: '开发实施', order: 6, color: '#eab308' },
  { id: 'testing', name: '测试验收', order: 7, color: '#22c55e' },
  { id: 'trial', name: '试运行', order: 8, color: '#14b8a6' },
  { id: 'delivery', name: '正式交付', order: 9, color: '#06b6d4' },
  { id: 'maintenance', name: '运维支持', order: 10, color: '#3b82f6' }
]

export interface Project {
  id: string
  name: string
  description: string
  progress: number
  startDate: string
  endDate: string
  status: 'planning' | 'in_progress' | 'completed' | 'paused'
  currentPhaseId: string
  phaseHistory: PhaseRecord[]
  clientId: string | null
  budget: number
  manager: string
  createdAt: string
  updatedAt: string
}

export interface PhaseRecord {
  phaseId: string
  startDate: string
  endDate: string | null
  note: string
}

export interface PlanTask {
  id: string
  projectId: string
  name: string
  startDate: string
  endDate: string
  progress: number
  status: 'pending' | 'in_progress' | 'completed'
  order: number
  createdAt: string
  updatedAt: string
}

export interface Todo {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  dueDate: string
  projectId: string | null
  createdAt: string
  updatedAt: string
}

export interface Report {
  id: string
  type: 'day' | 'week' | 'month'
  periodLabel: string
  startDate: string
  endDate: string
  content: string
  createdAt: string
}

export const WORK_CATEGORIES = [
  { id: 'client_visit', name: '客户拜访', icon: '👥', color: '#3b82f6' },
  { id: 'solution', name: '方案编写', icon: '📄', color: '#8b5cf6' },
  { id: 'bidding', name: '招投标', icon: '📋', color: '#ec4899' },
  { id: 'tech_exchange', name: '技术交流', icon: '💬', color: '#06b6d4' },
  { id: 'competitive', name: '竞品分析', icon: '🔍', color: '#f97316' },
  { id: 'requirement', name: '需求调研', icon: '📝', color: '#14b8a6' },
  { id: 'meeting', name: '会议纪要', icon: '🏛️', color: '#6366f1' },
  { id: 'demo', name: '演示汇报', icon: '🎤', color: '#ef4444' },
  { id: 'training', name: '培训学习', icon: '📚', color: '#22c55e' },
  { id: 'coordination', name: '内部协调', icon: '🤝', color: '#a855f7' },
  { id: 'approval', name: '审批流程', icon: '✅', color: '#eab308' },
  { id: 'travel', name: '出差', icon: '🚄', color: '#0ea5e9' },
  { id: 'other', name: '其他', icon: '📌', color: '#94a3b8' }
] as const

export type WorkCategoryId = typeof WORK_CATEGORIES[number]['id']

export interface WorkLog {
  id: string
  date: string
  content: string
  categoryId: WorkCategoryId
  clientId: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  name: string
  type: 'government' | 'enterprise' | 'institution'
  contact: string
  phone: string
  department: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface AiProvider {
  id: string
  name: string
  baseUrl: string
  model: string
  apiKey: string
  enabled: boolean
}

export const AI_PROVIDERS: Omit<AiProvider, 'apiKey' | 'enabled'>[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'xiaomi', name: '小米 MiMo', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5' },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'moonshot', name: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { id: 'zhipu', name: '智谱 (GLM)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { id: 'custom', name: '自定义', baseUrl: '', model: '' }
]
