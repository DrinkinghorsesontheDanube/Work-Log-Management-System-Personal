<template>
  <div>
    <n-gradient-text type="info" style="font-size: 24px; font-weight: bold; display: block; margin-bottom: 16px;">
      设置
    </n-gradient-text>

    <n-tabs type="line" animated>
      <n-tab-pane name="categories" tab="分类管理">
        <n-card :bordered="true" style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong>项目性工作</strong>
            <n-button size="small" @click="addSubCategory('项目性工作')">添加子类</n-button>
          </div>
          <n-space>
            <n-tag
              v-for="(cat, idx) in categories['项目性工作'] || []"
              :key="idx"
              closable
              @close="removeSubCategory('项目性工作', idx)"
              style="margin-bottom: 4px;"
            >
              {{ cat }}
            </n-tag>
          </n-space>
        </n-card>

        <n-card :bordered="true" style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong>事务性工作</strong>
            <n-button size="small" @click="addSubCategory('事务性工作')">添加子类</n-button>
          </div>
          <n-space>
            <n-tag
              v-for="(cat, idx) in categories['事务性工作'] || []"
              :key="idx"
              closable
              @close="removeSubCategory('事务性工作', idx)"
              style="margin-bottom: 4px;"
            >
              {{ cat }}
            </n-tag>
          </n-space>
        </n-card>

        <n-button type="primary" :loading="savingCategories" @click="saveCategories">保存分类</n-button>
      </n-tab-pane>

      <n-tab-pane name="tags" tab="标签管理">
        <n-card :bordered="true">
          <p style="color: #888; margin-bottom: 12px;">事务性工作标签，用逗号分隔</p>
          <n-input v-model:value="tagsStr" type="textarea" :rows="3" />
          <n-button type="primary" style="margin-top: 12px;" :loading="savingTags" @click="saveTags">保存标签</n-button>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="reminder" tab="提醒设置">
        <n-card :bordered="true">
          <n-form label-placement="left" label-width="120">
            <n-form-item label="启用提醒">
              <n-switch v-model:value="reminderEnabled" />
            </n-form-item>
            <n-form-item label="提醒时间">
              <n-time-picker v-model:value="reminderTime" format="HH:mm" />
            </n-form-item>
          </n-form>
          <n-button type="primary" :loading="savingReminder" @click="saveReminder">保存设置</n-button>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="stages" tab="项目阶段">
        <n-card :bordered="true" style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong>项目阶段列表</strong>
            <n-button size="small" @click="showAddStage = true">添加阶段</n-button>
          </div>
          <div v-if="Object.keys(stages).length === 0">
            <n-empty description="暂无阶段" />
          </div>
          <n-list v-else>
            <n-list-item v-for="(label, key, idx) in stages" :key="key">
              <template #prefix>
                <n-tag :type="stageTagType(idx)" size="small" round>{{ idx + 1 }}</n-tag>
              </template>
              <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                <n-input v-model:value="stages[key]" size="small" style="flex: 1;" />
              </div>
              <template #suffix>
                <n-space>
                  <n-button v-if="idx > 0" quaternary circle size="small" @click="moveStage(key, -1)">
                    <template #icon><n-icon><ChevronUpOutline /></n-icon></template>
                  </n-button>
                  <n-button v-if="idx < Object.keys(stages).length - 1" quaternary circle size="small" @click="moveStage(key, 1)">
                    <template #icon><n-icon><ChevronDownOutline /></n-icon></template>
                  </n-button>
                  <n-popconfirm @positive-click="removeStage(key)">
                    <template #trigger>
                      <n-button quaternary circle size="small" type="error">
                        <template #icon><n-icon><TrashOutline /></n-icon></template>
                      </n-button>
                    </template>
                    确认删除阶段「{{ stages[key] }}」？已有项目使用此阶段将无法正确显示。
                  </n-popconfirm>
                </n-space>
              </template>
            </n-list-item>
          </n-list>
          <n-button type="primary" style="margin-top: 12px;" :loading="savingStages" @click="saveStages">保存阶段</n-button>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="backup" tab="数据备份">
        <n-card :bordered="true" style="margin-bottom: 16px;">
          <n-space>
            <n-button type="primary" :loading="backingUp" @click="handleBackup">
              <template #icon><n-icon><CloudDownloadOutline /></n-icon></template>
              一键备份数据库
            </n-button>
          </n-space>
        </n-card>

        <n-card :bordered="true" title="备份列表">
          <n-empty v-if="backups.length === 0" description="暂无备份" />
          <n-list v-else>
            <n-list-item v-for="b in backups" :key="b.name">
              <span>{{ b.name }}</span>
              <template #suffix>
                <n-space size="small">
                  <span style="color: #888; font-size: 13px;">{{ b.time }}</span>
                  <span style="color: #888; font-size: 13px;">({{ formatSize(b.size) }})</span>
                </n-space>
              </template>
            </n-list-item>
          </n-list>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="export" tab="数据导出">
        <n-card :bordered="true">
          <n-form label-placement="top">
            <n-grid :cols="2" :x-gap="16">
              <n-gi>
                <n-form-item label="开始日期">
                  <n-date-picker v-model:value="exportStart" type="date" />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="结束日期">
                  <n-date-picker v-model:value="exportEnd" type="date" />
                </n-form-item>
              </n-gi>
            </n-grid>
            <n-button type="primary" :loading="exporting" @click="handleExport">
              <template #icon><n-icon><DownloadOutline /></n-icon></template>
              导出Excel
            </n-button>
          </n-form>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="about" tab="关于">
        <n-card :bordered="true">
          <n-descriptions :column="1" bordered size="small">
            <n-descriptions-item label="系统名称">解决方案经理个人工作日志系统</n-descriptions-item>
            <n-descriptions-item label="版本号">V1.0</n-descriptions-item>
            <n-descriptions-item label="技术栈">Python Flask + Vue 3 + Naive UI + SQLite</n-descriptions-item>
            <n-descriptions-item label="数据存储">SQLite 数据库（本地文件）</n-descriptions-item>
            <n-descriptions-item label="部署方式">本机直接运行</n-descriptions-item>
          </n-descriptions>
        </n-card>
      </n-tab-pane>
    </n-tabs>

    <n-modal v-model:show="showAddSub" title="添加子分类" preset="card" style="width: 400px;">
      <n-input v-model:value="newSubCategory" placeholder="输入新子分类名称" @keyup.enter="confirmAddSub" />
      <template #footer>
        <n-button type="primary" @click="confirmAddSub">添加</n-button>
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
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { CloudDownloadOutline, DownloadOutline, ChevronUpOutline, TrashOutline } from '@vicons/ionicons5'
import { getCategories, updateCategories, getConfig, updateConfig, createBackup, getBackups, exportExcel as exportExcelApi, getStages, updateStages } from '../api/index.js'
import dayjs from 'dayjs'

