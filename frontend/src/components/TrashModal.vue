<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storage, type DeletedEntry, type DeletedType } from '../utils/storage'
import { message } from '../utils/notify'

const visible = defineModel<boolean>({ default: false })

const RETENTION_DAYS = 30

const TYPE_LABELS: Record<DeletedType, string> = {
  todo: '待办',
  workLog: '日志',
  client: '客户',
  project: '项目',
  visit: '拜访记录',
  report: '报告',
  planTask: '计划任务',
  opportunity: '商机',
}

const entries = ref<DeletedEntry[]>([])

function refresh() {
  entries.value = storage.getDeleted()
}

watch(visible, (v) => {
  if (v) refresh()
})

const items = computed(() =>
  entries.value.map((e) => {
    const data = e.data as Record<string, unknown>
    const title =
      (typeof data?.title === 'string' && data.title) ||
      (typeof data?.name === 'string' && data.name) ||
      (typeof data?.content === 'string' && data.content.slice(0, 40)) ||
      String(data?.id ?? '')
    const daysLeft = Math.max(
      0,
      RETENTION_DAYS - Math.floor((Date.now() - new Date(e.deletedAt).getTime()) / 86400000),
    )
    return { ...e, typeLabel: TYPE_LABELS[e.type] || e.type, title, daysLeft }
  }),
)

function restore(entry: DeletedEntry) {
  if (storage.restoreDeleted(entry.id)) {
    message.success('已恢复')
    refresh()
  } else {
    message.error('恢复失败')
  }
}

function purge(entry: DeletedEntry) {
  if (confirm('彻底删除后无法恢复，确定吗？')) {
    storage.purgeDeleted(entry.id)
    refresh()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="tm-mask" @click.self="visible = false">
      <div class="tm-card">
        <div class="tm-title">回收站</div>
        <p class="tm-hint">删除的项目/日志/待办/客户等在此保留 {{ RETENTION_DAYS }} 天后自动清除。</p>
        <div class="tm-list">
          <div v-if="items.length === 0" class="tm-empty">回收站是空的</div>
          <div v-for="e in items" :key="e.id" class="tm-item">
            <span class="tm-type">{{ e.typeLabel }}</span>
            <span class="tm-name" :title="e.title">{{ e.title }}</span>
            <span class="tm-days">{{ e.daysLeft }} 天后清除</span>
            <button class="tm-btn" @click="restore(e)">恢复</button>
            <button class="tm-btn tm-danger" @click="purge(e)">彻底删除</button>
          </div>
        </div>
        <div class="tm-footer">
          <button class="tm-close" @click="visible = false">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tm-mask {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
}
.tm-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 16px;
  padding: 24px;
  width: 560px; max-width: 94vw; max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);
}
.tm-title { font-size: 16px; font-weight: 600; color: var(--text-1, #0f172a); }
.tm-hint { font-size: 12px; color: var(--text-4, #94a3b8); margin: 6px 0 14px; }
.tm-list { overflow-y: auto; flex: 1; min-height: 80px; }
.tm-empty { text-align: center; color: var(--text-4, #94a3b8); font-size: 13px; padding: 32px 0; }
.tm-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 8px; font-size: 13px;
}
.tm-item:hover { background: var(--bg-hover, #f1f5f9); }
.tm-type {
  flex-shrink: 0; font-size: 11px; padding: 2px 8px; border-radius: 10px;
  background: var(--primary-light, #eef2ff); color: var(--primary-dark, #4f46e5);
}
.tm-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-1, #0f172a); }
.tm-days { flex-shrink: 0; font-size: 11px; color: var(--text-4, #94a3b8); }
.tm-btn {
  flex-shrink: 0; padding: 4px 10px; border-radius: 6px; font-size: 12px;
  border: 1px solid var(--border, #e2e8f0); background: var(--bg-card, #fff);
  color: var(--text-2, #475569); cursor: pointer;
}
.tm-btn:hover { border-color: #0d9488; color: #0d9488; }
.tm-danger:hover { border-color: #ef4444; color: #ef4444; }
.tm-footer { display: flex; justify-content: flex-end; padding-top: 12px; }
.tm-close {
  padding: 8px 20px; border-radius: 8px; font-size: 13px;
  border: 1px solid var(--border-light, #e2e8f0); background: var(--bg-hover, #f1f5f9);
  color: var(--text-2, #475569); cursor: pointer;
}
</style>
