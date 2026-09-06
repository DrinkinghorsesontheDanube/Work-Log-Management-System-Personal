<script setup lang="ts">
import { ref, watch, provide, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NMessageProvider } from 'naive-ui'
import AiConfigPrompt from './components/AiConfigPrompt.vue'
import AiSettingsModal from './components/AiSettingsModal.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import LoginOverlay from './components/LoginOverlay.vue'
import PasswordModal from './components/PasswordModal.vue'
import TrashModal from './components/TrashModal.vue'
import BackupsModal from './components/BackupsModal.vue'
import { storage, authRequired, serverOnline, flush, logout } from './utils/storage'
import { message } from './utils/notify'
import { seedAllData } from './utils/seedData'
import { isDark as themeIsDark, applyTheme } from './utils/theme'
import {
  HomeOutline,
  CalendarOutline,
  FolderOpenOutline,
  CheckboxOutline,
  PeopleOutline,
  TrendingUpOutline
} from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()
const activeKey = ref(route.path)
const sidebarOpen = ref(false)
const aiPromptRef = ref<InstanceType<typeof AiConfigPrompt>>()
const aiSettingsRef = ref<InstanceType<typeof AiSettingsModal>>()
const passwordModalVisible = ref(false)
const trashModalVisible = ref(false)
const backupsModalVisible = ref(false)
const settingsMenuOpen = ref(false)
const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmDanger = ref(false)
const confirmText = ref('确定')
let confirmResolve: ((v: boolean) => void) | null = null

function showConfirm(title: string, message: string, danger = false, okText = '确定'): Promise<boolean> {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmDanger.value = danger
  confirmText.value = okText
  confirmVisible.value = true
  return new Promise(resolve => { confirmResolve = resolve })
}
function onConfirmOk() { confirmVisible.value = false; confirmResolve?.(true) }
function onConfirmCancel() { confirmVisible.value = false; confirmResolve?.(false) }

provide('showAiConfigPrompt', () => {
  aiPromptRef.value?.show()
})

provide('showAiSettingsModal', () => {
  aiSettingsRef.value?.show()
})

watch(() => route.path, (path) => {
  sidebarOpen.value = false
  if (path.startsWith('/projects')) {
    activeKey.value = '/projects'
  } else {
    activeKey.value = path
  }
})

const menuItems = [
  { label: '工作台', key: '/', icon: HomeOutline },
  { label: '日历', key: '/calendar', icon: CalendarOutline },
  { label: '项目', key: '/projects', icon: FolderOpenOutline },
  { label: '商机', key: '/opportunities', icon: TrendingUpOutline },
  { label: '客户', key: '/clients', icon: PeopleOutline },
  { label: '待办', key: '/todos', icon: CheckboxOutline }
]

function navigate(key: string) {
  activeKey.value = key
  router.push(key)
}

function toggleSettingsMenu(e: Event) {
  e.stopPropagation()
  settingsMenuOpen.value = !settingsMenuOpen.value
}

function closeSettingsMenu() {
  settingsMenuOpen.value = false
}

function openAiSettings() {
  closeSettingsMenu()
  aiSettingsRef.value?.show()
}

