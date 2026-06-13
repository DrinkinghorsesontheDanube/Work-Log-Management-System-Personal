import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AiMessage } from '../types'
import { storage } from '../utils/storage'
import { createEntity } from '../utils/entity'
import { chatWithAI, isAiConfigured } from '../services/aiService'
import type { ChatMessage as AiChatMessage } from '../services/aiService'

export const useAiAssistantStore = defineStore('aiAssistant', () => {
  const messages = ref<AiMessage[]>([])
  const loading = ref(false)
  const error = ref('')

  function loadMessages() {
    messages.value = storage.getAiMessages()
  }

  function saveMessages() {
    storage.saveAiMessages(messages.value)
  }

  async function sendMessage(content: string) {
    const userMessage: AiMessage = createEntity({
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    }, 'msg')
    messages.value.push(userMessage)
    loading.value = true
    error.value = ''
    saveMessages()

    try {
      if (!isAiConfigured()) {
        throw new Error('请先在设置中配置 AI 服务')
      }

      const chatHistory: AiChatMessage[] = messages.value.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }))

      const reply = await chatWithAI(chatHistory)

      const assistantMessage: AiMessage = createEntity({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString()
      }, 'msg')
      messages.value.push(assistantMessage)
      saveMessages()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : '请求失败'
      error.value = errorMessage
      const errorMsg: AiMessage = createEntity({
        role: 'assistant',
        content: `[错误] ${errorMessage}`,
        timestamp: new Date().toISOString()
      }, 'msg')
      messages.value.push(errorMsg)
      saveMessages()
    } finally {
      loading.value = false
    }
  }

  function clearMessages() {
    messages.value = []
    saveMessages()
  }

  return {
    messages,
    loading,
    error,
    loadMessages,
    sendMessage,
    clearMessages
  }
})
