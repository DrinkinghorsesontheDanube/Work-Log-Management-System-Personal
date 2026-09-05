import { storage } from '../utils/storage'
import type { AiProvider } from '../types'

/**
 * AI 调用层：全部经由服务端代理（server/server.js 的 /api/ai/*）。
 * API Key 只保存在服务端，浏览器不接触 Key。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`)
  }
  return data
}

export async function chatWithAI(messages: ChatMessage[]): Promise<string> {
  if (!isAiConfigured()) {
    throw new Error('请先在设置中配置 AI 服务')
  }
  const data = await postJson<{ content: string }>('/api/ai/chat', { messages })
  return data.content
}

export async function testConnection(
  provider: AiProvider,
): Promise<{ success: boolean; message: string }> {
  try {
    return await postJson<{ success: boolean; message: string }>('/api/ai/test', { provider })
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : '连接失败' }
  }
}

export async function generateWorkLog(rawText: string): Promise<string> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const formatDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `请帮我将以下工作内容整理成规范的工作日志格式。

要求：
1. 今日工作总结：整理今天的工作内容，包含要点总结和关键事项
2. 明日计划（${formatDate(tomorrow)}）：根据今天的工作推导出明天需要开展的具体工作，要具体可执行

今天的工作内容：
${rawText}`,
    },
  ]
  return chatWithAI(messages)
}

export async function generateWeeklyReport(logs: string[]): Promise<string> {
  const today = new Date()
  const dayOfWeek = today.getDay() || 7
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() - dayOfWeek + 8)
  const nextSunday = new Date(today)
  nextSunday.setDate(today.getDate() - dayOfWeek + 14)

  const formatDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `请根据以下本周工作日志，生成一份结构清晰的周报。

要求：
1. 工作总结：概括本周主要工作内容和成果
2. 重点成果：列出本周取得的关键进展
3. 存在问题：指出遇到的困难和需要协调的事项
4. 下周计划（${formatDate(nextMonday)}-${formatDate(nextSunday)}）：根据本周工作推导出下周需要开展的具体工作，要具体可执行

本周工作日志：
${logs.join('\n---\n')}`,
    },
  ]
  return chatWithAI(messages)
}

export async function analyzeProject(projectInfo: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `请分析以下项目信息，给出项目状态评估、风险提示和改进建议：\n\n${projectInfo}`,
    },
  ]
  return chatWithAI(messages)
}

export function isAiConfigured(): boolean {
  const provider = storage.getAiProvider()
  return !!(provider && provider.enabled && provider.hasKey)
}
