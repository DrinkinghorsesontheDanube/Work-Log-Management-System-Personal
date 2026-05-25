<template>
  <div>
    <n-button text @click="router.push('/projects')" style="margin-bottom: 12px;">
      <template #icon><n-icon><ArrowBackOutline /></n-icon></template>
      返回项目列表
    </n-button>

    <n-spin :show="loading">
      <div v-if="project">
        <n-card :bordered="true" style="margin-bottom: 16px;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <n-gradient-text type="info" style="font-size: 22px; font-weight: bold;">
                {{ project.name }}
              </n-gradient-text>
              <n-space>
                <n-button size="small" @click="handleEdit">编辑</n-button>
                <n-popconfirm @positive-click="handleDelete">
                  <template #trigger>
                    <n-button size="small" type="error" secondary>删除</n-button>
                  </template>
                  确认删除项目？关联的日志不会被删除。
                </n-popconfirm>
              </n-space>
            </div>
          </template>

          <n-descriptions :column="2" bordered size="small">
            <n-descriptions-item label="客户单位">{{ project.customer || '-' }}</n-descriptions-item>
            <n-descriptions-item label="当前阶段">
              <div style="display: flex; align-items: center; gap: 6px;">
                <div :style="{
                  width: '10px', height: '10px', borderRadius: '50%',
                  backgroundColor: stageColor(project.stage),
                  boxShadow: '0 0 6px ' + stageColor(project.stage)
                }"></div>
                <span style="font-weight: bold; font-size: 14px; color: #2080f0;">{{ currentStageLabel }}</span>
              </div>
            </n-descriptions-item>
            <n-descriptions-item label="创建时间">{{ project.create_time }}</n-descriptions-item>
            <n-descriptions-item label="阶段变更时间">{{ project.stage_change_time }}</n-descriptions-item>
            <n-descriptions-item label="相关人员" :span="2">
              <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
                <template v-if="project.members">
                  <n-tag v-for="m in project.members.split(',')" :key="m" size="small" round closable @close="removeMember(m.trim())">
                    {{ m.trim() }}
                  </n-tag>
                </template>
                <span v-if="!project.members" style="color: #999; font-size: 13px;">暂无</span>
                <n-button size="tiny" quaternary circle @click.stop="showAddMember = true">
                  <template #icon><n-icon size="16"><AddOutline /></n-icon></template>
                </n-button>
              </div>
            </n-descriptions-item>
            <n-descriptions-item v-if="project.note" label="备注" :span="2">
              <div style="white-space: pre-wrap;">{{ project.note }}</div>
            </n-descriptions-item>
          </n-descriptions>

          <div style="margin-top: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label style="font-size: 13px; color: #888;">项目阶段（点击切换）</label>
              <n-space size="small">
                <n-button size="tiny" quaternary @click="showAddStage = true">
                  <template #icon><n-icon><AddOutline /></n-icon></template>
                  添加
                </n-button>
              </n-space>
            </div>
            <div v-if="stageOptions.length === 0" style="text-align: center; padding: 16px; color: #888; font-size: 13px;">
              暂无阶段，请点击「添加」创建
            </div>
            <div v-else style="display: flex; gap: 0; overflow-x: auto; padding: 4px 0;">
              <div
                v-for="(s, idx) in stageOptions"
                :key="s.value"
                style="display: flex; align-items: flex-start; flex: 1; min-width: 0;"
              >
                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 0;">
                  <div
                    @click="handleStageChange(idx)"
                    :title="'点击切换至: ' + s.label"
                    style="cursor: pointer; display: flex; flex-direction: column; align-items: center; width: 100%;"
                  >
                    <div
                      :style="{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: idx <= stageIndex ? '#fff' : '#999',
                        backgroundColor: idx < stageIndex ? '#18a058' : idx === stageIndex ? '#2080f0' : '#e0e0e0',
                        border: idx === stageIndex ? '3px solid #2080f0' : 'none',
                        transition: 'all 0.2s'
                      }"
                    >
                      {{ idx + 1 }}
                    </div>
                    <span
                      :style="{
                        fontSize: '12px',
                        marginTop: '4px',
                        textAlign: 'center',
                        fontWeight: idx === stageIndex ? 'bold' : 'normal',
                        color: idx === stageIndex ? '#2080f0' : '#666',
                        cursor: 'pointer',
                        padding: '0 2px',
                        wordBreak: 'keep-all',
                        whiteSpace: 'nowrap'
                      }"
                    >
                      {{ s.label }}
                    </span>
                  </div>
                  <div style="display: flex; gap: 2px; margin-top: 4px;">
                    <n-button
                      v-if="idx > 0"
                      quaternary circle size="tiny"
                      @click.stop="moveStage(idx, -1)"
                    >
                      <template #icon><n-icon size="12"><ChevronUpOutline /></n-icon></template>
                    </n-button>
                    <n-button
                      v-if="idx < stageOptions.length - 1"
                      quaternary circle size="tiny"
                      @click.stop="moveStage(idx, 1)"
                    >
                      <template #icon><n-icon size="12"><ChevronDownOutline /></n-icon></template>
                    </n-button>
                    <n-button
                      v-if="stageOptions.length > 1"
                      quaternary circle size="tiny" type="error"
                      @click.stop="handleRemoveStage(s.value, s.label)"
                    >
                      <template #icon><n-icon size="12"><CloseOutline /></n-icon></template>
                    </n-button>
                  </div>
                </div>
                <div v-if="idx < stageOptions.length - 1" :style="{
                  flex: '1',
                  height: '2px',
                  alignSelf: 'center',
                  marginTop: '-24px',
                  backgroundColor: idx < stageIndex ? '#18a058' : '#e0e0e0',
                  minWidth: '8px'
                }"></div>
              </div>
            </div>
          </div>
        </n-card>

        <n-grid :cols="3" :x-gap="16">
          <n-gi>
            <n-card :bordered="true" title="工作时间线" size="small">
              <n-empty v-if="!project.logs || project.logs.length === 0" description="暂无日志" />
              <n-timeline v-else>
                <n-timeline-item
                  v-for="log in project.logs"
                  :key="log.id"
                  :type="log.category === '项目性工作' ? 'info' : 'default'"
                  :time="log.log_date + (log.start_time ? ' ' + log.start_time : '')"
                >
                  <template #header>
                    <n-tag :type="log.category === '项目性工作' ? 'info' : 'default'" size="tiny" round>
                      {{ log.sub_category }}
                    </n-tag>
                  </template>
                  <strong>{{ log.title }}</strong>
                  <div style="font-size: 12px; color: #888;">{{ log.duration_min }}分钟</div>
                </n-timeline-item>
              </n-timeline>
            </n-card>
          </n-gi>

          <n-gi>
            <n-card :bordered="true" title="待办事项" size="small">
              <div style="margin-bottom: 12px;">
                <n-input
                  v-model:value="newTodo"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 2 }"
                  placeholder="添加新待办"
                  @keydown.ctrl.enter.prevent="handleCreateTodo"
                />
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px;">
                  <n-space size="small">
                    <n-select
                      v-model:value="newPriority"
                      :options="priorityOptions"
                      placeholder="优先级"
                      style="width: 100px;"
                      size="small"
                    />
                    <n-date-picker
                      v-model:value="newDueDate"
                      type="date"
                      placeholder="完成时间"
                      clearable
                      size="small"
                      style="width: 130px;"
                    />
                  </n-space>
                  <n-button type="primary" :disabled="!newTodo.trim()" :loading="saving" size="small" @click="handleCreateTodo">
                    <template #icon><n-icon><AddOutline /></n-icon></template>
                    添加
                  </n-button>
                </div>
              </div>

              <n-empty v-if="todos.length === 0" description="暂无待办" />
              <div v-else style="display: flex; flex-direction: column; gap: 8px;">
                <div
                  v-for="todo in todos"
                  :key="todo.id"
                  style="padding: 10px 12px; background: #fafbfc; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: flex-start; gap: 10px;"
                >
                  <n-checkbox :checked="todo.status === 'done'" @update:checked="toggleTodo(todo, $event)" />
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <strong
                        :style="{
                          color: todo.status === 'done' ? '#a0aec0' : '#2d3748',
                          textDecoration: todo.status === 'done' ? 'line-through' : 'none'
                        }"
                      >{{ todo.title }}</strong>
                      <n-tag v-if="todo.priority === 'high'" type="error" size="tiny" round>高</n-tag>
                      <n-tag v-else-if="todo.priority === 'low'" type="default" size="tiny" round>低</n-tag>
                    </div>
                    <div v-if="todo.detail" style="font-size: 13px; color: #666;">{{ todo.detail }}</div>
                    <div v-if="todo.due_date" style="font-size: 12px; color: #999; margin-top: 4px;">
                      <span style="display: flex; align-items: center; gap: 4px;">
                        <n-icon size="12"><TimeOutline /></n-icon>
                        截止: {{ todo.due_date }}
                      </span>
                    </div>
                  </div>
                  <n-space size="small">
                    <n-button quaternary size="tiny" @click="startEditTodo(todo)">
                      <template #icon><n-icon size="14"><CreateOutline /></n-icon></template>
                    </n-button>
                    <n-popconfirm @positive-click="handleDeleteTodo(todo.id)">
                      <template #trigger>
                        <n-button quaternary size="tiny" type="error">
                          <template #icon><n-icon size="14"><TrashOutline /></n-icon></template>
                        </n-button>
                      </template>
                      确认删除？
                    </n-popconfirm>
                  </n-space>
                </div>
              </div>
            </n-card>
          </n-gi>

          <n-gi>
            <n-card :bordered="true" title="项目文档" size="small">
              <div style="margin-bottom: 12px;">
                <n-space>
                  <n-button size="small" @click="triggerUpload">
                    <template #icon><n-icon><CloudUploadOutline /></n-icon></template>
                    上传文档
                  </n-button>
                </n-space>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip"
                  style="display: none;"
                  @change="handleFileSelected"
                />
                <n-modal v-model:show="showUploadDialog" title="上传文档" preset="card" style="width: 420px;">
                  <n-form label-placement="top">
                    <n-form-item label="文件">
                      <n-input :value="selectedFileName" placeholder="请选择文件" readonly>
                        <template #suffix>
                          <n-button size="tiny" @click="triggerUpload">选择</n-button>
                        </template>
                      </n-input>
                    </n-form-item>
                    <n-form-item label="关联阶段">
                      <n-select v-model:value="uploadStage" :options="stageOptions" placeholder="选择所属阶段" clearable />
                    </n-form-item>
                    <n-space justify="end">
                      <n-button @click="showUploadDialog = false">取消</n-button>
                      <n-button type="primary" :loading="uploading" @click="confirmUpload">上传</n-button>
                    </n-space>
                  </n-form>
                </n-modal>
              </div>

              <n-empty v-if="!project.documents || project.documents.length === 0" description="暂无文档" />

              <n-timeline v-else>
                <n-timeline-item
                  v-for="doc in project.documents"
                  :key="doc.id"
                  :type="doc.related_stage && projectStages[doc.related_stage] ? 'info' : 'default'"
                  :time="doc.upload_time"
                >
                  <template #header>
                    <n-space size="small" align="center">
                      <n-tag v-if="doc.related_stage && projectStages[doc.related_stage]" size="tiny" round>
                        {{ projectStages[doc.related_stage] }}
                      </n-tag>
                      <span style="font-size: 13px;">{{ doc.file_name }}</span>
                    </n-space>
                  </template>
                  <template #default>
                    <n-space size="small">
                      <n-button quaternary size="tiny" @click="downloadDoc(doc)">
                        <template #icon><n-icon><DownloadOutline /></n-icon></template>
                        下载
                      </n-button>
                      <n-popconfirm @positive-click="handleDeleteDoc(doc.id)">
                        <template #trigger>
                          <n-button quaternary size="tiny" type="error">
                            <template #icon><n-icon><TrashOutline /></n-icon></template>
                            删除
                          </n-button>
                        </template>
                        确认删除？
                      </n-popconfirm>
                    </n-space>
                  </template>
                </n-timeline-item>
              </n-timeline>
            </n-card>
          </n-gi>
        </n-grid>

        <!-- 编辑待办的模态框 -->
        <n-modal v-model:show="showEditTodo" preset="card" title="编辑待办" style="width: 420px;">
          <n-form>
            <n-form-item label="标题">
              <n-input v-model:value="editingTodo.newTitle" />
            </n-form-item>
            <n-form-item label="详情">
              <n-input v-model:value="editingTodo.newDetail" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
            </n-form-item>
            <n-grid :cols="2" :x-gap="12">
              <n-gi>
                <n-form-item label="优先级">
                  <n-select v-model:value="editingTodo.newPriority" :options="priorityOptions" />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="截止时间">
                  <n-date-picker v-model:value="editingTodo.newDueDate" type="date" clearable style="width: 100%;" />
                </n-form-item>
              </n-gi>
            </n-grid>
          </n-form>
          <template #footer>
            <n-space justify="end">
              <n-button @click="editingTodo = null">取消</n-button>
              <n-button type="primary" :loading="saving" @click="saveEditTodo">保存</n-button>
            </n-space>
          </template>
        </n-modal>
      </div>
    </n-spin>

    <n-modal v-model:show="showEdit" title="编辑项目" preset="card" style="width: 500px;">
      <n-form ref="editFormRef" :model="editForm" :rules="editRules" label-placement="top">
        <n-form-item label="项目名称" path="name">
          <n-input v-model:value="editForm.name" />
        </n-form-item>
        <n-form-item label="客户单位">
          <n-input v-model:value="editForm.customer" />
        </n-form-item>
        <n-form-item label="相关人员">
          <n-dynamic-tags v-model:value="editForm.members" />
        </n-form-item>
        <n-form-item label="当前阶段">
          <n-select v-model:value="editForm.stage" :options="stageOptions" />
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="editForm.note" type="textarea" :rows="3" />
        </n-form-item>
        <n-form-item label="是否完结">
          <n-switch v-model:value="editForm.is_closed" />
        </n-form-item>
        <n-button type="primary" block :loading="saving" @click="handleUpdate">保存</n-button>
      </n-form>
    </n-modal>

    <n-modal v-model:show="showAddMember" title="添加相关人员" preset="card" style="width: 360px;">
      <n-input v-model:value="newMemberName" placeholder="输入人员姓名" @keyup.enter="confirmAddMember" />
      <template #footer>
        <n-button type="primary" @click="confirmAddMember" :disabled="!newMemberName.trim()">添加</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="showAddStage" title="添加项目阶段" preset="card" style="width: 400px;">
      <n-form label-placement="top">
        <n-form-item label="阶段标识（英文/拼音，唯一不可重复）">
          <n-input v-model:value="newStageKey" placeholder="例如: negotiation" />
        </n-form-item>
        <n-form-item label="阶段名称">
          <n-input v-model:value="newStageLabel" placeholder="例如: 商务谈判" @keyup.enter="confirmAddStage" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button type="primary" @click="confirmAddStage" :disabled="!newStageKey || !newStageLabel">添加</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { ArrowBackOutline, CloudUploadOutline, DownloadOutline, TrashOutline, AddOutline, CloseOutline, ChevronUpOutline, ChevronDownOutline, CreateOutline, TimeOutline, PlayCircleOutline, CheckmarkCircleOutline } from '@vicons/ionicons5'
