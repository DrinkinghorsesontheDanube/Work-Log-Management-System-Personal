export function nowIso() {
  return new Date().toISOString()
}

export function createId(prefix = '') {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return prefix ? `${prefix}_${id}` : id
}

export function createEntity<T extends object>(data: T, prefix = '') {
  const timestamp = nowIso()
  return {
    ...data,
    id: createId(prefix),
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function touchEntity<T extends object>(entity: T, updates: Partial<T>) {
  return {
    ...entity,
    ...updates,
    updatedAt: nowIso()
  }
}
