<script setup lang="ts">
import { ref, watch } from 'vue'
import { storage } from '../utils/storage'
import { message } from '../utils/notify'

interface BackupItem {
  file: string
  sizeBytes: number
  mtime: string
}

const visible = defineModel<boolean>({ default: false })

const backups = ref<BackupItem[]>([])
const loading = ref(false)

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function formatTime(mtime: string): string {
  return mtime.replace('T', ' ').slice(0, 19)
}

async function refresh() {
  loading.value = true
  try {
    backups.value = await storage.listBackups()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '获取备份列表失败')
  } finally {
    loading.value = false
  }
}

watch(visible, (v) => {
  if (v) void refresh()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="bm-mask" @click.self="visible = false">
      <div class="bm-card">
        <div class="bm-title-row">
          <span class="bm-title">数据备份</span>
          <button class="bm-refresh" :disabled="loading" @click="refresh">
            {{ loading ? '加载中...' : '刷新' }}
          </button>
        </div>
        <p class="bm-hint">
          服务器在每次启动、每天、每次导入前自动备份（保留最近 14 份）。点击文件名即可下载保存。
        </p>
        <div class="bm-list">
          <div v-if="!loading && backups.length === 0" class="bm-empty">暂无备份文件</div>
          <a
            v-for="b in backups"
            :key="b.file"
            class="bm-item"
            :href="`/api/backups/${b.file}`"
            :download="b.file"
          >
            <span class="bm-file">{{ b.file }}</span>
            <span class="bm-meta">{{ formatTime(b.mtime) }}</span>
            <span class="bm-meta">{{ formatSize(b.sizeBytes) }}</span>
            <span class="bm-dl">下载</span>
          </a>
        </div>
        <div class="bm-footer">
          <button class="bm-close" @click="visible = false">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.bm-mask {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
}
.bm-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 16px;
  padding: 24px;
  width: 560px; max-width: 94vw; max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);
}
.bm-title-row { display: flex; align-items: center; justify-content: space-between; }
.bm-title { font-size: 16px; font-weight: 600; color: var(--text-1, #0f172a); }
.bm-refresh {
  padding: 5px 14px; border-radius: 8px; font-size: 12px; cursor: pointer;
  border: 1px solid var(--border, #e2e8f0); background: var(--bg-card, #fff);
  color: var(--text-2, #475569);
}
.bm-refresh:hover:not(:disabled) { border-color: #0d9488; color: #0d9488; }
.bm-hint { font-size: 12px; color: var(--text-4, #94a3b8); line-height: 1.6; margin: 6px 0 14px; }
.bm-list { overflow-y: auto; flex: 1; min-height: 80px; }
.bm-empty { text-align: center; color: var(--text-4, #94a3b8); font-size: 13px; padding: 32px 0; }
.bm-item {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 10px; border-radius: 8px; font-size: 12.5px;
  text-decoration: none; color: var(--text-1, #0f172a);
}
.bm-item:hover { background: var(--bg-hover, #f1f5f9); }
.bm-file { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
.bm-meta { flex-shrink: 0; color: var(--text-4, #94a3b8); }
.bm-dl { flex-shrink: 0; color: #0d9488; font-weight: 500; }
.bm-footer { display: flex; justify-content: flex-end; padding-top: 12px; }
.bm-close {
  padding: 8px 20px; border-radius: 8px; font-size: 13px;
  border: 1px solid var(--border-light, #e2e8f0); background: var(--bg-hover, #f1f5f9);
  color: var(--text-2, #475569); cursor: pointer;
}
</style>
