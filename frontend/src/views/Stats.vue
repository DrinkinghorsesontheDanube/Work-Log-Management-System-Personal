<template>
  <div>
    <n-gradient-text type="info" style="font-size: 24px; font-weight: bold; display: block; margin-bottom: 16px;">
      统计报表
    </n-gradient-text>

    <n-card :bordered="true" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <n-radio-group v-model:value="rangeType" @update:value="loadStats">
          <n-radio-button value="week">本周</n-radio-button>
          <n-radio-button value="month">本月</n-radio-button>
          <n-radio-button value="day">今日</n-radio-button>
          <n-radio-button value="custom">自定义</n-radio-button>
        </n-radio-group>

        <n-space v-if="rangeType === 'custom'" align="center">
          <n-date-picker v-model:value="customStart" type="date" @update:value="loadStats" />
          <span>至</span>
          <n-date-picker v-model:value="customEnd" type="date" @update:value="loadStats" />
        </n-space>

        <n-button @click="exportExcel" :loading="exporting">
          <template #icon><n-icon><DownloadOutline /></n-icon></template>
          导出Excel
        </n-button>
      </div>
    </n-card>

    <n-spin :show="loading" style="min-height: 200px;">
      <div v-if="stats">
        <n-grid :cols="4" :x-gap="12" :y-gap="12" style="margin-bottom: 16px;">
          <n-gi>
            <n-card :bordered="true" size="small">
              <n-statistic label="统计周期">
                {{ stats.start_date }} ~ {{ stats.end_date }}
              </n-statistic>
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" size="small">
              <n-statistic label="总工时" :value="stats.total_hours" precision="1">
                <template #suffix> 小时</template>
              </n-statistic>
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" size="small">
              <n-statistic label="记录数" :value="stats.log_count" />
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" size="small">
              <n-statistic label="日均工时" :value="avgDailyHours" precision="1">
                <template #suffix> 小时</template>
              </n-statistic>
            </n-card>
          </n-gi>
        </n-grid>

        <n-grid :cols="2" :x-gap="16" :y-gap="16" style="margin-bottom: 16px;">
          <n-gi>
            <n-card :bordered="true" title="工时分类占比">
              <div ref="pieRef" style="height: 300px;"></div>
              <n-empty v-if="stats.total_minutes === 0" description="暂无数据" style="margin-top: -200px;" />
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" title="项目性 vs 事务性">
              <n-progress
                type="circle"
                :percentage="stats.project_percent"
                :stroke-color="['#2080f0', '#36ad6a']"
                style="display: inline-block; width: 45%;"
              >
                <div style="font-size: 13px;">项目性<br/>{{ stats.project_percent }}%</div>
              </n-progress>
              <n-progress
                type="circle"
                :percentage="stats.transaction_percent"
                :stroke-color="['#f0a020', '#e88080']"
                style="display: inline-block; width: 45%;"
              >
                <div style="font-size: 13px;">事务性<br/>{{ stats.transaction_percent }}%</div>
              </n-progress>
            </n-card>
          </n-gi>
        </n-grid>

        <n-grid :cols="2" :x-gap="16" :y-gap="16" style="margin-bottom: 16px;">
          <n-gi>
            <n-card :bordered="true" title="二级分类工时分布">
              <div ref="barRef" style="height: 300px;"></div>
              <n-empty v-if="stats.total_minutes === 0" description="暂无数据" style="margin-top: -200px;" />
            </n-card>
          </n-gi>
          <n-gi>
            <n-card :bordered="true" title="每日工时趋势">
              <div ref="lineRef" style="height: 300px;"></div>
              <n-empty v-if="stats.total_minutes === 0" description="暂无数据" style="margin-top: -200px;" />
            </n-card>
          </n-gi>
        </n-grid>

        <n-card :bordered="true" title="本周报草稿" style="margin-bottom: 16px;">
          <template #header-extra>
            <n-button size="small" @click="copyReport">
              <template #icon><n-icon><CopyOutline /></n-icon></template>
              复制
            </n-button>
          </template>
          <n-spin :show="loadingReport">
            <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 14px; line-height: 1.8;">{{ weeklyReport || '暂无数据' }}</pre>
          </n-spin>
        </n-card>
      </div>
    </n-spin>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { DownloadOutline, CopyOutline } from '@vicons/ionicons5'
