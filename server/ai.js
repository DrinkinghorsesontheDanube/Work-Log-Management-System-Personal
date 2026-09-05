/**
 * AI 上游代理：API Key 只保存在服务端，浏览器永远不接触 Key。
 * 服务端读取已保存的 provider 配置，转发到 OpenAI 兼容的 /chat/completions。
 */

export const SYSTEM_PROMPT = `你是一个专业的信息化集成项目售前岗位工作助手。你的职责是帮助用户：
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

function buildUpstreamHeaders(provider) {
  const headers = { 'Content-Type': 'application/json' }
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
async function postChatCompletion(url, headers, body) {
  let res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  if (res.status === 400 && body.max_completion_tokens !== undefined) {
    const errorText = await res
      .clone()
      .text()
      .catch(() => '')
    if (errorText.includes('max_completion_tokens') || errorText.includes('max_tokens')) {
      const fallback = { ...body }
      fallback.max_tokens = fallback.max_completion_tokens
      delete fallback.max_completion_tokens
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(fallback),
        signal: AbortSignal.timeout(120_000),
      })
    }
  }
  return res
}

function mapUpstreamError(res, errorText) {
  if (res.status === 401) return new Error('API Key 无效，请在设置中检查是否正确')
  if (res.status === 403) return new Error('API Key 权限不足或已过期')
  if (res.status === 429) return new Error('请求频率过高，请稍后再试')
  if (res.status === 404) return new Error('API 地址或模型名称错误')
  return new Error(`请求失败 (${res.status}): ${(errorText || '').slice(0, 200)}`)
}

export function isProviderConfigured(provider) {
  return !!(provider && provider.enabled && provider.apiKey && provider.baseUrl && provider.model)
}

export async function chatCompletion(provider, messages, { withSystemPrompt = false } = {}) {
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const bodyMessages = withSystemPrompt ? [{ role: 'system', content: SYSTEM_PROMPT }, ...messages] : messages
  const body = {
    model: provider.model,
    messages: bodyMessages,
    temperature: 0.7,
    max_completion_tokens: 2000,
  }

  const res = await postChatCompletion(url, buildUpstreamHeaders(provider), body)
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw mapUpstreamError(res, errorText)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 返回内容为空')
  return content
}

export async function testProvider(provider) {
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const body = {
    model: provider.model,
    messages: [{ role: 'user', content: '你好' }],
    max_completion_tokens: 10,
  }
  try {
    const res = await postChatCompletion(url, buildUpstreamHeaders(provider), body)
    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      if (res.status === 401) return { success: false, message: 'API Key 无效，请检查是否正确复制' }
      if (res.status === 403) return { success: false, message: 'API Key 权限不足或已过期' }
      if (res.status === 404) return { success: false, message: 'API 地址或模型名称错误' }
      return { success: false, message: `请求失败 (${res.status}): ${errorText.slice(0, 150)}` }
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (content) return { success: true, message: `连接成功！模型响应: "${content.slice(0, 50)}"` }
    return { success: true, message: '连接成功，但返回内容为空' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: `连接失败: ${msg}` }
  }
}
