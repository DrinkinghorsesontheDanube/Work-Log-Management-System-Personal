import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Opportunity } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'
import { addDaysStr } from '../utils/date'

export const useOpportunitiesStore = defineStore('opportunities', () => {
  const opportunities = ref<Opportunity[]>([])

  function loadOpportunities() {
    opportunities.value = storage.getOpportunities()
  }

  function saveOpportunities() {
    storage.saveOpportunities(opportunities.value)
  }

  function addOpportunity(data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>) {
    const item: Opportunity = createEntity(data, 'opp')
    opportunities.value.push(item)
    saveOpportunities()
    return item
  }

  function updateOpportunity(id: string, updates: Partial<Opportunity>) {
    const idx = opportunities.value.findIndex((o) => o.id === id)
    if (idx !== -1) {
      opportunities.value[idx] = touchEntity(opportunities.value[idx], updates)
      saveOpportunities()
    }
  }

  /** 删除（移入回收站） */
  function removeOpportunity(id: string) {
    const item = opportunities.value.find((o) => o.id === id)
    if (item) storage.trash('opportunity', item)
    opportunities.value = opportunities.value.filter((o) => o.id !== id)
    saveOpportunities()
  }

  const activeOpportunities = computed(() =>
    opportunities.value.filter((o) => o.stage !== 'won' && o.stage !== 'lost'),
  )

  /** 未来 N 天内递交截止的活跃商机（含已逾期），按截止日升序 */
  function deadlinesWithin(days: number) {
    const endStr = addDaysStr(days)
    return activeOpportunities.value
      .filter((o) => o.bidDeadline && o.bidDeadline <= endStr)
      .sort((a, b) => (a.bidDeadline || '').localeCompare(b.bidDeadline || ''))
  }

  /** 中标率：中标 / (中标 + 落标) */
  const winRate = computed(() => {
    const won = opportunities.value.filter((o) => o.stage === 'won').length
    const lost = opportunities.value.filter((o) => o.stage === 'lost').length
    const decided = won + lost
    return decided === 0 ? null : Math.round((won / decided) * 100)
  })

  return {
    opportunities,
    loadOpportunities,
    addOpportunity,
    updateOpportunity,
    removeOpportunity,
    activeOpportunities,
    deadlinesWithin,
    winRate,
  }
})