import { getStats, getWeeklyReport, exportExcel as exportExcelApi } from '../api/index.js'
import * as echarts from 'echarts'
import dayjs from 'dayjs'

const message = useMessage()
const loading = ref(false)
const loadingReport = ref(false)
const exporting = ref(false)
const stats = ref(null)
const weeklyReport = ref('')
const rangeType = ref('week')
const customStart = ref(null)
const customEnd = ref(null)

const pieRef = ref(null)
const barRef = ref(null)
const lineRef = ref(null)

let pieChart = null
let barChart = null
let lineChart = null

const avgDailyHours = computed(() => {
  if (!stats.value) return 0
  const days = dayjs(stats.value.end_date).diff(dayjs(stats.value.start_date), 'day') + 1
  return Math.round(stats.value.total_hours / days * 10) / 10
})

async function loadStats() {
  loading.value = true
  try {
    const params = { range: rangeType.value }
    if (rangeType.value === 'custom' && customStart.value && customEnd.value) {
      params.start_date = dayjs(customStart.value).format('YYYY-MM-DD')
      params.end_date = dayjs(customEnd.value).format('YYYY-MM-DD')
    }
    const res = await getStats(params)
    stats.value = res.data

    await nextTick()
    renderCharts()
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadReport() {
  loadingReport.value = true
  try {
    const res = await getWeeklyReport()
    weeklyReport.value = res.data.report
  } catch (e) {
    console.error(e)
  } finally {
    loadingReport.value = false
  }
}

function renderCharts() {
  if (!stats.value) return

  if (pieChart) pieChart.dispose()
  if (barChart) barChart.dispose()
  if (lineChart) lineChart.dispose()

  const theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  const textColor = theme === 'dark' ? '#ccc' : '#666'

  if (pieRef.value) {
    pieChart = echarts.init(pieRef.value)
    const data = (stats.value.category_detail || []).map(d => ({ name: d.name, value: d.minutes }))
    if (data.length > 0) {
      pieChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c}分钟 ({d}%)' },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          data,
          label: { color: textColor },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' }
          }
        }]
      })
    }
  }

  if (barRef.value) {
    barChart = echarts.init(barRef.value)
    const data = (stats.value.sub_category_detail || []).slice(0, 10)
    if (data.length > 0) {
      barChart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}: {c}分钟' },
        grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: textColor } },
        yAxis: {
          type: 'category',
          data: data.map(d => d.name).reverse(),
          axisLabel: { color: textColor, fontSize: 11 }
        },
        series: [{
          type: 'bar',
          data: data.map(d => d.minutes).reverse(),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#2080f0' },
              { offset: 1, color: '#36ad6a' }
            ])
          }
        }]
      })
    }
  }

  if (lineRef.value) {
    lineChart = echarts.init(lineRef.value)
    const data = (stats.value.daily_chart || []).sort((a, b) => a.date.localeCompare(b.date))
    if (data.length > 0) {
      lineChart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}: {c}分钟' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.map(d => d.date.slice(5)),
          axisLabel: { color: textColor }
        },
        yAxis: { type: 'value', axisLabel: { color: textColor } },
        series: [{
          type: 'line',
          data: data.map(d => d.minutes),
          smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(32,128,240,0.3)' },
              { offset: 1, color: 'rgba(32,128,240,0.05)' }
            ])
          },
          itemStyle: { color: '#2080f0' }
        }]
      })
    }
  }
}

function copyReport() {
  if (weeklyReport.value) {
    navigator.clipboard.writeText(weeklyReport.value).then(() => {
      message.success('已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败')
    })
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const params = {}
    if (stats.value) {
      params.start_date = stats.value.start_date
      params.end_date = stats.value.end_date
    }
    const res = await exportExcelApi(params)
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `工作日志_${params.start_date || ''}_${params.end_date || ''}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (e) {
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadStats()
  loadReport()
})

watch(rangeType, () => {
  if (rangeType.value !== 'custom') {
    loadStats()
    if (rangeType.value === 'week') loadReport()
  }
})
</script>
