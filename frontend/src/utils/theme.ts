import { ref } from 'vue'

/**
 * 全局主题状态：main.ts 初始化，App.vue 切换，
 * 需要跟随明暗主题的第三方组件（如 naive-ui 弹层）读取此状态。
 */
export const isDark = ref(false)

export function applyTheme(dark: boolean) {
  isDark.value = dark
  document.documentElement.dataset.theme = dark ? 'dark' : ''
  localStorage.setItem('worklog_theme', dark ? 'dark' : 'light')
}

export function initTheme() {
  applyTheme(localStorage.getItem('worklog_theme') === 'dark')
}
