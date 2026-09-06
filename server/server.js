import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  openDb,
  getCollection,
  saveCollection,
  applyCollectionChanges,
  backupDb,
  getSetting,
  setSetting,
  pruneSessions,
  createSession,
  getSession,
  deleteSession,
} from './db.js'
import { chatCompletion, testProvider, isProviderConfigured } from './ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'frontend', 'dist')
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data')
const PORT = Number(process.env.PORT) || 4173
const HOST = process.env.HOST || '0.0.0.0'
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000 // 30 天
const BODY_LIMIT = 10 * 1024 * 1024 // 10MB，导入备份的上限

const COLLECTION_NAMES = [
  'projects',
  'todos',
  'workLogs',
  'clients',
  'visitRecords',
  'reports',
  'planTasks',
  'aiMessages',
  'opportunities',
  'deleted',
]

// ---------- 认证配置 ----------

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generatePassword(length = 12) {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length]
  return out
}

/**
 * 密码来源优先级：环境变量 AUTH_PASSWORD > data/config.json。
 * 首次启动且无环境变量时自动生成随机密码：哈希存 config.json，明文只打印一次到控制台。
 */
function ensureAuthConfig() {
  if (process.env.AUTH_PASSWORD) {
    const salt = 'env-static-salt'
    return { salt, hash: sha256(salt + process.env.AUTH_PASSWORD) }
  }
  const cfgPath = path.join(DATA_DIR, 'config.json')
  if (fs.existsSync(cfgPath)) {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
  }
  const password = generatePassword()
  const salt = crypto.randomBytes(16).toString('hex')
  const config = { salt, hash: sha256(salt + password), createdAt: new Date().toISOString() }
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2))
  console.log('========================================================')
  console.log('  First run: generated access password (shown only once)')
  console.log(`  ACCESS PASSWORD: ${password}`)
  console.log(`  访问密码：${password}（只显示这一次，请妥善保存）`)
  console.log(`  配置文件：${cfgPath}`)
  console.log('  修改密码：编辑该文件或设置 AUTH_PASSWORD 环境变量后重启')
  console.log('========================================================')
  return config
}

// ---------- 数据库与状态 ----------

const db = openDb(DATA_DIR)
const authConfig = ensureAuthConfig()
pruneSessions(db)

function stripProvider(provider) {
  if (!provider) return null
  const { apiKey, ...rest } = provider
  return { ...rest, hasKey: !!apiKey }
}

function mergeProvider(body, existing) {
  if (!body || typeof body !== 'object') return null
  const typed = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  // Key 留空表示继续沿用服务端已保存的 Key（浏览器永远拿不到已存的 Key）
  const apiKey = typed || existing?.apiKey || ''
  return {
    id: String(body.id || 'custom'),
    name: String(body.name || ''),
    baseUrl: String(body.baseUrl || ''),
    model: String(body.model || ''),
    enabled: body.enabled !== false,
    apiKey,
  }
}

function buildState() {
  const collections = {}
  for (const name of COLLECTION_NAMES) {
    collections[name] = getCollection(db, name)
  }
  return {
    collections,
    settings: {
      aiProvider: stripProvider(getSetting(db, 'aiProvider')),
      projectPhases: getSetting(db, 'projectPhases'),
      meta: getSetting(db, 'meta') || { seeded: false },
    },
  }
}

function isValidCollectionItem(item) {
  return item && typeof item === 'object' && !Array.isArray(item) && item.id != null
}

function sanitizeCollection(items) {
  if (!Array.isArray(items)) return null
  if (items.length > 200_000) return null
  return items.filter(isValidCollectionItem)
}

function applyImport(data) {
  if (!data || typeof data !== 'object') throw new Error('备份文件格式不正确')
  for (const name of COLLECTION_NAMES) {
    if (data[name] !== undefined) {
      const items = sanitizeCollection(data[name])
      if (items === null) throw new Error(`备份中的 ${name} 不是有效的数组`)
      saveCollection(db, name, items)
    }
  }
  if (data.aiProvider !== undefined) {
    setSetting(db, 'aiProvider', mergeProvider(data.aiProvider, getSetting(db, 'aiProvider')))
  }
  if (Array.isArray(data.projectPhases)) {
    setSetting(db, 'projectPhases', data.projectPhases)
  }
  const meta = getSetting(db, 'meta') || {}
  meta.seeded = true
  setSetting(db, 'meta', meta)
}

