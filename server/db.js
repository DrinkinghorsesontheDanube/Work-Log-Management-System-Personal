import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * SQLite 存储层（Node 24+ 内置 node:sqlite，零外部依赖）。
 * - collections 表：8 个业务集合，每行 (name, id, seq, data JSON)，seq 保证数组顺序
 * - settings 表：aiProvider / projectPhases / meta 等配置
 * - sessions 表：登录会话
 */
export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(path.join(dataDir, 'worklog.sqlite'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS collections (
      name TEXT NOT NULL,
      id TEXT NOT NULL,
      seq INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      PRIMARY KEY (name, id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `)
  return db
}

export function getCollection(db, name) {
  return db
    .prepare('SELECT data FROM collections WHERE name = ? ORDER BY seq')
    .all(name)
    .map((row) => JSON.parse(row.data))
}

export function saveCollection(db, name, items) {
  const insert = db.prepare(
    'INSERT OR REPLACE INTO collections (name, id, seq, data) VALUES (?, ?, ?, ?)',
  )
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM collections WHERE name = ?').run(name)
    items.forEach((item, i) => {
      insert.run(name, String(item.id), i, JSON.stringify(item))
    })
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function getSetting(db, name) {
  const row = db.prepare('SELECT data FROM settings WHERE name = ?').get(name)
  return row ? JSON.parse(row.data) : null
}

export function setSetting(db, name, value) {
  db.prepare('INSERT OR REPLACE INTO settings (name, data) VALUES (?, ?)').run(
    name,
    JSON.stringify(value),
  )
}

export function pruneSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
}

export function createSession(db, token, ttlMs) {
  db.prepare('INSERT OR REPLACE INTO sessions (token, expires_at) VALUES (?, ?)').run(
    token,
    Date.now() + ttlMs,
  )
}

export function getSession(db, token) {
  const row = db.prepare('SELECT token, expires_at FROM sessions WHERE token = ?').get(token)
  if (!row) return null
  if (row.expires_at < Date.now()) {
    deleteSession(db, token)
    return null
  }
  return row
}

export function deleteSession(db, token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}
