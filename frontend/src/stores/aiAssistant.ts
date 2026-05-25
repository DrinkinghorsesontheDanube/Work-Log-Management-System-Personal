
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AiMessage } from '../types'
import { storage } from '../utils/storage'

export const useAiAssistantStore = defineStore('aiAssistant', () => {
  const messages = ref<AiMessage[]>([])
  const loading = ref(false)

  function loadMessages() {
    messages.value = storage.getAiMessages()
  }

  function saveMessages() {
    storage.saveAiMessages(messages.value)
  }

  async function sendMessage(content: string) {
    const userMessage: AiMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    }
    messages.value.push(userMessage)
    loading.value = true
    saveMessages()

    await new Promise(resolve => setTimeout(resolve, 500))

    const assistantMessage: AiMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '这是一个模拟的AI回答。在实际应用中，这里会接入真实的AI服务。',
      timestamp: new Date().toISOString()
    }
    messages.value.push(assistantMessage)
    loading.value = false
    saveMessages()
  }

  function clearMessages() {
    messages.value = []
    saveMessages()
  }

  return {
    messages,
    loading,
    loadMessages,
    sendMessage,
    clearMessages
  }
})
