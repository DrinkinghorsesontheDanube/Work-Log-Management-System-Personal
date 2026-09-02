import { storage } from '../utils/storage'
import type { AiProvider } from '../types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `你是一个专业的信息化集成项目售前岗位工作助手。你的职责是帮助用户：
1. 撰写和优化工作日志
2. 生成周报、月报
3. 分析项目情况并给出建议
4. 协助方案设计和技术选型
5. 整理客户需求和待办事项

重要规则：
- 生成日报时，必须包含"明日计划"部分，列出明天需要开展的具体工作
- 生成周报时，必须包含"下周计划"部分，列出下周需要开展的具体工作
- 生成月报时，必须包含"下月计划"部分，列出下月需要开展的具体工作
- 计划内容要具体、可执行，基于当前工作推导

请用专业、简洁、有条理的方式回答。当用户描述工作内容时，帮他们整理成结构化的日志格式。`

function buildHeaders(provider: AiProvider): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // 小米 MiMo 使用 api-key 头，其他使用 Authorization: Bearer
  if (provider.id === 'xiaomi') {
    headers['api-key'] = provider.apiKey
  } else {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  return headers
}

/**
 * OpenAI 新模型只认 max_completion_tokens，而部分 OpenAI 兼容网关只认旧参数 max_tokens。
 * 默认发新参数，服务端 400 且报错文本指向 token 参数时降级用 max_tokens 重试一次。
 */
async function postChatCompletion(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<Response> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (response.status === 400 && body.max_completion_tokens !== undefined) {
    const errorText = await response
      .clone()
      .text()
      .catch(() => '')
    if (errorText.includes('max_completion_tokens') || errorText.includes('max_tokens')) {
      const fallbackBody = { ...body }
      fallbackBody.max_tokens = fallbackBody.max_completion_tokens
      delete fallbackBody.max_completion_tokens
      return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(fallbackBody),
      })
    }
  }
  return response
}

export async function chatWithAI(messages: ChatMessage[]): Promise<string> {
  const provider = storage.getAiProvider()
  if (!provider || !provider.enabled || !provider.apiKey) {
    throw new Error('请先在设置中配置 AI 服务')
  }

  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.7,
    max_completion_tokens: 2000,
  }

  const response = await postChatCompletion(url, buildHeaders(provider), body)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    if (response.status === 401) {
      throw new Error('API Key 无效，请在设置中检查是否正确')
    }
    if (response.status === 403) {
      throw new Error('API Key 权限不足或已过期')
    }
    if (response.status === 429) {
      throw new Error('请求频率过高，请稍后再试')
    }
    throw new Error(`请求失败 (${response.status}): ${errorText.slice(0, 200)}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI 返回内容为空')
  }
  return content
}

export async function testConnection(
  provider: AiProvider,
): Promise<{ success: boolean; message: string }> {
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`

  const body = {
    model: provider.model,
    messages: [{ role: 'user', content: '你好' }],
    max_completion_tokens: 10,
  }

  try {
    const response = await postChatCompletion(url, buildHeaders(provider), body)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (response.status === 401) {
        return { success: false, message: 'API Key 无效，请检查是否正确复制' }
      }
      if (response.status === 403) {
        return { success: false, message: 'API Key 权限不足或已过期' }
      }
      if (response.status === 404) {
        return { success: false, message: 'API 地址或模型名称错误' }
      }
      return {
        success: false,
        message: `请求失败 (${response.status}): ${errorText.slice(0, 150)}`,
      }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (content) {
      return { success: true, message: `连接成功！模型响应: "${content.slice(0, 50)}"` }
    }
    return { success: true, message: '连接成功，但返回内容为空' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '未知错误'
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return {
        success: false,
        message:
          '网络请求被阻止，可能是 CORS 限制。请确认 API 地址正确，或尝试使用支持 CORS 的供应商',
      }
    }
    return { success: false, message: `连接失败: ${msg}` }
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
  return !!(provider && provider.enabled && provider.apiKey)
}
