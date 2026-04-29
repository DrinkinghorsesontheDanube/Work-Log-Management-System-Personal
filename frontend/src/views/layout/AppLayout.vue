<template>
  <n-layout position="absolute" style="height: 100vh">
    <n-layout-header bordered style="height: 60px; display: flex; align-items: center; padding: 0 20px;">
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <n-gradient-text type="info" style="font-size: 20px; font-weight: bold; cursor: pointer;" @click="router.push('/')">
          📋 工作日志
        </n-gradient-text>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary circle size="small" @click="toggleTheme">
              <template #icon>
                <n-icon size="18">{{ darkMode ? '☀️' : '🌙' }}</n-icon>
              </template>
            </n-button>
          </template>
          {{ darkMode ? '切换亮色' : '切换暗色' }}
        </n-tooltip>
      </div>
    </n-layout-header>

    <n-layout has-sider position="absolute" style="top: 60px; bottom: 0;">
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="200"
        :collapsed="collapsed"
        show-trigger="arrow-circle"
        @collapse="collapsed = true"
        @expand="collapsed = false"
        style="padding-top: 8px;"
      >
        <n-menu
          :value="activeKey"
          :collapsed="collapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
          @update:value="handleMenuSelect"
        />
      </n-layout-sider>

      <n-layout-content
        style="padding: 20px; overflow-y: auto;"
        :content-style="{ maxWidth: '1200px', margin: '0 auto' }"
      >
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup>
import { h, ref, computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NIcon } from 'naive-ui'
import { 
  TodayOutline, 
  CalendarOutline, 
  FolderOpenOutline, 
  BarChartOutline,
  SettingsOutline 
} from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const darkMode = inject('darkMode')
const toggleTheme = inject('toggleTheme')

const activeKey = computed(() => route.path === '/' ? '/dashboard' : route.path)

const menuOptions = [
  {
    label: '今日工作台',
    key: '/dashboard',
    icon: () => h(NIcon, null, { default: () => h(TodayOutline) })
  },
  {
    label: '日志日历',
    key: '/calendar',
    icon: () => h(NIcon, null, { default: () => h(CalendarOutline) })
  },
  {
    label: '项目管理',
    key: '/projects',
    icon: () => h(NIcon, null, { default: () => h(FolderOpenOutline) })
  },
  {
    label: '统计报表',
    key: '/stats',
    icon: () => h(NIcon, null, { default: () => h(BarChartOutline) })
  },
  {
    label: '设置',
    key: '/settings',
    icon: () => h(NIcon, null, { default: () => h(SettingsOutline) })
  }
]

function handleMenuSelect(key) {
  router.push(key)
}
</script>
