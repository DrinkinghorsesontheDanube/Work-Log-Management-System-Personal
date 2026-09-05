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
// 迁移是按 id 合并：即使服务器已被其他设备先播种演示数据甚至录入了新内容，
// 旧数据迁移也只会新增/覆盖同 id 条目，不会删掉服务器上已有的其他数据。
//
// 重要：无论初始化/迁移是否出错，守卫都必须放行导航——否则首次导航被中断，
// router-view 会渲染空白（侧边栏正常、内容区空白）。失败只记录，稍后自动补同步。
const MIGRATED_FLAG = 'worklog_migrated_v2'

router.beforeEach(async () => {
  try {
    await ensureInit()
  } catch (e) {
    if (authRequired.value) return false // 未登录，由登录组件接管
    // 服务器不可达：进入离线模式（内存运行），页面照常展示
    console.error('[init] 服务器不可达，进入离线模式:', e)
  }
  try {
    const legacy = readLegacyData()
    const alreadyMigrated = localStorage.getItem(MIGRATED_FLAG) === '1'
    if (needsSeed.value) {
      if (legacy) {
        storage.mergeLegacyData(legacy)
        localStorage.setItem(MIGRATED_FLAG, '1')
        await flush()
        await markSeeded('legacy')
      } else {
        seedAllData()
        await flush()
        await markSeeded('demo')
      }
    } else if (legacy && !alreadyMigrated && seededWith.value === 'demo') {
      // 服务器只有演示数据，本机有真实旧数据：合并迁移
      storage.mergeLegacyData(legacy)
      localStorage.setItem(MIGRATED_FLAG, '1')
      await flush()
      await markSeeded('legacy')
    }
  } catch (e) {
    console.error('[init] 数据迁移失败（不影响页面展示，稍后自动补同步）:', e)
    const w = window as unknown as { __initErrors?: string[] }
    w.__initErrors = [...(w.__initErrors || []), String((e as Error)?.message || e)]
  }
  return true
})

// 导航错误只记录，避免静默失败难以排查
router.onError((e) => {
  console.error('[router] 导航错误:', e)
  const w = window as unknown as { __routerErrors?: string[] }
  w.__routerErrors = [...(w.__routerErrors || []), String((e as Error)?.message || e)]
})

export default router
