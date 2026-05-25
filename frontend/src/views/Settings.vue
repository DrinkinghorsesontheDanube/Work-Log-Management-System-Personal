<script setup>
import { NCard, NButton, NPopconfirm, NIcon, NSpace, NText, NAlert, NDivider, NTag } from 'naive-ui'
import { DownloadOutline, TrashOutline, InformationCircleOutline, CloudUploadOutline, CheckmarkCircleOutline } from '@vicons/ionicons5'
import { storage } from '../utils/storage'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import { useAiAssistantStore } from '../stores/aiAssistant'

function exportData() {
  const dataStr = storage.exportAllData()
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `工作日志备份_${new Date().toLocaleDateString('zh-CN')}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function clearAllData() {
  storage.clearAllData()
  
  const projectsStore = useProjectsStore()
  const todosStore = useTodosStore()
  const workLogsStore = useWorkLogsStore()
  const aiStore = useAiAssistantStore()
  
  projectsStore.loadProjects()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  aiStore.loadMessages()
}
</script>

<template>
  <div>
    <h2 style="margin-bottom: 24px; font-size: 24px; font-weight: 600; color: #262626">设置</h2>

    <!-- 数据管理 -->
    <n-card title="数据管理" :bordered="false" hoverable style="margin-bottom: 20px">
      <template #header-extra>
        <n-icon :size="20" color="#1890ff"><InformationCircleOutline /></n-icon>
      </template>
      
      <n-space vertical :size="20">
        <!-- 导出数据 -->
        <div style="padding: 20px; background: #fafafa; border-radius: 8px">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div style="flex: 1">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
                <n-icon :size="20" color="#52c41a"><DownloadOutline /></n-icon>
                <strong style="font-size: 15px; color: #262626">导出数据</strong>
              </div>
              <n-text depth="3" style="font-size: 13px; line-height: 1.6">
                导出所有数据为 JSON 格式备份文件，包括项目、待办、日志和 AI 对话记录。
              </n-text>
            </div>
            <n-button type="primary" @click="exportData">
              <template #icon><n-icon><DownloadOutline /></n-icon></template>
              导出备份
            </n-button>
          </div>
        </div>

        <n-divider style="margin: 0" />

        <!-- 清空数据 -->
        <div style="padding: 20px; background: #fff2f0; border-radius: 8px; border: 1px solid #ffccc7">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div style="flex: 1">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
                <n-icon :size="20" color="#ff4d4f"><TrashOutline /></n-icon>
                <strong style="font-size: 15px; color: #ff4d4f">清空所有数据</strong>
              </div>
              <n-text depth="3" style="font-size: 13px; line-height: 1.6">
                谨慎操作，此操作不可恢复。所有项目、待办、日志和 AI 对话记录都将被永久删除。
              </n-text>
            </div>
            <n-popconfirm
              positive-text="确定清空"
              negative-text="取消"
              @positive-click="clearAllData"
            >
              <template #trigger>
                <n-button type="error" ghost>
                  <template #icon><n-icon><TrashOutline /></n-icon></template>
                  清空数据
                </n-button>
              </template>
              <div style="text-align: center">
                <p style="margin-bottom: 12px; color: #ff4d4f; font-weight: 600">确定要清空所有数据吗？</p>
                <p style="color: #999; font-size: 13px">此操作不可恢复，请谨慎操作！</p>
              </div>
            </n-popconfirm>
          </div>
        </div>
      </n-space>
    </n-card>

    <!-- 关于 -->
    <n-card title="关于系统" :bordered="false" hoverable>
      <template #header-extra>
        <n-icon :size="20" color="#1890ff"><InformationCircleOutline /></n-icon>
      </template>
      
      <n-space vertical :size="16">
        <n-alert type="info">
          <template #header>
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px">工作日志管理系统</div>
          </template>
          <div style="line-height: 1.8">
            <p style="margin: 0; font-size: 14px"><strong>版本：</strong>v1.0.0</p>
            <p style="margin: 8px 0 0 0; font-size: 14px"><strong>技术栈：</strong>Vue 3 + TypeScript + Naive UI</p>
            <p style="margin: 8px 0 0 0; font-size: 14px"><strong>数据存储：</strong>LocalStorage 本地存储</p>
          </div>
        </n-alert>

        <n-divider style="margin: 8px 0" />

        <div>
          <div style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #262626">
            <n-icon :size="18" color="#1890ff"><InformationCircleOutline /></n-icon>
            系统说明
          </div>
          <n-text depth="3" style="font-size: 14px; line-height: 1.8">
            专为信息化集成项目售前岗位设计的工作日志管理系统。帮助解决方案经理高效记录日常工作、管理项目进度、跟踪待办事项，并通过 AI 助手提升工作效率。
          </n-text>
        </div>

        <n-divider style="margin: 8px 0" />

        <div>
          <div style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #262626">
            <n-icon :size="18" color="#52c41a"><CheckmarkCircleOutline /></n-icon>
            主要功能
          </div>
          <n-space vertical :size="8">
            <div style="display: flex; align-items: center; gap: 8px">
              <n-tag type="info" size="small">工作台</n-tag>
              <n-text depth="3" style="font-size: 13px">概览统计、项目进度、待办摘要</n-text>
            </div>
            <div style="display: flex; align-items: center; gap: 8px">
              <n-tag type="info" size="small">日历视图</n-tag>
              <n-text depth="3" style="font-size: 13px">记录每日工作日志、查看历史记录</n-text>
            </div>
            <div style="display: flex; align-items: center; gap: 8px">
              <n-tag type="info" size="small">项目管理</n-tag>
              <n-text depth="3" style="font-size: 13px">管理项目信息、跟踪项目进度</n-text>
            </div>
            <div style="display: flex; align-items: center; gap: 8px">
              <n-tag type="info" size="small">待办事项</n-tag>
              <n-text depth="3" style="font-size: 13px">任务看板、优先级管理</n-text>
            </div>
            <div style="display: flex; align-items: center; gap: 8px">
              <n-tag type="info" size="small">AI 助手</n-tag>
              <n-text depth="3" style="font-size: 13px">智能问答、工作辅助</n-text>
            </div>
          </n-space>
        </div>
      </n-space>
    </n-card>
  </div>
</template>

<style scoped>
:deep(.n-card) {
  border-radius: 12px;
}
</style>