import { getProject, updateProject, deleteProject, uploadFile, deleteDocument, updateProjectStages, getTodos, createTodo, updateTodo, deleteTodo } from '../api/index.js'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const dialog = useDialog()
const loading = ref(true)
const saving = ref(false)
const showEdit = ref(false)
const project = ref(null)
const editFormRef = ref(null)

// 待办事项相关
const todos = ref([])
const newTodo = ref('')
const newPriority = ref('medium')
const newDueDate = ref(null)
const newStartTime = ref(null)
const editingTodo = ref(null)

const showEditTodo = computed({
  get: () => editingTodo.value !== null,
  set: (value) => { if (!value) editingTodo.value = null }
})

const projectStages = computed(() => {
  if (!project.value) return {}
  if (project.value.stages) {
    try {
      const parsed = JSON.parse(project.value.stages)
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed
      }
    } catch (e) { /* fall through */ }
  }
  return {}
})

const stageOptions = computed(() => {
  return Object.entries(projectStages.value).map(([value, label]) => ({
    label,
    value
  }))
})

const stageIndex = ref(0)
const currentStageLabel = ref('-')

watch(
  [stageOptions, () => project.value?.stage],
  () => {
    const idx = stageOptions.value.findIndex(s => s.value === project.value?.stage)
    stageIndex.value = idx >= 0 ? idx : 0
    const opt = stageOptions.value[stageIndex.value]
    currentStageLabel.value = opt ? opt.label : (project.value?.stage || '-')
  },
  { immediate: true, deep: true }
)

