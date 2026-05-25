
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project } from '../types'
import { storage } from '../utils/storage'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])

  function loadProjects() {
    projects.value = storage.getProjects()
  }

  function saveProjects() {
    storage.saveProjects(projects.value)
  }

  function addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
    const newProject: Project = {
      ...project,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    projects.value.push(newProject)
    saveProjects()
    return newProject
  }

  function updateProject(id: string, updates: Partial<Project>) {
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = {
        ...projects.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      saveProjects()
    }
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id)
    saveProjects()
  }

  const inProgressProjects = computed(() => 
    projects.value.filter(p => p.status === 'in_progress')
  )

  const completedProjects = computed(() => 
    projects.value.filter(p => p.status === 'completed')
  )

  return {
    projects,
    loadProjects,
    addProject,
    updateProject,
    deleteProject,
    inProgressProjects,
    completedProjects
  }
})
