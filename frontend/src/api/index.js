import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export function getLogs(params = {}) {
  return api.get('/log', { params })
}

export function getLog(id) {
  return api.get(`/log/${id}`)
}

export function createLog(data) {
  return api.post('/log', data)
}

export function updateLog(id, data) {
  return api.put(`/log/${id}`, data)
}

export function deleteLog(id) {
  return api.delete(`/log/${id}`)
}

export function getStats(params = {}) {
  return api.get('/stats', { params })
}

export function getWeeklyReport() {
  return api.get('/stats/weekly-report')
}

export function exportExcel(params = {}) {
  return api.get('/export/excel', { params, responseType: 'blob' })
}

export function getProjects() {
  return api.get('/projects')
}

export function getProject(id) {
  return api.get(`/project/${id}`)
}

export function createProject(data) {
  return api.post('/project', data)
}

export function updateProject(id, data) {
  return api.put(`/project/${id}`, data)
}

export function deleteProject(id) {
  return api.delete(`/project/${id}`)
}

export function updateProjectStages(id, data) {
  return api.put(`/project/${id}/stages`, data)
}

export function uploadFile(formData) {
  return api.post('/upload', formData)
}

export function deleteDocument(id) {
  return api.delete(`/document/${id}`)
}

export function getConfig(key) {
  return api.get('/config', { params: { key } })
}

export function getAllConfig() {
  return api.get('/config')
}

export function updateConfig(data) {
  return api.post('/config', data)
}

export function getCategories() {
  return api.get('/categories')
}

export function updateCategories(data) {
  return api.post('/categories', data)
}

export function createBackup() {
  return api.post('/backup')
}

export function getBackups() {
  return api.get('/backup/list')
}

export function getStages() {
  return api.get('/stages')
}

export function updateStages(data) {
  return api.post('/stages', data)
}

export default api
