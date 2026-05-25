
export interface Project {
  id: string
  name: string
  description: string
  progress: number
  startDate: string
  endDate: string
  status: 'pending' | 'in_progress' | 'completed'
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

export interface WorkLog {
  id: string
  date: string
  content: string
  projectId: string | null
  createdAt: string
  updatedAt: string
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

