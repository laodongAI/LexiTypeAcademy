import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCheckpointByKey,
  getLatestCheckpoint,
  persistCheckpoint,
  readCheckpointCollection,
  type CheckpointStorage,
} from './textbookGenerationCheckpointStore.ts'

class MemoryStorage implements CheckpointStorage {
  readonly values = new Map<string, string>()
  failWrites = false

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('quota exceeded')
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

interface Checkpoint {
  key: string
  updatedAt: number
  lessons: string[]
}

const collectionKey = 'checkpoint_collection_v2'
const legacyKey = 'textbook_generation_checkpoint_v1'

test('不同教材的检查点分别保存，不会互相覆盖', () => {
  const storage = new MemoryStorage()
  assert.equal(persistCheckpoint(storage, collectionKey, legacyKey, { key: 'publisher|series|G1|Book A', updatedAt: 10, lessons: ['A'] }), true)
  assert.equal(persistCheckpoint(storage, collectionKey, legacyKey, { key: 'publisher|series|G2|Book B', updatedAt: 20, lessons: ['B'] }), true)

  const collection = readCheckpointCollection<Checkpoint>(storage, collectionKey, legacyKey)
  assert.deepEqual(getCheckpointByKey(collection, 'publisher|series|G1|Book A')?.lessons, ['A'])
  assert.deepEqual(getCheckpointByKey(collection, 'publisher|series|G2|Book B')?.lessons, ['B'])
  assert.equal(getLatestCheckpoint(collection)?.key, 'publisher|series|G2|Book B')
})

test('旧版单检查点迁移成功后才删除旧记录', () => {
  const storage = new MemoryStorage()
  const legacy: Checkpoint = { key: 'legacy-book-key', updatedAt: 30, lessons: ['saved draft'] }
  storage.values.set(legacyKey, JSON.stringify(legacy))

  const collection = readCheckpointCollection<Checkpoint>(storage, collectionKey, legacyKey)
  assert.deepEqual(collection['legacy-book-key'], legacy)
  assert.equal(storage.getItem(legacyKey), null)
  assert.deepEqual(JSON.parse(storage.getItem(collectionKey) || '{}')['legacy-book-key'], legacy)
})

test('迁移写入失败时保留旧记录，避免静默丢失', () => {
  const storage = new MemoryStorage()
  storage.values.set(legacyKey, JSON.stringify({ key: 'legacy-book-key', updatedAt: 30, lessons: ['saved draft'] }))
  storage.failWrites = true

  const collection = readCheckpointCollection<Checkpoint>(storage, collectionKey, legacyKey)
  assert.deepEqual(collection['legacy-book-key']?.lessons, ['saved draft'])
  assert.notEqual(storage.getItem(legacyKey), null)
})

test('检查点集合损坏时仍可从有效的旧版检查点恢复', () => {
  const storage = new MemoryStorage()
  storage.values.set(collectionKey, '{broken json')
  storage.values.set(legacyKey, JSON.stringify({ key: 'legacy-book-key', updatedAt: 30, lessons: ['saved draft'] }))

  const collection = readCheckpointCollection<Checkpoint>(storage, collectionKey, legacyKey)
  assert.deepEqual(collection['legacy-book-key']?.lessons, ['saved draft'])
})

test('存储写入失败返回 false，不伪装为已保存', () => {
  const storage = new MemoryStorage()
  storage.failWrites = true
  assert.equal(persistCheckpoint(storage, collectionKey, legacyKey, { key: 'book', updatedAt: 1, lessons: ['draft'] }), false)
})