const message = useMessage()

const categories = ref({})
const savingCategories = ref(false)
const tagsStr = ref('')
const savingTags = ref(false)
const reminderEnabled = ref(true)
const reminderTime = ref(null)
const savingReminder = ref(false)
const backingUp = ref(false)
const backups = ref([])
const exporting = ref(false)
const exportStart = ref(null)
const exportEnd = ref(null)

const showAddSub = ref(false)
const addTargetCategory = ref('')
const newSubCategory = ref('')

const stages = ref({})
const savingStages = ref(false)
const showAddStage = ref(false)
const newStageKey = ref('')
const newStageLabel = ref('')

async function loadConfig() {
  try {
    const [catRes, configRes] = await Promise.all([
      getCategories(),
      getAllConfig()
    ])
    categories.value = catRes.data || {}
    const config = configRes.data
    tagsStr.value = config.tags || '报销,合同,党务,临时任务,出差,其他'
    reminderEnabled.value = config.reminder_enabled !== 'false'
    if (config.reminder_time) {
      const [h, m] = config.reminder_time.split(':')
      const t = new Date()
      t.setHours(parseInt(h), parseInt(m), 0, 0)
      reminderTime.value = t.getTime()
    }
  } catch (e) {
    console.error(e)
  }
}

async function getAllConfig() {
  return (await import('../api/index.js')).getAllConfig()
}

