import { createRouter, createWebHistory } from 'vue-router'
import {
  ensureInit,
  flush,
  markSeeded,
  needsSeed,
  seededWith,
  authRequired,
  storage,
} from '../utils/storage'
import { readLegacyData } from '../utils/legacyMigration'
import { seedAllData } from '../utils/seedData'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
  },
  {
    path: '/calendar',
    name: 'Calendar',
    component: () => import('../views/Calendar.vue'),
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/Projects.vue'),
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetail.vue'),
  },
  {
    path: '/todos',
    name: 'Todos',
    component: () => import('../views/Todos.vue'),
  },
  {
    path: '/clients',
    name: 'Clients',
    component: () => import('../views/Clients.vue'),
  },
  {
    path: '/clients/:id',
    name: 'ClientDetail',
    component: () => import('../views/ClientDetail.vue'),
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 全局初始化：进任何路由前先从服务器拉取数据。
// 数据来源优先级：本浏览器 localStorage 的旧版数据（无缝升级）> 服务器已有数据 > 演示数据。
// 即使服务器已被其他设备先播种了演示数据，只要本机有旧数据且从未迁移过，仍会用真实数据覆盖。
const MIGRATED_FLAG = 'worklog_migrated_v2'

router.beforeEach(async () => {
  try {
    await ensureInit()
  } catch {
    if (authRequired.value) return false // 未登录，由登录组件接管
    // 服务器不可达：进入离线模式（内存运行），页面照常展示
  }
  const legacy = readLegacyData()
  const alreadyMigrated = localStorage.getItem(MIGRATED_FLAG) === '1'
  if (needsSeed.value) {
    if (legacy) {
      storage.importAllData(legacy)
      localStorage.setItem(MIGRATED_FLAG, '1')
      await flush()
      await markSeeded('legacy')
    } else {
      seedAllData()
      await flush()
      await markSeeded('demo')
    }
  } else if (legacy && !alreadyMigrated && seededWith.value === 'demo') {
    // 服务器只有演示数据，本机有真实旧数据：覆盖迁移
    storage.importAllData(legacy)
    localStorage.setItem(MIGRATED_FLAG, '1')
    await flush()
    await markSeeded('legacy')
  }
  return true
})

export default router