const editForm = ref({})
const editRules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }]
}

const stageTypeList = ['default', 'info', 'warning', 'error', 'success', 'primary']
function stageType(stage) {
  const idx = Object.keys(projectStages.value).indexOf(stage)
  return idx >= 0 ? stageTypeList[idx % stageTypeList.length] : 'default'
}

const stageColorList = ['#2080f0', '#18a058', '#f0a020', '#d03050', '#2080f0', '#2080f0']
function stageColor(stage) {
  const idx = Object.keys(projectStages.value).indexOf(stage)
  return idx >= 0 ? stageColorList[idx % stageColorList.length] : '#2080f0'
}

const showAddStage = ref(false)
const newStageKey = ref('')
const newStageLabel = ref('')

const fileInputRef = ref(null)
const showUploadDialog = ref(false)
const uploadStage = ref(null)
const selectedFile = ref(null)
const selectedFileName = ref('')
const uploading = ref(false)

const showAddMember = ref(false)
const newMemberName = ref('')

const priorityOptions = [
  { label: '高优先级', value: 'high' },
  { label: '中优先级', value: 'medium' },
  { label: '低优先级', value: 'low' }
]

function confirmAddMember() {
  const name = newMemberName.value.trim()
  if (!name) return
  const current = project.value.members ? project.value.members.split(',').map(s => s.trim()).filter(Boolean) : []
  if (current.includes(name)) {
    message.warning('该人员已在列表中')
    return
  }
  current.push(name)
  const updated = current.join(',')
  updateProject(route.params.id, { members: updated }).then(() => {
    message.success('已添加')
    project.value.members = updated
    showAddMember.value = false
    newMemberName.value = ''
  }).catch(() => message.error('添加失败'))
}

