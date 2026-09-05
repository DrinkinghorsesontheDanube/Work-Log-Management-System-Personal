import { describe, it, expect } from 'vitest'
import { diffOf, mergeById, snapshotOf } from './storage'

/** 构造 lastSynced 快照的便捷方法 */
function syncedOf(...items: unknown[]): Map<string, string> {
  return snapshotOf(items)
}

describe('diffOf（增量同步的核心计算）', () => {
  it('空集合对空快照 → 无任何变更', () => {
    const diff = diffOf([], new Map())
    expect(diff.upserts).toEqual([])
    expect(diff.deletes).toEqual([])
  })

  it('新增条目 → 出现在 upserts', () => {
    const item = { id: 'a', title: '任务A' }
    const diff = diffOf([item], new Map())
    expect(diff.upserts).toEqual([item])
    expect(diff.deletes).toEqual([])
  })

  it('未修改的条目不产生增量', () => {
    const item = { id: 'a', title: '任务A' }
    const diff = diffOf([item], syncedOf(item))
    expect(diff.upserts).toEqual([])
    expect(diff.deletes).toEqual([])
  })

  it('修改条目（内容变化）→ upsert 且携带新内容', () => {
    const old = { id: 'a', title: '任务A', done: false }
    const now = { id: 'a', title: '任务A', done: true }
    const diff = diffOf([now], syncedOf(old))
    expect(diff.upserts).toEqual([now])
    expect(diff.deletes).toEqual([])
  })

  it('删除条目 → 出现在 deletes', () => {
    const old = { id: 'a', title: '任务A' }
    const diff = diffOf([], syncedOf(old))
    expect(diff.upserts).toEqual([])
    expect(diff.deletes).toEqual(['a'])
  })

  it('混合场景：同时新增、修改、删除互不干扰', () => {
    const kept = { id: 'keep', title: '不变' }
    const modified = { id: 'mod', title: '已修改' }
    const added = { id: 'add', title: '新条目' }
    const diff = diffOf([kept, modified, added], syncedOf(kept, { id: 'mod', title: '旧内容' }, { id: 'del', title: '被删除' }))
    expect(diff.upserts).toEqual([modified, added])
    expect(diff.deletes).toEqual(['del'])
  })

  it('字段顺序不同但内容相同的条目不误报为修改', () => {
    const a = { id: 'a', title: 'T', done: true }
    const b = { done: true, title: 'T', id: 'a' }
    const diff = diffOf([b], syncedOf(a))
    expect(diff.upserts).toEqual([])
  })

  it('非对象条目（null/字符串）被安全跳过', () => {
    const valid = { id: 'ok', title: '有效' }
    const diff = diffOf([null, 'garbage', valid], new Map())
    expect(diff.upserts).toEqual([valid])
    expect(diff.deletes).toEqual([])
  })

  it('upserts 的顺序保持集合内原有顺序', () => {
    const i1 = { id: 'b2', title: '新1' }
    const i2 = { id: 'a1', title: '新2' }
    const diff = diffOf([i1, i2], new Map())
    expect(diff.upserts).toEqual([i1, i2])
  })
})

describe('mergeById（旧数据迁移的合并语义）', () => {
  it('同 id 条目以 incoming（旧数据）为准', () => {
    const server = [{ id: '1', title: '服务器版本' }]
    const legacy = [{ id: '1', title: '旧数据版本' }]
    expect(mergeById(server, legacy)).toEqual([{ id: '1', title: '旧数据版本' }])
  })

  it('仅服务器存在的条目原样保留（迁移不丢服务器新数据）', () => {
    const server = [
      { id: '1', title: '服务器已有' },
      { id: '2', title: '服务器新录' },
    ]
    const legacy = [{ id: '1', title: '旧数据版本' }]
    const merged = mergeById(server, legacy)
    expect(merged).toHaveLength(2)
    expect(merged).toContainEqual({ id: '1', title: '旧数据版本' })
    expect(merged).toContainEqual({ id: '2', title: '服务器新录' })
  })

  it('服务器空集合时等于完整迁移', () => {
    const legacy = [{ id: '1', title: '旧1' }, { id: '2', title: '旧2' }]
    expect(mergeById([], legacy)).toEqual(legacy)
  })

  it('非法条目（null/数组/缺 id）被过滤', () => {
    const server = [null, { id: 'ok', title: '有效' }]
    const legacy = ['str', [1, 2], { title: '没有 id' }, { id: 'legacy-ok' }]
    const merged = mergeById(server, legacy)
    expect(merged).toEqual([
      { id: 'ok', title: '有效' },
      { id: 'legacy-ok' },
    ])
  })
})

describe('snapshotOf（同步基线快照）', () => {
  it('为每个条目生成 id -> JSON 的映射', () => {
    const map = snapshotOf([{ id: 'a', title: 'T' }])
    expect(map.get('a')).toBe(JSON.stringify({ id: 'a', title: 'T' }))
  })

  it('跳过非法条目', () => {
    const map = snapshotOf([null, { id: 'ok' }])
    expect(map.size).toBe(1)
    expect(map.has('ok')).toBe(true)
  })
})
