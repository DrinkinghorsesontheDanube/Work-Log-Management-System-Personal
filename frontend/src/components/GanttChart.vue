<script setup lang="ts">
import { computed } from 'vue'
import type { PlanTask } from '../types'

const props = defineProps<{
  tasks: PlanTask[]
}>()

const statusColors: Record<string, string> = {
  pending: '#94a3b8',
  in_progress: '#22c55e',
  completed: '#3b82f6'
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diffDays(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

function isValidDateStr(s: string | undefined | null): boolean {
  return !!s && !Number.isNaN(new Date(s + 'T00:00:00').getTime())
}

/** 日期缺失/非法时的兜底（自动生成的阶段任务 endDate 可能为空串，否则会算出 NaN 让整个图崩塌） */
function effectiveStartDate(t: PlanTask): string {
  return isValidDateStr(t.startDate) ? t.startDate : fmt(new Date())
}

function effectiveEndDate(t: PlanTask): string {
  if (isValidDateStr(t.endDate)) return t.endDate
  return fmt(new Date())
}

const timeline = computed(() => {
  const tasks = props.tasks
  if (tasks.length === 0) return { start: fmt(new Date()), days: 30, dates: [] as string[] }

  let minDate = effectiveStartDate(tasks[0])
  let maxDate = effectiveEndDate(tasks[0])
  for (const t of tasks) {
    const s = effectiveStartDate(t)
    const e = effectiveEndDate(t)
    if (s < minDate) minDate = s
    if (e > maxDate) maxDate = e
    if (t.actualStartDate && isValidDateStr(t.actualStartDate) && t.actualStartDate < minDate) minDate = t.actualStartDate
    if (t.actualEndDate && isValidDateStr(t.actualEndDate) && t.actualEndDate > maxDate) maxDate = t.actualEndDate
  }

  const padStart = new Date(minDate + 'T00:00:00')
  padStart.setDate(padStart.getDate() - 3)
  const padEnd = new Date(maxDate + 'T00:00:00')
  padEnd.setDate(padEnd.getDate() + 5)

  const start = fmt(padStart)
  const totalDays = diffDays(start, fmt(padEnd)) + 1
  const dates: string[] = []
  const d = new Date(padStart)
  for (let i = 0; i < totalDays; i++) {
    dates.push(fmt(d))
    d.setDate(d.getDate() + 1)
  }

  return { start, days: totalDays, dates }
})

const dayWidth = 28

function barStyle(task: PlanTask) {
  const offset = diffDays(timeline.value.start, effectiveStartDate(task))
  const span = Math.max(1, diffDays(effectiveStartDate(task), effectiveEndDate(task)) + 1)
  return {
    left: (offset * dayWidth) + 'px',
    width: (span * dayWidth) + 'px',
    background: statusColors[task.status] || '#94a3b8'
  }
}

function progressStyle(task: PlanTask) {
  return { width: task.progress + '%' }
}

function actualBarStyle(task: PlanTask): Record<string, string> | null {
  if (!task.actualStartDate) return null
  const end = task.actualEndDate || fmt(new Date())
  const offset = diffDays(timeline.value.start, task.actualStartDate)
  const span = diffDays(task.actualStartDate, end) + 1
  return {
    left: (offset * dayWidth) + 'px',
    width: (span * dayWidth) + 'px'
  }
}

const monthHeaders = computed(() => {
  const headers: { label: string; span: number }[] = []
  let current = ''
  let count = 0
  for (const date of timeline.value.dates) {
    const ym = date.slice(0, 7)
    if (ym !== current) {
      if (current) headers.push({ label: current, span: count })
      current = ym
      count = 1
    } else {
      count++
    }
  }
  if (current) headers.push({ label: current, span: count })
  return headers
})
</script>

<template>
  <div class="gantt-wrap" v-if="tasks.length > 0">
    <div class="gantt-table">
      <div class="gantt-sidebar">
        <div class="sidebar-header">任务名称</div>
        <div v-for="task in tasks" :key="task.id" class="sidebar-task">
          <span :class="['status-dot', task.status]"></span>
          <span class="task-name">{{ task.name }}</span>
        </div>
      </div>
      <div class="gantt-timeline">
        <div class="timeline-header">
          <div class="month-row">
            <div v-for="(m, i) in monthHeaders" :key="i" class="month-cell" :style="{ width: m.span * dayWidth + 'px' }">
              {{ m.label }}
            </div>
          </div>
          <div class="day-row">
            <div v-for="d in timeline.dates" :key="d" class="day-cell" :style="{ width: dayWidth + 'px' }">
              {{ d.slice(8) }}
            </div>
          </div>
        </div>
        <div class="timeline-body">
          <div v-for="task in tasks" :key="task.id" class="bar-row">
            <div class="bar-bg" :style="{ width: timeline.dates.length * dayWidth + 'px' }">
              <div v-for="d in timeline.dates" :key="d" class="day-grid" :style="{ left: diffDays(timeline.start, d) * dayWidth + 'px', width: dayWidth + 'px' }"></div>
            </div>
            <div class="bar" :style="barStyle(task)">
              <div class="bar-progress" :style="progressStyle(task)"></div>
              <span class="bar-label">{{ task.progress }}%</span>
            </div>
            <div v-if="actualBarStyle(task)" class="bar-actual" :style="actualBarStyle(task)"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="card-empty" style="padding: 30px">暂无计划任务</div>
</template>

<style scoped>
.gantt-wrap { overflow: auto; border: 1px solid var(--border-light); border-radius: var(--radius-sm); height: 100%; }
.gantt-table { display: flex; min-width: fit-content; }
.gantt-sidebar { flex-shrink: 0; width: 140px; border-right: 1px solid var(--border); position: sticky; left: 0; z-index: 2; background: var(--bg-card); }
.sidebar-header {
  height: 52px; display: flex; align-items: center; padding: 0 10px;
  font-size: 13px; font-weight: 600; color: var(--text-muted);
  background: var(--bg); border-bottom: 1px solid var(--border);
}
.sidebar-task {
  height: 40px; display: flex; align-items: center; gap: 6px; padding: 0 10px;
  border-bottom: 1px solid var(--border-light); font-size: 13px;
}
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.pending { background: #94a3b8; }
.status-dot.in_progress { background: #22c55e; }
.status-dot.completed { background: #3b82f6; }
.task-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.gantt-timeline { flex: 1; overflow-x: visible; }
.timeline-header { background: var(--bg); border-bottom: 1px solid var(--border); }
.month-row { display: flex; }
.month-cell {
  height: 26px; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  border-right: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light);
}
.day-row { display: flex; }
.day-cell {
  height: 26px; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--text-muted);
  border-right: 1px solid var(--border-light);
}
.timeline-body { position: relative; }
.bar-row { position: relative; height: 40px; border-bottom: 1px solid var(--border-light); }
.bar-bg { position: absolute; top: 0; left: 0; height: 100%; }
.day-grid { position: absolute; top: 0; height: 100%; border-right: 1px solid var(--border-light); }
.bar {
  position: absolute; top: 8px; height: 24px; border-radius: 4px;
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.bar-progress {
  position: absolute; top: 0; left: 0; height: 100%;
  background: rgba(255, 255, 255, 0.25); border-radius: 4px 0 0 4px;
}
.bar-label { position: relative; font-size: 12px; font-weight: 600; color: #fff; z-index: 1; }
.bar-actual {
  position: absolute; top: 14px; height: 12px; border-radius: 3px;
  background: rgba(251, 146, 60, 0.7); pointer-events: none;
}
</style>