function removeMember(name) {
  const current = project.value.members ? project.value.members.split(',').map(s => s.trim()).filter(Boolean) : []
  const updated = current.filter(m => m !== name).join(',')
  updateProject(route.params.id, { members: updated }).then(() => {
    message.success('已移除')
    project.value.members = updated
  }).catch(() => message.error('移除失败'))
}

async function confirmAddStage() {
  if (!newStageKey.value.trim() || !newStageLabel.value.trim()) return
  if (projectStages.value[newStageKey.value.trim()]) {
    message.warning('阶段标识已存在，请使用其他标识')
    return
  }
  const updated = { ...projectStages.value, [newStageKey.value.trim()]: newStageLabel.value.trim() }
  try {
    await updateProjectStages(route.params.id, updated)
    message.success('阶段已添加')
    showAddStage.value = false
    newStageKey.value = ''
    newStageLabel.value = ''
    await loadProject()
  } catch (e) {
    message.error('保存失败')
  }
}

function handleRemoveStage(key, label) {
  dialog.warning({
    title: '删除阶段',
    content: `确认删除阶段「${label}」？`,
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const updated = {}
      for (const [k, v] of Object.entries(projectStages.value)) {
        if (k !== key) updated[k] = v
      }
      try {
        const res = await updateProjectStages(route.params.id, updated)
        project.value = res.data
        if (project.value.stage === key) {
          const firstKey = Object.keys(updated)[0]
          if (firstKey) {
            await updateProject(route.params.id, { stage: firstKey })
          }
        }
        message.success('阶段已删除')
        await loadProject()
      } catch (e) {
        message.error('删除失败')
      }
    }
  })
}

