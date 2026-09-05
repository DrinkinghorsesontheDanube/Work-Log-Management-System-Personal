<script setup lang="ts">
import type { WorkCategoryId } from '../types'

withDefaults(defineProps<{
  id: WorkCategoryId
  size?: number
}>(), { size: 14 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 客户拜访：人 -->
    <template v-if="id === 'client_visit'">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </template>

    <!-- 方案编写：文档 -->
    <template v-else-if="id === 'solution'">
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M9.5 12h5M9.5 15.5h5" />
    </template>

    <!-- 招投标：标书夹 -->
    <template v-else-if="id === 'bidding'">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a3 3 0 0 1 6 0" />
      <path d="M9 11.5l2 2 4-4" />
    </template>

    <!-- 技术交流：对话气泡 -->
    <template v-else-if="id === 'tech_exchange'">
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.9-.9L4 20l1-4.4A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M8.5 10.5h7M8.5 13.5h4" />
    </template>

    <!-- 竞品分析：放大镜 -->
    <template v-else-if="id === 'competitive'">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </template>

    <!-- 需求调研：笔 -->
    <template v-else-if="id === 'requirement'">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </template>

    <!-- 会议纪要：多人 -->
    <template v-else-if="id === 'meeting'">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
      <path d="M17.8 13.8a6.5 6.5 0 0 1 3.7 6.2" />
    </template>

    <!-- 演示汇报：投影幕布 -->
    <template v-else-if="id === 'demo'">
      <path d="M3 4h18" />
      <path d="M5 4v10h14V4" />
      <path d="M12 14v3" />
      <path d="M9 20l3-3 3 3" />
    </template>

    <!-- 培训学习：书本 -->
    <template v-else-if="id === 'training'">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </template>

    <!-- 内部协调：链条 -->
    <template v-else-if="id === 'coordination'">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </template>

    <!-- 审批流程：对勾圆圈 -->
    <template v-else-if="id === 'approval'">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </template>

    <!-- 出差：列车 -->
    <template v-else-if="id === 'travel'">
      <rect x="5" y="3" width="14" height="13" rx="2" />
      <path d="M5 9.5h14" />
      <circle cx="9" cy="12.5" r=".6" fill="currentColor" />
      <circle cx="15" cy="12.5" r=".6" fill="currentColor" />
      <path d="M8.5 20l-3 1.5M15.5 20l3 1.5M8 16.5 7 21m10-4.5 1 4.5" />
    </template>

    <!-- 其他：省略号 -->
    <template v-else>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </template>
  </svg>
</template>