function exportData() {
  closeSettingsMenu()
  const dataStr = storage.exportAllData()
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `工作日志备份_${new Date().toLocaleDateString('zh-CN')}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const fileInputRef = ref<HTMLInputElement | null>(null)
function triggerImport() {
  closeSettingsMenu()
  fileInputRef.value?.click()
}
function importData(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result as string)
      storage.importAllData(data)
      await flush()
      location.reload()
    } catch {
      message.error('导入失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
  target.value = ''
}

async function loadDemoData() {
  closeSettingsMenu()
  const ok = await showConfirm('加载演示数据', '将清除现有数据并加载演示数据，确定继续？', false, '确认加载')
  if (!ok) return
  seedAllData()
  await flush()
  location.reload()
}

async function clearAllData() {
  closeSettingsMenu()
  const ok = await showConfirm('清空所有数据', '此操作不可恢复，确定要清空所有数据吗？', true, '确认清空')
  if (!ok) return
  storage.clearAllData()
  await flush()
  location.reload()
}

async function handleLogout() {
  closeSettingsMenu()
  const ok = await showConfirm('退出登录', '确定要退出当前登录会话吗？退出不会删除任何数据。', false, '退出')
  if (!ok) return
  // 等待未同步的增量推送完成，避免丢失刚录入的数据
  await flush()
  await logout()
  location.reload()
}

// 主题切换
function toggleTheme() {
  applyTheme(!themeIsDark.value)
}

// 登录成功后的整页刷新由 LoginOverlay 自行执行（emit 会在组件卸载后被 Vue 丢弃）

function handleClickOutside(e: Event) {
  const target = e.target as HTMLElement
  if (!target.closest('.settings-menu-wrap')) {
    settingsMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <n-message-provider>
    <div class="layout">
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

      <aside :class="['sidebar', { open: sidebarOpen }]">
        <div class="sidebar-brand">
          <div class="brand-icon">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="8" fill="#0d9488"/>
              <path d="M10 16h12M16 10v12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-name">工作日志</span>
            <span class="brand-sub">个人管理系统</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <button
            v-for="item in menuItems"
            :key="item.key"
            :class="['nav-item', { active: activeKey === item.key }]"
            @click="navigate(item.key)"
          >
            <svg-icon :icon="item.icon" />
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <div class="settings-menu-wrap">
            <button class="settings-trigger" @click="toggleSettingsMenu" title="系统设置">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              <span>系统设置</span>
            </button>
            <Transition name="menu-fade">
              <div v-if="settingsMenuOpen" class="settings-dropdown">
                <button class="dropdown-item" @click="openAiSettings">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4v1a1 1 0 0 0 1 1h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1a1 1 0 0 0-1 1v1a4 4 0 0 1-8 0v-1a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1a1 1 0 0 0 1-1V6a4 4 0 0 1 4-4z"/></svg>
                  AI 服务设置
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" @click="exportData">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  导出数据
                </button>
                <button class="dropdown-item" @click="triggerImport">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  导入数据
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" @click="loadDemoData">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  加载演示数据
                </button>
                <button class="dropdown-item dropdown-danger" @click="clearAllData">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  清空数据
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" @click="passwordModalVisible = true; closeSettingsMenu()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  修改访问密码
                </button>
                <button class="dropdown-item" @click="trashModalVisible = true; closeSettingsMenu()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
                  回收站
                </button>
                <button class="dropdown-item" @click="backupsModalVisible = true; closeSettingsMenu()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                  数据备份
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" @click="handleLogout">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  退出登录
                </button>
              </div>
            </Transition>
          </div>
          <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="importData" />
          <div class="footer-row">
            <button class="theme-toggle" @click="toggleTheme" :title="themeIsDark ? '切换到浅色模式' : '切换到深色模式'">
              <svg v-if="themeIsDark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
            <span class="footer-text">v2.0.0</span>
          </div>
        </div>
      </aside>

      <main class="main">
        <div v-if="!serverOnline && !authRequired" class="offline-banner">
          ⚠ 无法连接服务器，当前处于离线模式，此期间的更改可能无法保存
        </div>
        <div class="mobile-header">
          <button class="menu-btn" @click="sidebarOpen = !sidebarOpen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span class="mobile-title">工作日志</span>
        </div>
        <router-view />
      </main>
    </div>
    <LoginOverlay v-if="authRequired" />
    <PasswordModal v-model="passwordModalVisible" />
    <TrashModal v-model="trashModalVisible" />
    <BackupsModal v-model="backupsModalVisible" />
    <AiConfigPrompt ref="aiPromptRef" />
    <AiSettingsModal ref="aiSettingsRef" />
    <ConfirmModal :visible="confirmVisible" :title="confirmTitle" :message="confirmMessage" :confirm-text="confirmText" :danger="confirmDanger" @confirm="onConfirmOk" @cancel="onConfirmCancel" />
  </n-message-provider>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'
import { NIcon } from 'naive-ui'

const SvgIcon = defineComponent({
  props: { icon: { type: Object, required: true } },
  setup(props) {
    return () => h(NIcon, { size: 18 }, { default: () => h(props.icon) })
  }
})

export default {
  components: { SvgIcon }
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-w);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
}

.brand-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-name {
  color: var(--text-1);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-sub {
  color: var(--text-4);
  font-size: 12px;
  margin-top: 2px;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: var(--r);
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--text-3);
  transition: all var(--t-fast);
  font-family: var(--font);
  width: 100%;
  text-align: left;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-1);
}

.nav-item.active {
  background: var(--primary-light);
  color: var(--primary-dark);
  font-weight: 600;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-menu-wrap {
  position: relative;
}

.settings-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: var(--r-sm);
  color: var(--text-3);
  font-size: 13px;
  font-family: var(--font);
  transition: all var(--t-fast);
}
.settings-trigger:hover {
  background: var(--bg-hover);
  color: var(--text-1);
}

.settings-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  min-width: 180px;
  padding: 4px;
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: var(--r-sm);
  font-size: 14px;
  font-family: var(--font);
  color: var(--text-2);
  transition: all var(--t-fast);
}
.dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--text-1);
}
.dropdown-danger:hover {
  background: var(--rose-bg);
  color: var(--rose);
}

.dropdown-divider {
  height: 1px;
  background: var(--border-light);
  margin: 4px 8px;
}

.menu-fade-enter-active, .menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.menu-fade-enter-from, .menu-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.footer-text {
  font-size: 12px;
  color: var(--text-4);
}

.footer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 6px;
  border: none; background: none; cursor: pointer;
  color: var(--text-3);
  transition: all var(--t-fast);
}
.theme-toggle:hover { background: var(--bg-hover); color: var(--text-1); }

.offline-banner {
  padding: 8px 14px;
  margin-bottom: 16px;
  border-radius: var(--r, 8px);
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 13.5px;
}

.main {
  flex: 1;
  background: var(--bg);
  overflow-y: auto;
  padding: 28px 32px;
  min-width: 0;
}

.mobile-header { display: none; }
.sidebar-overlay { display: none; }

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 1000;
    transform: translateX(-100%);
    box-shadow: var(--shadow-lg);
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar-overlay {
    display: block;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 999;
    backdrop-filter: blur(2px);
  }
  .mobile-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
  }
  .menu-btn {
    background: none; border: none;
    color: var(--text-1); cursor: pointer;
    padding: 6px; border-radius: var(--r-sm);
  }
  .menu-btn:hover { background: var(--bg-hover); }
  .mobile-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }
  .main { padding: 16px; }
}
</style>
