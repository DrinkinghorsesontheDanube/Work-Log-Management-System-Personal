<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  NCard, 
  NGrid, 
  NGridItem, 
  NProgress, 
  NButton, 
  NStatistic, 
  NList, 
  NListItem, 
  NText, 
  NIcon, 
  NEmpty, 
  NSpace 
} from 'naive-ui'
import { useProjectsStore } from '../stores/projects'
import { useTodosStore } from '../stores/todos'
import { useWorkLogsStore } from '../stores/workLogs'
import { useAiAssistantStore } from '../stores/aiAssistant'
import { FolderOpenOutline, CheckmarkCircleOutline, CalendarOutline, TrendingUpOutline } from '@vicons/ionicons5'

const router = useRouter()
const projectsStore = useProjectsStore()
const todosStore = useTodosStore()
const workLogsStore = useWorkLogsStore()
const aiStore = useAiAssistantStore()

const chartOption = computed(() => {
  const stats = workLogsStore.last7DaysStats
  const dates = Object.keys(stats)
  const values = Object.values(stats)
  
  return {
    title: {
      text: '近7天工作趋势',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'normal', color: '#666' }
    },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: dates.map(d => d.slice(5)),
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisLabel: { color: '#999' }
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    series: [{
      type: 'bar',
      data: values,
      itemStyle: { 
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#1890ff' },
            { offset: 1, color: '#69c0ff' }
          ]
        },
        borderRadius: [4, 4, 0, 0]
      },
      barWidth: '60%'
    }]
  }
})

function getPriorityColor(priority) {
  const colors = { high: '#ff4d4f', medium: '#faad14', low: '#52c41a' }
  return colors[priority] || '#d9d9d9'
}

function markTodoComplete(todoId) {
  todosStore.updateTodo(todoId, { status: 'completed' })
}

function addSampleData() {
  const today = new Date().toISOString().split('T')[0]
  
  const project1 = projectsStore.addProject({
    name: 'XX 国企数字化转型项目',
    description: '企业核心业务系统升级改造，包含 OA、ERP、CRM 等模块',
    progress: 45,
    startDate: '2024-01-15',
    endDate: '2024-12-31',
    status: 'in_progress'
  })

  const project2 = projectsStore.addProject({
    name: 'YY 公司信息化平台建设',
    description: '企业门户、数据中台、智能报表系统建设',
    progress: 20,
    startDate: '2024-03-01',
    endDate: '2024-09-30',
    status: 'in_progress'
  })

  todosStore.addTodo({
    title: '完成项目需求文档',
    description: '整理客户需求，形成正式文档',
    status: 'completed',
    priority: 'high',
    dueDate: today,
    projectId: project1.id
  })

  todosStore.addTodo({
    title: '准备项目启动会 PPT',
    description: '向客户展示项目方案和实施计划',
    status: 'in_progress',
    priority: 'high',
    dueDate: today,
    projectId: project1.id
  })

  todosStore.addTodo({
    title: '联系技术专家',
    description: '安排与技术架构师的讨论会议',
    status: 'pending',
    priority: 'medium',
    dueDate: today,
    projectId: project2.id
  })

  workLogsStore.addWorkLog({
    date: today,
    content: '今日工作：\n1. 与客户进行需求沟通会议\n2. 整理会议纪要和问题清单\n3. 更新项目进度表',
    projectId: project1.id
  })
}

onMounted(() => {
  projectsStore.loadProjects()
  todosStore.loadTodos()
  workLogsStore.loadWorkLogs()
  aiStore.loadMessages()
  
  if (projectsStore.projects.length === 0) {
    addSampleData()
  }
})
</script>