async function moveStage(idx, direction) {
  const entries = Object.entries(projectStages.value)
  const targetIdx = idx + direction
  if (targetIdx < 0 || targetIdx >= entries.length) return
  const temp = entries[idx]
  entries[idx] = entries[targetIdx]
  entries[targetIdx] = temp
  const updated = {}
  entries.forEach(([k, v]) => { updated[k] = v })
  try {
    await updateProjectStages(route.params.id, updated)
    await loadProject()
  } catch (e) {
    message.error('排序失败')
  }
}

async function loadProject() {
  loading.value = true
  try {
    const res = await getProject(route.params.id)
    project.value = res.data
    if (project.value) {
      const stages = projectStages.value
      const keys = Object.keys(stages)
      if (keys.length > 0 && !stages[project.value.stage]) {
        await updateProject(route.params.id, { stage: keys[0] })
        const res2 = await getProject(route.params.id)
        project.value = res2.data
      }
    }
    await loadTodos()
  } catch (e) {
    message.error('加载项目失败')
    router.push('/projects')
  } finally {
    loading.value = false
  }
}

async function loadTodos() {
  try {
    const res = await getTodos({ project_id: route.params.id })
    todos.value = res.data
  } catch (e) {
    console.error('加载待办失败', e)
  }
}

async function handleCreateTodo() {
  const text = newTodo.value.trim()
  if (!text) return
  saving.value = true
  try {
    const dueDate = newDueDate.value ? dayjs(newDueDate.value).format('YYYY-MM-DD') : null
    const startTime = newStartTime.value ? dayjs(newStartTime.value).format('HH:mm') : null

    await createTodo({
      title: text,
      detail: '',
      due_date: dueDate,
      priority: newPriority.value,
      start_time: startTime,
      related_project_id: route.params.id
    })

    newTodo.value = ''
    newPriority.value = 'medium'
    newDueDate.value = null
    newStartTime.value = null
    message.success('待办已添加')
    await loadTodos()
  } catch (e) {
    message.error('添加失败')
  } finally {
    saving.value = false
  }
}

