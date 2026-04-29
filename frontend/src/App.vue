<template>
  <n-config-provider :theme="naiveTheme" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <router-view />
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { zhCN, dateZhCN } from 'naive-ui'
import { darkTheme } from 'naive-ui'

const darkMode = ref(false)
const naiveTheme = computed(() => darkMode.value ? darkTheme : null)

const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark') {
  darkMode.value = true
}

provide('darkMode', darkMode)
provide('toggleTheme', () => {
  darkMode.value = !darkMode.value
  localStorage.setItem('theme', darkMode.value ? 'dark' : 'light')
})
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#app {
  min-height: 100vh;
}

.n-config-provider {
  height: 100%;
}
</style>