<template>
  <div>
    <h2 style="margin-bottom: 24px; font-size: 24px; font-weight: 600; color: #262626">工作台</h2>
    
    <!-- 统计卡片 -->
    <n-grid :x-gap="16" :y-gap="16" :cols="4" style="margin-bottom: 24px">
      <n-grid-item>
        <n-card hoverable style="border-left: 4px solid #1890ff">
          <n-statistic label="进行中项目" :label-style="{ color: '#8c8c8c', fontSize: '14px' }">
            <template #prefix>
              <n-icon :size="24" color="#1890ff"><FolderOpenOutline /></n-icon>
            </template>
            <template #default>
              <span style="font-size: 32px; font-weight: 600; color: #262626">{{ projectsStore.inProgressProjects.length }}</span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      
      <n-grid-item>
        <n-card hoverable style="border-left: 4px solid #52c41a">
          <n-statistic label="今日待办" :label-style="{ color: '#8c8c8c', fontSize: '14px' }">
            <template #prefix>
              <n-icon :size="24" color="#52c41a"><CheckmarkCircleOutline /></n-icon>
            </template>
            <template #default>
              <span style="font-size: 32px; font-weight: 600; color: #262626">{{ todosStore.todayTodos.length }}</span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      
      <n-grid-item>
        <n-card hoverable style="border-left: 4px solid #faad14">
          <n-statistic label="总项目数" :label-style="{ color: '#8c8c8c', fontSize: '14px' }">
            <template #prefix>
              <n-icon :size="24" color="#faad14"><FolderOpenOutline /></n-icon>
            </template>
            <template #default>
              <span style="font-size: 32px; font-weight: 600; color: #262626">{{ projectsStore.projects.length }}</span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
      
      <n-grid-item>
        <n-card hoverable style="border-left: 4px solid #1890ff">
          <n-statistic label="已完成项目" :label-style="{ color: '#8c8c8c', fontSize: '14px' }">
            <template #prefix>
              <n-icon :size="24" color="#1890ff"><CheckmarkCircleOutline /></n-icon>
            </template>
            <template #default>
              <span style="font-size: 32px; font-weight: 600; color: #262626">{{ projectsStore.completedProjects.length }}</span>
            </template>
          </n-statistic>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :x-gap="24" :cols="2">
      <!-- 项目概览 -->
      <n-grid-item>
        <n-card title="项目概览" :bordered="false" hoverable>
          <template #header-extra>
            <n-button text type="primary" @click="router.push('/projects')">查看全部</n-button>
          </template>
          <n-space vertical :size="16">
            <template v-if="projectsStore.projects.length === 0">
              <n-empty description="暂无项目" />
            </template>
            <template v-else>
              <div v-for="project in projectsStore.projects.slice(0, 5)" :key="project.id" style="padding: 12px; background: #fafafa; border-radius: 8px">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
                  <strong style="font-size: 15px; color: #262626">{{ project.name }}</strong>
                  <n-text type="info" style="font-size: 13px">{{ project.progress }}%</n-text>
                </div>
                <n-progress 
                  type="line" 
                  :percentage="project.progress" 
                  :show-indicator="false"
                  :height="8"
                  :border-radius="4"
                  :fill-border-radius="4"
                />
              </div>
            </template>
          </n-space>
        </n-card>
      </n-grid-item>

      <!-- 今日待办 -->
      <n-grid-item>
        <n-card title="今日待办" :bordered="false" hoverable>
          <template #header-extra>
            <n-button text type="primary" @click="router.push('/todos')">查看全部</n-button>
          </template>
          <n-space vertical :size="16">
            <template v-if="todosStore.todayTodos.length === 0">
              <n-empty description="今日无待办事项" />
            </template>
            <template v-else>
              <div v-for="todo in todosStore.todayTodos" :key="todo.id" style="padding: 12px; background: #fafafa; border-radius: 8px">
                <div style="display: flex; align-items: center; gap: 12px">
                  <div :style="{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getPriorityColor(todo.priority), flexShrink: 0 }"></div>
                  <span style="flex: 1; font-size: 15px; color: #262626">{{ todo.title }}</span>
                  <n-button size="small" type="primary" ghost @click="markTodoComplete(todo.id)">完成</n-button>
                </div>
              </div>
            </template>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 工作趋势 -->
    <n-card title="工作趋势" :bordered="false" hoverable style="margin-top: 24px">
      <div id="chart" style="height: 300px"></div>
    </n-card>
  </div>
</template>

<style scoped>
:deep(.n-card) {
  border-radius: 12px;
}
:deep(.n-progress) {
  margin-top: 4px;
}
</style>
