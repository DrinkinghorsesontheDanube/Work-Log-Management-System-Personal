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

/**
 * 按实体应用增量变更（upsert + delete）。
 * 只触碰客户端明确提交的 id，其他设备新增/修改的行不受影响——这是多设备
 * 并发编辑不互相覆盖的关键。
 */
export function applyCollectionChanges(db, name, upserts, deletes) {
  const updateStmt = db.prepare('UPDATE collections SET data = ? WHERE name = ? AND id = ?')
  const insertStmt = db.prepare('INSERT INTO collections (name, id, seq, data) VALUES (?, ?, ?, ?)')
  const deleteStmt = db.prepare('DELETE FROM collections WHERE name = ? AND id = ?')
  const maxSeq = () =>
    db.prepare('SELECT COALESCE(MAX(seq), -1) AS m FROM collections WHERE name = ?').get(name).m
  db.exec('BEGIN')
  try {
    let nextSeq = maxSeq() + 1
    for (const item of upserts) {
      const id = String(item.id)
      const data = JSON.stringify(item)
      const result = updateStmt.run(data, name, id)
      if (result.changes === 0) {
        insertStmt.run(name, id, nextSeq++, data)
      }
    }
    for (const id of deletes) {
      deleteStmt.run(name, id)
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
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

/**
 * 一致性备份：VACUUM INTO 生成快照（WAL 模式下也能拿到完整一致状态），
 * 保留最近 keep 份，删除更旧的。
 */
export function backupDb(db, dataDir, keep = 14) {
  const dir = path.join(dataDir, 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = path.join(dir, `worklog-${stamp}.sqlite`)
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('worklog-') && f.endsWith('.sqlite'))
    .map((f) => ({ file: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  for (const old of files.slice(keep)) {
    fs.rmSync(path.join(dir, old.file), { force: true })
  }
  return target
}
