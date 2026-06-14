
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import naive from 'naive-ui'
import App from './App.vue'
import { seedAllData } from './utils/seedData'
import './style.css'

if (!localStorage.getItem('worklog_seeded_v4')) {
  seedAllData()
  localStorage.setItem('worklog_seeded_v4', '1')
  localStorage.removeItem('worklog_seeded_v3')
  localStorage.removeItem('worklog_seeded_v2')
  localStorage.removeItem('worklog_seeded')
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(naive)

app.mount('#app')
