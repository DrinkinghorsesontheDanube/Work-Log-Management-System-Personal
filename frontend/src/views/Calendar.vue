<script setup>
import { ref, onMounted, computed } from 'vue'
import { NCard, NCalendar, NModal, NForm, NFormItem, NInput, NSelect, NButton, NTextarea, NSpace, NText, NTag, NIcon } from 'naive-ui'
import { useWorkLogsStore } from '../stores/workLogs'
import { useProjectsStore } from '../stores/projects'
import { CalendarOutline, DocumentTextOutline } from '@vicons/ionicons5'

const workLogsStore = useWorkLogsStore()
const projectsStore = useProjectsStore()

const selectedDate = ref(new Date().toISOString().split('T')[0])
const showEditModal = ref(false)
const logContent = ref('')
const selectedProjectId = ref(null)

const projectOptions = computed(() => [
  { label: '不关联项目', value: null },
  ...projectsStore.projects.map(p => ({ label: p.name, value: p.id }))
])

function handleSelectDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  selectedDate.value = `${year}-${month}-${day}`
  
  const existingLog = workLogsStore.getWorkLogByDate(selectedDate.value)
  if (existingLog) {
    logContent.value = existingLog.content
    selectedProjectId.value = existingLog.projectId
  } else {
    logContent.value = ''
    selectedProjectId.value = null
  }
  showEditModal.value = true
}

function saveWorkLog() {
  if (selectedProjectId.value === null) {
    selectedProjectId.value = null
  }
  
  const existingLog = workLogsStore.getWorkLogByDate(selectedDate.value)
  if (existingLog) {
    workLogsStore.updateWorkLog(existingLog.id, {
      content: logContent.value,
      projectId: selectedProjectId.value
    })
  } else {
    workLogsStore.addWorkLog({
      date: selectedDate.value,
      content: logContent.value,
      projectId: selectedProjectId.value
    })
  }
  showEditModal.value = false
  logContent.value = ''
  selectedProjectId.value = null
}

function getProjectName(projectId) {
  if (!projectId) return '未关联项目'
  const project = projectsStore.projects.find(p => p.id === projectId)
  return project ? project.name : '未知项目'
}

onMounted(() => {
  workLogsStore.loadWorkLogs()
  projectsStore.loadProjects()
})
</script>

<template>
  <div>
    <h2 style="margin-bottom: 24px; font-size: 24px; font-weight: 600; color: #262626">日历视图</h2>
    
    <n-grid :x-gap="24" :cols="1">
      <n-grid-item>
        <n-card title="工作日志" :bordered="false" hoverable>
          <template #header-extra>
            <n-space>
              <n-icon :size="20" color="#1890ff"><CalendarOutline /></n-icon>
              <n-text type="info" style="font-size: 13px">点击日期记录工作日志</n-text>
            </n-space>
          </template>
          <n-calendar @update:value="handleSelectDate" />
        </n-card>
      </n-grid-item>
      
      <!-- 近期日志列表 -->
      <n-grid-item style="margin-top: 24px">
        <n-card title="近期日志" :bordered="false" hoverable>
          <template #header-extra>
            <n-icon :size="20" color="#52c41a"><DocumentTextOutline /></n-icon>
          </template>
          <n-list>
            <template v-if="workLogsStore.workLogs.length === 0">
              <n-list-item>
                <n-text type="secondary">暂无工作日志</n-text>
              </n-list-item>
            </template>
            <template v-else>
              <n-list-item v-for="log in workLogsStore.workLogs.slice(-5).reverse()" :key="log.id">
                <div style="width: 100%">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
                    <n-tag type="info" size="small">{{ log.date }}</n-tag>
                    <n-tag :type="log.projectId ? 'success' : 'default'" size="small">
                      {{ getProjectName(log.projectId) }}
                    </n-tag>
                  </div>
                  <n-text style="white-space: pre-wrap; font-size: 14px; line-height: 1.6">
                    {{ log.content }}
                  </n-text>
                </div>
              </n-list-item>
            </template>
          </n-list>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 编辑日志模态框 -->
    <n-modal v-model:show="showEditModal" preset="card" :style="{ width: '650px' }" title="编辑工作日志">
      <n-form>
        <n-form-item label="日期">
          <n-text strong style="font-size: 16px">{{ selectedDate }}</n-text>
        </n-form-item>
        <n-form-item label="关联项目">
          <n-select 
            v-model:value="selectedProjectId" 
            :options="projectOptions" 
            placeholder="选择关联项目（可选）" 
            clearable
          />
        </n-form-item>
        <n-form-item label="工作内容">
          <n-textarea
            v-model:value="logContent"
            :autosize="{ minRows: 6, maxRows: 12 }"
            placeholder="请详细记录今天的工作内容..."
            :maxlength="2000"
            show-count
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" @click="saveWorkLog">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
:deep(.n-card) {
  border-radius: 12px;
}
</style>
