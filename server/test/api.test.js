import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(SERVER_DIR, '..')
const PORT = 4579
const BASE = `http://127.0.0.1:${PORT}`
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'worklog-api-test-'))

let child
let cookie = ''
let password = ''

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return
    } catch {
      // 尚未就绪
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('服务器未在超时时间内就绪')
}

before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  child.stdout.on('data', (d) => (stdout += d.toString()))
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))
  await waitForHealth()
  // 首次启动自动生成密码（打印在启动日志中）
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const m = stdout.match(/ACCESS PASSWORD: (\S+)/)
    if (m) {
      password = m[1]
      break
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.ok(password, '启动日志中应包含自动生成的访问密码')
})

function api(method, pathname, body, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders }
  return fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function authed(method, pathname, body) {
  return api(method, pathname, body, { Cookie: cookie })
}

after(async () => {
  child?.kill()
  await new Promise((r) => setTimeout(r, 300))
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
})

test('健康检查无需认证', async () => {
  const res = await api('GET', '/api/health')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.ok, true)
})

test('未登录访问数据接口返回 401', async () => {
  const res = await api('GET', '/api/state')
  assert.equal(res.status, 401)
})

test('错误密码 401，正确密码发放会话', async () => {
  const bad = await api('POST', '/api/auth/login', { password: 'definitely-wrong' })
  assert.equal(bad.status, 401)

  const good = await api('POST', '/api/auth/login', { password })
  assert.equal(good.status, 200)
  const setCookie = good.headers.get('set-cookie')
  assert.ok(setCookie?.includes('wl_session='))
  assert.ok(setCookie.includes('HttpOnly'))
  cookie = setCookie.split(';')[0]
})

test('初始状态为空集合且未播种', async () => {
  const res = await authed('GET', '/api/state')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.collections.todos.length, 0)
  assert.equal(data.settings.meta.seeded, false)
})

test('全量替换集合（PUT）', async () => {
  const todos = [
    { id: 't1', title: '任务一', status: 'pending' },
    { id: 't2', title: '任务二', status: 'pending' },
  ]
  const put = await authed('PUT', '/api/collections/todos', todos)
  assert.equal(put.status, 200)
  const state = await (await authed('GET', '/api/state')).json()
  assert.equal(state.collections.todos.length, 2)
})

test('按实体增量变更：新增、修改、删除互不干扰', async () => {
  // upsert 修改 t1、新增 t3，并删除 t2 —— 不影响其他设备可能新增的数据
  const changes = await authed('POST', '/api/collections/todos/changes', {
    upserts: [
      { id: 't1', title: '任务一改', status: 'completed' },
      { id: 't3', title: '任务三', status: 'pending' },
    ],
    deletes: ['t2'],
  })
  assert.equal(changes.status, 200)
  const state = await (await authed('GET', '/api/state')).json()
  const todos = state.collections.todos
  assert.equal(todos.length, 2)
  const t1 = todos.find((t) => t.id === 't1')
  assert.equal(t1.title, '任务一改')
  assert.equal(t1.status, 'completed')
  assert.ok(todos.find((t) => t.id === 't3'))
  assert.ok(!todos.find((t) => t.id === 't2'))

  // 增量端点不触碰未提交的 id：模拟其他设备新增 t4，本页再提交不含 t4 的增量
  await authed('POST', '/api/collections/todos/changes', {
    upserts: [{ id: 't4', title: '其他设备的待办' }],
    deletes: [],
  })
  await authed('POST', '/api/collections/todos/changes', {
    upserts: [{ id: 't1', title: '本页再次修改', status: 'in_progress' }],
    deletes: [],
  })
  const after = await (await authed('GET', '/api/state')).json()
  assert.ok(after.collections.todos.find((t) => t.id === 't4'), '其他设备的数据应保留')
  assert.equal(after.collections.todos.find((t) => t.id === 't1').title, '本页再次修改')
})

test('非法集合名与非法请求体被拒绝', async () => {
  assert.equal((await authed('PUT', '/api/collections/hacker', [])).status, 400)
  assert.equal((await authed('POST', '/api/collections/todos/changes', { upserts: 'nope' })).status, 400)
  assert.equal((await authed('PUT', '/api/collections/todos', { not: 'an array' })).status, 400)
})

