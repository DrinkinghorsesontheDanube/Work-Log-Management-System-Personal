import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, ProjectPhase } from '../types'
import { DEFAULT_PHASES } from '../types'
import { storage } from '../utils/storage'
import { createEntity, touchEntity } from '../utils/entity'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const phases = ref<ProjectPhase[]>([])

  function loadProjects() {
    projects.value = storage.getProjects().map((p: any) => ({
      clientLeaderId: null, clientExecutorId: null, phaseIds: [], ...p
    }))
  }

  function saveProjects() {
    storage.saveProjects(projects.value)
  }

  function loadPhases() {
    phases.value = storage.getProjectPhases()
  }

  function savePhases() {
    storage.saveProjectPhases(phases.value)
  }

  function addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
    const newProject: Project = createEntity(project, 'project')
    projects.value.push(newProject)
    saveProjects()
    return newProject
  }

  function updateProject(id: string, updates: Partial<Project>) {
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = touchEntity(projects.value[index], updates)
      saveProjects()
    }
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id)
    saveProjects()
  }

  function getProjectById(id: string) {
    return projects.value.find(p => p.id === id)
  }

  function findProjectByName(name: string) {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return undefined
    return projects.value.find(project => {
      const projectName = project.name.trim().toLowerCase()
      return projectName === normalized || projectName.includes(normalized) || normalized.includes(projectName)
    })
  }

  function ensureProject(input: Partial<Project> & { name: string }) {
    const existing = findProjectByName(input.name)
    if (existing) return existing

    return addProject({
      name: input.name,
      description: input.description || '',
      progress: input.progress ?? 0,
      startDate: input.startDate || new Date().toISOString().split('T')[0],
      endDate: input.endDate || '',
      status: input.status || 'planning',
      currentPhaseId: input.currentPhaseId || phases.value[0]?.id || 'initiation',
      phaseHistory: input.phaseHistory || [],
      clientId: input.clientId || null,
      budget: input.budget ?? 0,
      manager: input.manager || ''
    })
  }

  function changePhase(projectId: string, newPhaseId: string, note: string = '') {
    const project = getProjectById(projectId)
    if (!project) return

    const history = [...(project.phaseHistory || [])]
    const currentRecord = history.find(r => r.phaseId === project.currentPhaseId && !r.endDate)
    if (currentRecord) {
      currentRecord.endDate = new Date().toISOString().split('T')[0]
    }

    history.push({
      phaseId: newPhaseId,
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      note
    })

    updateProject(projectId, {
      currentPhaseId: newPhaseId,
      phaseHistory: history
    })
  }

  function addPhase(name: string, color: string) {
    const maxOrder = phases.value.reduce((max, p) => Math.max(max, p.order), -1)
    const newPhase: ProjectPhase = {
      id: `custom_${Date.now()}`,
      name,
      order: maxOrder + 1,
      color
    }
    phases.value.push(newPhase)
    savePhases()
    return newPhase
  }

  function updatePhase(id: string, updates: Partial<ProjectPhase>) {
    const index = phases.value.findIndex(p => p.id === id)
    if (index !== -1) {
      phases.value[index] = { ...phases.value[index], ...updates }
      savePhases()
    }
  }

  function deletePhase(id: string) {
    phases.value = phases.value.filter(p => p.id !== id)
    savePhases()
  }

  function resetPhases() {
    phases.value = [...DEFAULT_PHASES]
    savePhases()
  }

  const inProgressProjects = computed(() =>
    projects.value.filter(p => p.status === 'in_progress')
  )

  const completedProjects = computed(() =>
    projects.value.filter(p => p.status === 'completed')
  )

  return {
    projects,
    phases,
    loadProjects,
    addProject,
    updateProject,
    deleteProject,
    getProjectById,
    findProjectByName,
    ensureProject,
    changePhase,
    loadPhases,
    addPhase,
    updatePhase,
    deletePhase,
    resetPhases,
    inProgressProjects,
    completedProjects
  }
})
