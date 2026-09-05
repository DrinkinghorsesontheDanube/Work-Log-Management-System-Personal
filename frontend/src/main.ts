import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import naive from 'naive-ui'
import App from './App.vue'
import './style.css'

// 在应用挂载前应用保存的主题，避免闪白
if (localStorage.getItem('worklog_theme') === 'dark') {
  document.documentElement.dataset.theme = 'dark'
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(naive)

app.mount('#app')
