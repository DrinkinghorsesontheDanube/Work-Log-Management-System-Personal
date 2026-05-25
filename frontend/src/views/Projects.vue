<script setup>
import { ref, onMounted, computed } from 'vue'
import { NCard, NButton, NModal, NForm, NFormItem, NInput, NInputNumber, NSelect, NProgress, NSpace, NTag, NText, NIcon, NEmpty, NGrid, NGridItem, NPopconfirm } from 'naive-ui'
import { AddOutline, EditOutline, TrashOutline, FolderOpenOutline } from '@vicons/ionicons5'
import { useProjectsStore } from '../stores/projects'

const projectsStore = useProjectsStore()

const showModal = ref(false)
const editingProject = ref(null)
const projectName = ref('')
const projectDescription = ref('')
const projectProgress = ref(0)
const projectStatus = ref('in_progress')
const startDate = ref('')
const endDate = ref('')

const statusOptions = [
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '待开始', value: 'pending' }
]

function openAddModal() {
  editingProject.value = null
  projectName.value = ''
  projectDescription.value = ''
  projectProgress.value = 0
  projectStatus.value = 'in_progress'
  const today = new Date().toISOString().split('T')[0]
  startDate.value = today
  endDate.value = today
  showModal.value = true
}

function openEditModal(project) {
  editingProject.value = project
  projectName.value = project.name
  projectDescription.value = project.description
  projectProgress.value = project.progress
  projectStatus.value = project.status
  startDate.value = project.startDate
  endDate.value = project.endDate
  showModal.value = true
}

function saveProject() {
  if (editingProject.value) {
    projectsStore.updateProject(editingProject.value.id, {
      name: projectName.value,
      description: projectDescription.value,
      progress: projectProgress.value,
      status: projectStatus.value,
      startDate: startDate.value,
      endDate: endDate.value
    })
  } else {
    projectsStore.addProject({
      name: projectName.value,
      description: projectDescription.value,
      progress: projectProgress.value,
      status: projectStatus.value,
      startDate: startDate.value,
      endDate: endDate.value
    })
  }
  showModal.value = false
}

function deleteProject(id) {
  projectsStore.deleteProject(id)
}

function getStatusType(status) {
  const types = { in_progress: 'info', completed: 'success', pending: 'default' }
  return types[status] || 'default'
}

function getStatusText(status) {
  const texts = { in_progress: '进行中', completed: '已完成', pending: '待开始' }
  return texts[status] || status
}

onMounted(() => {
  projectsStore.loadProjects()
})
</script>

<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px">
      <h2 style="font-size: 24px; font-weight: 600; color: #262626; margin: 0">项目管理</h2>
      <n-button type="primary" @click="openAddModal">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        添加项目
      </n-button>
    </div>

    <!-- 项目列表 -->
    <n-grid :x-gap="20" :y-gap="20" :cols="3">
      <template v-if="projectsStore.projects.length === 0">
        <n-grid-item>
          <n-card :bordered="false" hoverable>
            <n-empty description="暂无项目">
              <template #extra>
                <n-button size="small" type="primary" @click="openAddModal">添加第一个项目</n-button>
              </template>
            </n-empty>
          </n-card>
        </n-grid-item>
      </template>
      <template v-else>
        <n-grid-item v-for="project in projectsStore.projects" :key="project.id">
          <n-card :bordered="false" hoverable style="height: 100%">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: flex-start">
                <div style="flex: 1">
                  <div style="font-size: 16px; font-weight: 600; color: #262626; margin-bottom: 8px">
                    {{ project.name }}
                  </div>
                  <n-tag :type="getStatusType(project.status)" size="small">
                    {{ getStatusText(project.status) }}
                  </n-tag>
                </div>
                <n-space>
                  <n-button text @click="openEditModal(project)">
                    <template #icon><n-icon color="#1890ff"><EditOutline /></n-icon></template>
                  </n-button>
                  <n-popconfirm @positive-click="deleteProject(project.id)">
                    <template #trigger>
                      <n-button text>
                        <template #icon><n-icon color="#ff4d4f"><TrashOutline /></n-icon></template>
                      </n-button>
                    </template>
                    确定要删除这个项目吗？
                  </n-popconfirm>
                </n-space>
              </div>
            </template>
            
            <div style="margin-bottom: 16px">
              <n-text depth="3" style="font-size: 13px; line-height: 1.6">
                {{ project.description }}
              </n-text>
            </div>
            
            <div style="margin-bottom: 12px">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
                <n-text depth="3" style="font-size: 13px">项目进度</n-text>
                <n-text strong style="font-size: 16px; color: #1890ff">{{ project.progress }}%</n-text>
              </div>
              <n-progress 
                type="line" 
                :percentage="project.progress" 
                :height="10"
                :border-radius="5"
                :fill-border-radius="5"
                :color="'#1890ff'"
                :rail-color="'#f0f0f0'"
              />
            </div>
            
            <n-divider style="margin: 12px 0" />
            
            <div style="display: flex; justify-content: space-between; font-size: 13px">
              <n-text depth="3">开始：{{ project.startDate }}</n-text>
              <n-text depth="3">结束：{{ project.endDate }}</n-text>
            </div>
          </n-card>
        </n-grid-item>
      </template>
    </n-grid>

    <!-- 新增/编辑项目模态框 -->
    <n-modal v-model:show="showModal" preset="card" :style="{ width: '550px' }" :title="editingProject ? '编辑项目' : '添加项目'">
      <n-form>
        <n-form-item label="项目名称" required>
          <n-input v-model:value="projectName" placeholder="请输入项目名称" />
        </n-form-item>
        <n-form-item label="项目描述">
          <n-input v-model:value="projectDescription" type="textarea" placeholder="请输入项目描述" :rows="3" />
        </n-form-item>
        <n-form-item label="项目进度">
          <n-input-number v-model:value="projectProgress" :min="0" :max="100" :show-button="false" style="width: 100%">
            <template #suffix>%</template>
          </n-input-number>
        </n-form-item>
        <n-form-item label="项目状态">
          <n-select v-model:value="projectStatus" :options="statusOptions" />
        </n-form-item>
        <n-form-item label="开始日期">
          <n-input v-model:value="startDate" type="date" />
        </n-form-item>
        <n-form-item label="结束日期">
          <n-input v-model:value="endDate" type="date" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" @click="saveProject">保存</n-button>
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
