<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NLayout, NLayoutSider, NMenu } from 'naive-ui'

const router = useRouter()
const route = useRoute()
const activeKey = ref(route.path)

const menuOptions = [
  { label: '工作台', key: '/' },
  { label: '日历视图', key: '/calendar' },
  { label: '项目管理', key: '/projects' },
  { label: '待办事项', key: '/todos' },
  { label: 'AI 助手', key: '/ai-assistant' },
  { label: '设置', key: '/settings' }
]

function handleMenuUpdate(key) {
  activeKey.value = key
  router.push(key)
}
</script>

<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider bordered :width="240">
      <div style="padding: 20px; text-align: center; font-size: 18px; font-weight: bold; color: #1890ff">
        工作日志系统
      </div>
      <n-menu :options="menuOptions" :value="activeKey" @update:value="handleMenuUpdate" />
    </n-layout-sider>
    <n-layout style="background: #f0f2f5; padding: 24px; overflow-y: auto">
      <router-view />
    </n-layout>
  </n-layout>
</template>