test('AI 配置：Key 脱敏、留空沿用、清除', async () => {
  const saved = await authed('PUT', '/api/settings/aiProvider', {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKey: 'sk-secret-abc',
    enabled: true,
  })
  assert.equal(saved.status, 200)
  const body = await saved.json()
  assert.equal(body.aiProvider.apiKey, undefined)
  assert.equal(body.aiProvider.hasKey, true)

  // Key 留空 → 沿用已保存的
  const keep = await authed('PUT', '/api/settings/aiProvider', {
    id: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKey: '',
    enabled: true,
  })
  assert.equal((await keep.json()).aiProvider.hasKey, true)

  // state 返回的配置同样不含 Key
  const state = await (await authed('GET', '/api/state')).json()
  assert.equal(state.settings.aiProvider.apiKey, undefined)
  assert.equal(state.settings.aiProvider.hasKey, true)

  // 未配置时可访问 chat，但清除后应报"未配置"
  const cleared = await authed('PUT', '/api/settings/aiProvider', null)
  assert.equal((await cleared.json()).aiProvider, null)
  const chat = await authed('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(chat.status, 400)
  assert.match((await chat.json()).error, /配置 AI 服务/)
})

test('导入备份：整体替换并标记已播种，Key 留空沿用', async () => {
  // 先保存一份带 Key 的配置，导入的备份里 Key 为空串 → 应沿用
  await authed('PUT', '/api/settings/aiProvider', {
    id: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKey: 'sk-inherit-me',
    enabled: true,
  })
  const imp = await authed('POST', '/api/import', {
    projects: [{ id: 'p1', name: '导入的项目' }],
    todos: [],
    workLogs: [],
    clients: [],
    visitRecords: [],
    reports: [],
    planTasks: [],
    aiMessages: [],
    aiProvider: { id: 'deepseek', apiKey: '', baseUrl: 'https://x', model: 'm', enabled: true },
    projectPhases: [{ id: 'initiation', name: '立项', order: 0, color: '#6366f1' }],
  })
  assert.equal(imp.status, 200)
  const state = await (await authed('GET', '/api/state')).json()
  assert.deepEqual(state.collections.projects, [{ id: 'p1', name: '导入的项目' }])
  assert.equal(state.collections.todos.length, 0, '导入应整体替换集合')
  assert.equal(state.settings.meta.seeded, true)
  assert.equal(state.settings.aiProvider.hasKey, true, '导入的空 Key 应沿用已保存的 Key')
})

test('自动备份文件已生成且保留策略生效', async () => {
  const res = await authed('POST', '/api/backup')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.file?.startsWith('worklog-'))
  const backupsDir = path.join(DATA_DIR, 'backups')
  assert.ok(fs.existsSync(path.join(backupsDir, body.file)))
  const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.sqlite'))
  assert.ok(files.length >= 1)
})

test('路径穿越被拦截，未知路径回退 SPA', async () => {
  const traversal = await fetch(`${BASE}/%2e%2e%2fserver%2fserver.js`)
  assert.equal(traversal.status, 403)
  const spa = await fetch(`${BASE}/some/unknown/route`)
  assert.equal(spa.status, 200)
  assert.match(await spa.text(), /<div id="app">|<title>/)
})

test('回收站集合在白名单内且可增量写入', async () => {
  const entry = { id: 'del_1', type: 'todo', deletedAt: '2026-09-05T00:00:00Z', data: { id: 't9', title: '被删的待办' } }
  const res = await authed('POST', '/api/collections/deleted/changes', { upserts: [entry], deletes: [] })
  assert.equal(res.status, 200)
  const state = await (await authed('GET', '/api/state')).json()
  assert.equal(state.collections.deleted.length, 1)
})

test('修改访问密码：旧密码错误 401，新密码过短 400，成功后旧密码失效', async () => {
  const wrongOld = await authed('POST', '/api/auth/change-password', {
    oldPassword: 'wrong-old',
    newPassword: 'new-pass-45678',
  })
  assert.equal(wrongOld.status, 401)

  const tooShort = await authed('POST', '/api/auth/change-password', {
    oldPassword: password,
    newPassword: 'short',
  })
  assert.equal(tooShort.status, 400)

  const ok = await authed('POST', '/api/auth/change-password', {
    oldPassword: password,
    newPassword: 'brand-new-pass-45678',
  })
  assert.equal(ok.status, 200)

  // 旧密码不能再登录，新密码可以
  const oldLogin = await api('POST', '/api/auth/login', { password })
  assert.equal(oldLogin.status, 401)
  const newLogin = await api('POST', '/api/auth/login', { password: 'brand-new-pass-45678' })
  assert.equal(newLogin.status, 200)
})

test('备份列表与备份下载', async () => {
  // 触发一次备份（前面用例已写入数据，不会跳过）
  await authed('POST', '/api/backup')
  const list = await authed('GET', '/api/backups')
  assert.equal(list.status, 200)
  const { backups } = await list.json()
  assert.ok(backups.length >= 1)
  assert.ok(backups[0].file.startsWith('worklog-'))

  const download = await authed('GET', `/api/backups/${backups[0].file}`)
  assert.equal(download.status, 200)
  const buf = Buffer.from(await download.arrayBuffer())
  assert.ok(buf.length > 0)
  // SQLite 文件魔数
  assert.equal(buf.subarray(0, 15).toString('utf8'), 'SQLite format 3')

  const badName = await authed('GET', '/api/backups/..%2Fconfig.json')
  assert.ok([400, 404].includes(badName.status), '非法文件名应被拒绝')
})

test('登出后会话失效', async () => {
  const out = await authed('POST', '/api/auth/logout', {})
  assert.equal(out.status, 200)
  const res = await authed('GET', '/api/state')
  assert.equal(res.status, 401)
})
