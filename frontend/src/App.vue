<script setup lang="ts">
import { ref, watch, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NMessageProvider } from 'naive-ui'
import AiConfigPrompt from './components/AiConfigPrompt.vue'
import {
  HomeOutline,
  CalendarOutline,
  FolderOpenOutline,
  CheckboxOutline,
  PeopleOutline,
  SettingsOutline
} from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()
const activeKey = ref(route.path)
const sidebarOpen = ref(false)
const aiPromptRef = ref<InstanceType<typeof AiConfigPrompt>>()

provide('showAiConfigPrompt', () => {
  aiPromptRef.value?.show()
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
  { label: '客户', key: '/clients', icon: PeopleOutline },
  { label: '待办', key: '/todos', icon: CheckboxOutline },
  { label: '设置', key: '/settings', icon: SettingsOutline }
]

function navigate(key: string) {
  activeKey.value = key
  router.push(key)
}
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
            <span class="brand-name">WorkLog</span>
            <span class="brand-sub">工作日志管理</span>
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
          <span class="footer-text">v1.0.0</span>
        </div>
      </aside>

      <main class="main">
        <div class="mobile-header">
          <button class="menu-btn" @click="sidebarOpen = !sidebarOpen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span class="mobile-title">WorkLog</span>
        </div>
        <router-view />
      </main>
    </div>
    <AiConfigPrompt ref="aiPromptRef" />
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
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-sub {
  color: var(--text-4);
  font-size: 11px;
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
  font-size: 13.5px;
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
}

.footer-text {
  font-size: 11px;
  color: var(--text-4);
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
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }
  .main { padding: 16px; }
}
</style>
