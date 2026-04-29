<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <n-gradient-text type="info" style="font-size: 24px; font-weight: bold;">
        项目管理
      </n-gradient-text>
      <n-button type="primary" @click="showCreate = true">
        <template #icon><n-icon><AddOutline /></n-icon></template>
        新建项目
      </n-button>
    </div>

    <n-empty v-if="projects.length === 0" description="暂无项目，点击「新建项目」创建" />

    <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
      <n-gi v-for="project in projects" :key="project.id">
        <n-card
          :bordered="true"
          hoverable
          size="small"
          @click="router.push(`/projects/${project.id}`)"
          style="cursor: pointer; height: 100%;"
        >
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
              <span style="font-size: 15px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">{{ project.name }}</span>
              <n-tag
                :type="stageType(project)"
                size="small"
                round
              >
                {{ project.stage_label }}
              </n-tag>
            </div>
          </template>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div v-if="project.customer" style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
              <span style="color: #888; min-width: 40px;">客户</span>
              <span>{{ project.customer }}</span>
            </div>
            <div v-if="project.members" style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
              <span style="color: #888; min-width: 40px;">人员</span>
              <n-space size="small">
                <n-tag v-for="m in project.members.split(',')" :key="m" size="tiny" round>{{ m.trim() }}</n-tag>
              </n-space>
            </div>
            <div v-if="project.last_log_time" style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #888;">
              <span style="min-width: 40px;">最近</span>
              <span>{{ project.last_log_time }} · {{ project.last_log_title || '' }}</span>
            </div>
            <div v-if="project.note" style="font-size: 12px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
              {{ project.note }}
            </div>
          </div>

          <template #footer>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #aaa;">
              <span>{{ project.create_time ? project.create_time.slice(0,10) : '' }}</span>
              <n-tag v-if="project.is_closed" type="error" size="tiny">已完结</n-tag>
            </div>
          </template>
        </n-card>
      </n-gi>
    </n-grid>

    <n-modal v-model:show="showCreate" title="新建项目" preset="card" style="width: 500px;">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="项目名称" path="name">
          <n-input v-model:value="form.name" placeholder="项目名称" />
        </n-form-item>
        <n-form-item label="客户单位">
          <n-input v-model:value="form.customer" placeholder="客户单位名称" />
        </n-form-item>
        <n-form-item label="相关人员">
          <n-dynamic-tags v-model:value="form.members" placeholder="输入人员姓名" />
        </n-form-item>
        <n-form-item label="当前阶段">
          <n-select v-model:value="form.stage" :options="stageOptions" />
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="form.note" type="textarea" :rows="3" />
        </n-form-item>
        <n-button type="primary" block :loading="saving" @click="handleCreate">创建</n-button>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { getProjects, createProject, getStages } from '../api/index.js'

const router = useRouter()
const message = useMessage()
const projects = ref([])
const showCreate = ref(false)
const saving = ref(false)
const formRef = ref(null)

const form = ref({
  name: '',
  customer: '',
  members: [],
  stage: '',
  note: ''
})

const rules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }]
}

const stagesMap = ref({})

const stageOptions = computed(() => {
  return Object.entries(stagesMap.value).map(([value, label]) => ({
    label,
    value
  }))
})

const stageTypeList = ['default', 'info', 'warning', 'error', 'success', 'primary']
function stageType(project) {
  if (!project) return 'default'
  let stages = {}
  try { stages = JSON.parse(project.stages) || {} } catch (e) {}
  const keys = Object.keys(stages)
  const idx = keys.indexOf(project.stage)
  return idx >= 0 ? stageTypeList[idx % stageTypeList.length] : 'default'
}

async function loadProjects() {
  try {
    const res = await getProjects()
    projects.value = res.data
  } catch (e) {
    console.error(e)
  }
}

async function handleCreate() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    const payload = {
      ...form.value,
      members: Array.isArray(form.value.members) ? form.value.members.join(',') : form.value.members
    }
    await createProject(payload)
    message.success('项目创建成功')
    showCreate.value = false
    const firstStage = Object.keys(stagesMap.value)[0] || 'initial_contact'
    form.value = { name: '', customer: '', members: [], stage: firstStage, note: '' }
    await loadProjects()
  } catch (e) {
    message.error('创建失败')
  } finally {
    saving.value = false
  }
}

async function loadStages() {
  try {
    const res = await getStages()
    stagesMap.value = res.data || {}
    const firstStage = Object.keys(stagesMap.value)[0]
    if (firstStage && !form.value.stage) {
      form.value.stage = firstStage
    }
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadProjects()
  loadStages()
})
</script>