// ---------- 自动备份 ----------

function isDbEmpty() {
  return COLLECTION_NAMES.every((name) => getCollection(db, name).length === 0)
}

function runBackup() {
  if (isDbEmpty()) return null
  return backupDb(db, DATA_DIR)
}

// ---------- HTTP 基础设施 ----------

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  res.end(body)
}

function readBody(req, limit = BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('JSON 解析失败'))
      }
    })
    req.on('error', reject)
  })
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const cookies = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx > 0) cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return cookies
}

function getSessionToken(req) {
  const cookies = parseCookies(req)
  if (cookies.wl_session) return cookies.wl_session
  const auth = req.headers.authorization || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  return null
}

function isSecureRequest(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https'
}

function sessionCookie(token, maxAgeSeconds, secure) {
  const parts = [
    `wl_session=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

// 登录限流：每 IP 每 5 分钟最多 10 次尝试
const loginAttempts = new Map()
function isLoginRateLimited(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 })
    return false
  }
  entry.count++
  return entry.count > 10
}

function requireAuth(req) {
  const token = getSessionToken(req)
  if (!token) return null
  const session = getSession(db, token)
  return session ? token : null
}

// ---------- API 路由 ----------

async function handleApi(req, res, pathname) {
  // —— 无需认证 ——
  if (pathname === '/api/health' && req.method === 'GET') {
    const meta = getSetting(db, 'meta') || {}
    return sendJson(res, 200, { ok: true, seeded: !!meta.seeded, time: new Date().toISOString() })
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || 'unknown'
    if (isLoginRateLimited(ip)) {
      return sendJson(res, 429, { error: '尝试次数过多，请 5 分钟后再试' })
    }
    const body = await readBody(req, 64 * 1024)
    const password = typeof body.password === 'string' ? body.password : ''
    if (sha256(authConfig.salt + password) !== authConfig.hash) {
      console.log(`[auth] 登录失败 ip=${ip}`)
      return sendJson(res, 401, { error: '密码错误' })
    }
    pruneSessions(db)
    const token = crypto.randomBytes(32).toString('hex')
    createSession(db, token, SESSION_TTL)
    console.log(`[auth] 登录成功 ip=${ip}`)
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': sessionCookie(token, Math.floor(SESSION_TTL / 1000), isSecureRequest(req)),
    })
  }

  if (pathname === '/api/auth/change-password' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || 'unknown'
    if (isLoginRateLimited(ip)) {
      return sendJson(res, 429, { error: '尝试次数过多，请稍后再试' })
    }
    if (process.env.AUTH_PASSWORD) {
      return sendJson(res, 400, {
        error: '当前密码由环境变量 AUTH_PASSWORD 管理，请在服务器上修改环境变量后重启',
      })
    }
    const body = await readBody(req)
    const oldPwd = typeof body.oldPassword === 'string' ? body.oldPassword : ''
    const newPwd = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (sha256(authConfig.salt + oldPwd) !== authConfig.hash) {
      console.log(`[auth] 修改密码失败（旧密码错误）ip=${ip}`)
      return sendJson(res, 401, { error: '当前密码不正确' })
    }
    if (newPwd.length < 8) {
      return sendJson(res, 400, { error: '新密码至少 8 位' })
    }
    const salt = crypto.randomBytes(16).toString('hex')
    const config = {
      salt,
      hash: sha256(salt + newPwd),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(DATA_DIR, 'config.json'), JSON.stringify(config, null, 2))
    authConfig.salt = config.salt
    authConfig.hash = config.hash
    // 其他设备/浏览器的会话全部失效，当前会话保留
    const currentToken = getSessionToken(req)
    if (currentToken) {
      db.prepare('DELETE FROM sessions WHERE token != ?').run(currentToken)
    }
    console.log(`[auth] 访问密码已修改 ip=${ip}`)
    return sendJson(res, 200, { ok: true })
  }

  if (pathname === '/api/auth/change-password' && req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' })
  }

  // —— 以下需要认证 ——
  if (!requireAuth(req)) {
    return sendJson(res, 401, { error: '未登录或会话已过期' })
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJson(res, 200, buildState())
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = getSessionToken(req)
    if (token) deleteSession(db, token)
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0, isSecureRequest(req)) })
  }

  const collectionMatch = pathname.match(/^\/api\/collections\/([\w]+)$/)
  if (collectionMatch && req.method === 'PUT') {
    const name = collectionMatch[1]
    if (!COLLECTION_NAMES.includes(name)) {
      return sendJson(res, 400, { error: `未知集合: ${name}` })
    }
    const body = await readBody(req)
    const items = sanitizeCollection(body)
    if (items === null) {
      return sendJson(res, 400, { error: '请求体必须是对象数组' })
    }
    saveCollection(db, name, items)
    return sendJson(res, 200, { ok: true, count: items.length })
  }

  // 按实体增量变更：多设备并发编辑时只触碰自己提交的 id，互不覆盖
  const changeMatch = pathname.match(/^\/api\/collections\/([\w]+)\/changes$/)
  if (changeMatch && req.method === 'POST') {
    const name = changeMatch[1]
    if (!COLLECTION_NAMES.includes(name)) {
      return sendJson(res, 400, { error: `未知集合: ${name}` })
    }
    const body = await readBody(req)
    if (
      (body.upserts !== undefined && !Array.isArray(body.upserts)) ||
      (body.deletes !== undefined && !Array.isArray(body.deletes))
    ) {
      return sendJson(res, 400, { error: 'upserts/deletes 必须是数组' })
    }
    const upserts = (body.upserts ?? []).filter(isValidCollectionItem).slice(0, 5000)
    const deletes = (body.deletes ?? [])
      .filter((id) => typeof id === 'string')
      .slice(0, 5000)
    applyCollectionChanges(db, name, upserts, deletes)
    return sendJson(res, 200, { ok: true, upserts: upserts.length, deletes: deletes.length })
  }

  if (pathname === '/api/settings/aiProvider' && req.method === 'PUT') {
    const body = await readBody(req)
    const provider = body === null ? null : mergeProvider(body.provider ?? body, getSetting(db, 'aiProvider'))
    setSetting(db, 'aiProvider', provider)
    return sendJson(res, 200, { ok: true, aiProvider: stripProvider(provider) })
  }

  if (pathname === '/api/settings/projectPhases' && req.method === 'PUT') {
    const body = await readBody(req)
    if (!Array.isArray(body.phases ?? body)) {
      return sendJson(res, 400, { error: 'projectPhases 必须是数组' })
    }
    setSetting(db, 'projectPhases', body.phases ?? body)
    return sendJson(res, 200, { ok: true })
  }

  if (pathname === '/api/settings/meta' && req.method === 'PUT') {
    const body = await readBody(req)
    const meta = getSetting(db, 'meta') || {}
    if (typeof body.seeded === 'boolean') meta.seeded = body.seeded
    if (typeof body.seededWith === 'string') meta.seededWith = body.seededWith
    setSetting(db, 'meta', meta)
    return sendJson(res, 200, { ok: true, meta })
  }

  if (pathname === '/api/import' && req.method === 'POST') {
    const body = await readBody(req)
    // 导入前先备份当前数据，导错了可以回滚
    try {
      runBackup()
    } catch (e) {
      console.error('[backup] 导入前备份失败:', e instanceof Error ? e.message : e)
    }
    applyImport(body)
    console.log('[import] 备份数据已导入')
    return sendJson(res, 200, { ok: true })
  }

  if (pathname === '/api/backup' && req.method === 'POST') {
    const file = runBackup()
    if (!file) return sendJson(res, 200, { ok: true, skipped: '数据库为空，无需备份' })
    console.log(`[backup] 手动备份: ${path.basename(file)}`)
    return sendJson(res, 200, { ok: true, file: path.basename(file) })
  }

  const BACKUP_FILE_RE = /^worklog-[\w-]+\.sqlite$/
  if (pathname === '/api/backups' && req.method === 'GET') {
    const dir = path.join(DATA_DIR, 'backups')
    let backups = []
    if (fs.existsSync(dir)) {
      backups = fs
        .readdirSync(dir)
        .filter((f) => BACKUP_FILE_RE.test(f))
        .map((f) => {
          const st = fs.statSync(path.join(dir, f))
          return { file: f, sizeBytes: st.size, mtime: st.mtime.toISOString() }
        })
        .sort((a, b) => b.file.localeCompare(a.file))
    }
    return sendJson(res, 200, { backups })
  }

  const backupFileMatch = pathname.match(/^\/api\/backups\/([\w.-]+)$/)
  if (backupFileMatch && req.method === 'GET') {
    const file = backupFileMatch[1]
    if (!BACKUP_FILE_RE.test(file)) {
      return sendJson(res, 400, { error: '非法文件名' })
    }
    const filePath = path.join(DATA_DIR, 'backups', file)
    if (!fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: '备份文件不存在' })
    }
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file}"`,
      'Cache-Control': 'no-store',
    })
    fs.createReadStream(filePath).pipe(res)
    return
  }

  if (pathname === '/api/ai/chat' && req.method === 'POST') {
    const provider = getSetting(db, 'aiProvider')
    if (!isProviderConfigured(provider)) {
      return sendJson(res, 400, { error: '请先在设置中配置 AI 服务' })
    }
    const body = await readBody(req)
    if (!Array.isArray(body.messages)) {
      return sendJson(res, 400, { error: 'messages 必须是数组' })
    }
    try {
      const content = await chatCompletion(provider, body.messages, { withSystemPrompt: true })
      return sendJson(res, 200, { content })
    } catch (e) {
      return sendJson(res, 502, { error: e instanceof Error ? e.message : 'AI 请求失败' })
    }
  }

  if (pathname === '/api/ai/test' && req.method === 'POST') {
    const body = await readBody(req)
    const existing = getSetting(db, 'aiProvider')
    const provider = mergeProvider(body.provider ?? body, existing)
    if (!provider.baseUrl || !provider.model) {
      return sendJson(res, 400, { error: 'API 地址和模型名称不能为空' })
    }
    if (!provider.apiKey) {
      return sendJson(res, 400, { error: 'API Key 不能为空' })
    }
    return sendJson(res, 200, await testProvider(provider))
  }

  return sendJson(res, 404, { error: '接口不存在' })
}