async function toggleTodo(todo, checked) {
  try {
    await updateTodo(todo.id, { status: checked ? 'done' : 'pending' })
    message.success(checked ? '已完成' : '已退回待办')
    await loadTodos()
  } catch (e) {
    message.error('更新失败')
  }
}

function startEditTodo(todo) {
  editingTodo.value = {
    ...todo,
    newTitle: todo.title,
    newDetail: todo.detail,
    newDueDate: todo.due_date ? dayjs(todo.due_date).valueOf() : null,
    newStartTime: todo.start_time ? dayjs(`2000-01-01 ${todo.start_time}`).valueOf() : null,
    newPriority: todo.priority
  }
}

async function saveEditTodo() {
  if (!editingTodo.value) return
  saving.value = true
  try {
    const dueDate = editingTodo.value.newDueDate ? dayjs(editingTodo.value.newDueDate).format('YYYY-MM-DD') : null
    const startTime = editingTodo.value.newStartTime ? dayjs(editingTodo.value.newStartTime).format('HH:mm') : null

    await updateTodo(editingTodo.value.id, {
      title: editingTodo.value.newTitle,
      detail: editingTodo.value.newDetail,
      due_date: dueDate,
      start_time: startTime,
      priority: editingTodo.value.newPriority
    })

    message.success('更新成功')
    editingTodo.value = null
    await loadTodos()
  } catch (e) {
    message.error('更新失败')
  } finally {
    saving.value = false
  }
}

async function handleDeleteTodo(todoId) {
  try {
    await deleteTodo(todoId)
    message.success('已删除')
    await loadTodos()
  } catch (e) {
    message.error('删除失败')
  }
}

function handleStageChange(index) {
  if (!project.value) return
  const stage = stageOptions.value[index]?.value
  if (stage && stage !== project.value.stage) {
    updateProject(project.value.id, { stage }).then(() => {
      message.success('阶段已更新')
      loadProject()
    })
  }
}

function handleEdit() {
  editForm.value = {
    name: project.value.name,
    customer: project.value.customer,
    members: project.value.members ? project.value.members.split(',').filter(Boolean) : [],
    stage: project.value.stage,
    note: project.value.note,
    is_closed: project.value.is_closed
  }
  showEdit.value = true
}

async function handleUpdate() {
  try {
    await editFormRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    const payload = {
      ...editForm.value,
      members: Array.isArray(editForm.value.members) ? editForm.value.members.join(',') : editForm.value.members
    }
    await updateProject(route.params.id, payload)
    message.success('更新成功')
    showEdit.value = false
    await loadProject()
  } catch (e) {
    message.error('更新失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  try {
    await deleteProject(route.params.id)
    message.success('项目已删除')
    router.push('/projects')
  } catch (e) {
    message.error('删除失败')
  }
}

function downloadDoc(doc) {
  window.open(`/api/download/${doc.file_path}`, '_blank')
}

async function handleDeleteDoc(docId) {
  try {
    await deleteDocument(docId)
    message.success('已删除')
    await loadProject()
  } catch (e) {
    message.error('删除失败')
  }
}

function triggerUpload() {
  fileInputRef.value?.click()
}

function handleFileSelected(e) {
  const file = e.target.files?.[0]
  if (file) {
    selectedFile.value = file
    selectedFileName.value = file.name
    e.target.value = ''
    showUploadDialog.value = true
  }
}

async function confirmUpload() {
  if (!selectedFile.value) return
  uploading.value = true
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('related_project_id', route.params.id)
  if (uploadStage.value) {
    formData.append('related_stage', uploadStage.value)
  }
  try {
    await uploadFile(formData)
    message.success('上传成功')
    showUploadDialog.value = false
    selectedFile.value = null
    selectedFileName.value = ''
    uploadStage.value = null
    await loadProject()
  } catch (e) {
    const msg = e.response?.data?.error || e.message || '未知错误'
    message.error('上传失败: ' + msg)
  } finally {
    uploading.value = false
  }
}

onMounted(() => {
  loadProject()
})
</script>
