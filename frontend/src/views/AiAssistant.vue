<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { NCard, NButton, NInput, NList, NListItem, NSpin, NSpace, NTag, NText, NEmpty, NIcon, NAvatar } from 'naive-ui'
import { SendOutline, RefreshOutline, PersonOutline, ChatboxEllipsesOutline } from '@vicons/ionicons5'
import { useAiAssistantStore } from '../stores/aiAssistant'

const inputMessage = ref('')
const messageListRef = ref(null)
const store = useAiAssistantStore()

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      const container = messageListRef.value.$el || messageListRef.value
      container.scrollTop = container.scrollHeight
    }
  })
}

async function sendMessage() {
  if (!inputMessage.value.trim()) return
  await store.sendMessage(inputMessage.value)
  inputMessage.value = ''
  scrollToBottom()
}

function clearChat() {
  store.clearMessages()
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  store.loadMessages()
})
</script>

<template>
  <div style="height: calc(100vh - 100px); display: flex; flex-direction: column">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
      <h2 style="font-size: 24px; font-weight: 600; color: #262626; margin: 0">AI 助手</h2>
      <n-button size="small" @click="clearChat">
        <template #icon><RefreshOutline /></template>
        清空对话
      </n-button>
    </div>

    <n-card style="flex: 1; display: flex; flex-direction: column" :content-style="{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }">
      <!-- 消息列表 -->
      <div ref="messageListRef" style="flex: 1; overflow-y: auto; padding: 16px">
        <n-list v-if="store.messages.length > 0">
          <n-list-item v-for="msg in store.messages" :key="msg.id" style="padding: 12px 0">
            <div style="display: flex; gap: 12px; width: 100%">
              <!-- 头像 -->
              <n-avatar
                :style="{
                  backgroundColor: msg.role === 'user' ? '#1890ff' : '#52c41a',
                  flexShrink: 0
                }"
                round
              >
                <n-icon :component="msg.role === 'user' ? PersonOutline : ChatboxEllipsesOutline" />
              </n-avatar>
              
              <!-- 消息内容 -->
              <div style="flex: 1">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
                  <n-tag :type="msg.role === 'user' ? 'primary' : 'success'" size="small">
                    {{ msg.role === 'user' ? '我' : 'AI 助手' }}
                  </n-tag>
                  <n-text type="tertiary" style="font-size: 12px">
                    {{ formatTime(msg.timestamp) }}
                  </n-text>
                </div>
                <div style="white-space: pre-wrap; line-height: 1.8; font-size: 14px; color: #262626">
                  {{ msg.content }}
                </div>
              </div>
            </div>
          </n-list-item>
        </n-list>

        <!-- 空状态 -->
        <div v-else style="height: 100%; display: flex; align-items: center; justify-content: center">
          <n-empty description="开始与 AI 助手对话吧！">
            <template #icon>
              <n-icon :size="64" color="#1890ff">
                <ChatboxEllipsesOutline />
              </n-icon>
            </template>
            <template #extra>
              <div style="text-align: center; color: #999; line-height: 1.8">
                <p>你可以问关于工作日志、项目管理、方案设计等问题</p>
                <p style="font-size: 13px; margin-top: 8px">例如：</p>
                <p style="font-size: 13px; color: #1890ff">"如何更好地记录工作日志？"</p>
                <p style="font-size: 13px; color: #1890ff">"帮我制定一个项目计划"</p>
              </div>
            </template>
          </n-empty>
        </div>

        <!-- 加载状态 -->
        <div v-if="store.loading" style="text-align: center; padding: 20px">
          <n-spin size="medium" />
          <p style="margin-top: 12px; color: #999; font-size: 14px">AI 正在思考...</p>
        </div>
      </div>

      <!-- 输入框 -->
      <div style="border-top: 1px solid #e8e8e8; padding-top: 16px; margin-top: 16px">
        <n-space>
          <n-input
            v-model:value="inputMessage"
            type="textarea"
            placeholder="输入你的问题..."
            :autosize="{ minRows: 2, maxRows: 6 }"
            @keydown.enter.ctrl="sendMessage"
            style="flex: 1"
          />
          <n-button type="primary" @click="sendMessage" :loading="store.loading">
            <template #icon><SendOutline /></template>
            发送
          </n-button>
        </n-space>
        <n-text type="tertiary" style="font-size: 12px; margin-top: 8px; display: block">
          按 Ctrl + Enter 发送
        </n-text>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
:deep(.n-card) {
  border-radius: 12px;
}
</style>