// ---------- 静态资源 ----------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))
  const filePath = path.normalize(path.join(DIST, relative))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    return res.end('Forbidden')
  }

  const serveIndex = () => {
    fs.readFile(path.join(DIST, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
        return res.end('前端尚未构建：请先在 frontend/ 目录执行 npm run build')
      }
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'], 'Cache-Control': 'no-cache' })
      res.end(data)
    })
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return serveIndex() // SPA 回退
    const ext = path.extname(filePath).toLowerCase()
    // Vite 构建产物文件名带哈希，可以长缓存；其余不缓存
    const cacheControl = relative.startsWith('assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache'
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Cache-Control': cacheControl })
    res.end(data)
  })
}

// ---------- 服务器 ----------

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname)
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(res, pathname)
    } else {
      sendJson(res, 405, { error: 'Method Not Allowed' })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '服务器内部错误'
    console.error(`[error] ${req.method} ${pathname}:`, message)
    if (!res.headersSent) {
      sendJson(res, /请求体过大|JSON 解析失败/.test(message) ? 400 : 500, { error: message })
    } else {
      res.end()
    }
  }
})

server.listen(PORT, HOST, () => {
  console.log(`工作日志服务器已启动: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
  console.log(`  数据目录: ${DATA_DIR}`)
  console.log(`  前端目录: ${DIST}`)
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('  ⚠ 尚未检测到前端构建产物，请先执行: cd frontend && npm run build')
  }
  if (!process.env.AUTH_PASSWORD && !fs.existsSync(path.join(DATA_DIR, 'config.json'))) {
    // ensureAuthConfig 已经打印过密码
  }
  // 启动即做一次备份，之后每 24 小时一次（数据为空时自动跳过）
  try {
    const file = runBackup()
    if (file) console.log(`[backup] 启动备份: ${path.basename(file)}`)
  } catch (e) {
    console.error('[backup] 失败:', e instanceof Error ? e.message : e)
  }
  setInterval(() => {
    try {
      runBackup()
    } catch (e) {
      console.error('[backup] 失败:', e instanceof Error ? e.message : e)
    }
  }, 24 * 60 * 60 * 1000).unref()
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n收到 ${signal}，正在关闭...`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}