async function saveCategories() {
  savingCategories.value = true
  try {
    await updateCategories(categories.value)
    message.success('分类已保存')
  } catch (e) {
    message.error('保存失败')
  } finally {
    savingCategories.value = false
  }
}

function addSubCategory(category) {
  addTargetCategory.value = category
  newSubCategory.value = ''
  showAddSub.value = true
}

function confirmAddSub() {
  if (!newSubCategory.value.trim()) return
  if (!categories.value[addTargetCategory.value]) {
    categories.value[addTargetCategory.value] = []
  }
  categories.value[addTargetCategory.value].push(newSubCategory.value.trim())
  showAddSub.value = false
}

function removeSubCategory(category, idx) {
  categories.value[category].splice(idx, 1)
}

async function saveTags() {
  savingTags.value = true
  try {
    await updateConfig({ tags: tagsStr.value })
    message.success('标签已保存')
  } catch (e) {
    message.error('保存失败')
  } finally {
    savingTags.value = false
  }
}

async function saveReminder() {
  savingReminder.value = true
  try {
    const time = reminderTime.value ? dayjs(reminderTime.value).format('HH:mm') : '17:30'
    await updateConfig({
      reminder_enabled: reminderEnabled.value ? 'true' : 'false',
      reminder_time: time
    })
    message.success('提醒设置已保存')
  } catch (e) {
    message.error('保存失败')
  } finally {
    savingReminder.value = false
  }
}

async function handleBackup() {
  backingUp.value = true
  try {
    await createBackup()
    message.success('备份成功')
    await loadBackups()
  } catch (e) {
    message.error('备份失败')
  } finally {
    backingUp.value = false
  }
}

async function loadBackups() {
  try {
    const res = await getBackups()
    backups.value = res.data
  } catch (e) {
    console.error(e)
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

async function handleExport() {
  exporting.value = true
  try {
    const params = {}
    if (exportStart.value) {
      params.start_date = dayjs(exportStart.value).format('YYYY-MM-DD')
    }
    if (exportEnd.value) {
      params.end_date = dayjs(exportEnd.value).format('YYYY-MM-DD')
    }
    const res = await exportExcelApi(params)
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `工作日志_${params.start_date || 'all'}_${params.end_date || 'all'}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (e) {
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

async function loadStages() {
  try {
    const res = await getStages()
    stages.value = res.data || {}
  } catch (e) {
    console.error(e)
  }
}

async function saveStages() {
  savingStages.value = true
  try {
    await updateStages(stages.value)
    message.success('项目阶段已保存')
  } catch (e) {
    message.error('保存失败')
  } finally {
    savingStages.value = false
  }
}

function stageTagType(idx) {
  const types = ['info', 'warning', 'error', 'success', 'default', 'primary']
  return types[idx % types.length]
}

function confirmAddStage() {
  if (!newStageKey.value.trim() || !newStageLabel.value.trim()) return
  if (stages.value[newStageKey.value.trim()]) {
    message.warning('阶段标识已存在，请使用其他标识')
    return
  }
  stages.value[newStageKey.value.trim()] = newStageLabel.value.trim()
  showAddStage.value = false
  newStageKey.value = ''
  newStageLabel.value = ''
}

function removeStage(key) {
  const newStages = {}
  for (const [k, v] of Object.entries(stages.value)) {
    if (k !== key) newStages[k] = v
  }
  stages.value = newStages
}

function moveStage(key, direction) {
  const entries = Object.entries(stages.value)
  const idx = entries.findIndex(([k]) => k === key)
  if (idx === -1) return
  const targetIdx = idx + direction
  if (targetIdx < 0 || targetIdx >= entries.length) return
  const temp = entries[idx]
  entries[idx] = entries[targetIdx]
  entries[targetIdx] = temp
  const newStages = {}
  entries.forEach(([k, v]) => { newStages[k] = v })
  stages.value = newStages
}

onMounted(() => {
  loadConfig()
  loadBackups()
  loadStages()
})
</script>
