/**
 * 教材生成检查点的本地存储仓库。
 *
 * 使用独立的教材身份 key 保存多个检查点，避免切换教材时静默覆盖另一教材的未保存草稿。
 * 该模块不依赖 Vue，便于测试迁移、隔离和存储失败等数据保护行为。
 */
export interface CheckpointIdentity {
  key: string
}

export interface CheckpointTimestamp {
  updatedAt: number
}

export interface CheckpointStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function readCheckpointCollection<T extends CheckpointIdentity>(
  storage: CheckpointStorage,
  collectionStorageKey: string,
  legacyStorageKey: string,
): Record<string, T> {
  let collection: Record<string, T> = {}
  try {
    const raw = storage.getItem(collectionStorageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      collection = parsed as Record<string, T>
    }
  } catch {
    // A malformed collection must not prevent recovery of the legacy checkpoint.
  }

  try {
    const legacyRaw = storage.getItem(legacyStorageKey)
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as T
      if (legacy && typeof legacy.key === 'string' && legacy.key && !collection[legacy.key]) {
        collection[legacy.key] = legacy
      }
      // Remove the old single-checkpoint record only after the migrated collection is safely written.
      storage.setItem(collectionStorageKey, JSON.stringify(collection))
      storage.removeItem(legacyStorageKey)
    }
  } catch {
    // Keep the legacy record when migration cannot be persisted; the caller can still read it in memory.
  }

  return collection
}

export function getCheckpointByKey<T extends CheckpointIdentity>(
  collection: Record<string, T>,
  key: string,
): T | null {
  return collection[key] || null
}

export function getLatestCheckpoint<T extends CheckpointIdentity & CheckpointTimestamp>(
  collection: Record<string, T>,
): T | null {
  return Object.values(collection).sort((a, b) => b.updatedAt - a.updatedAt)[0] || null
}

export function persistCheckpoint<T extends CheckpointIdentity>(
  storage: CheckpointStorage,
  collectionStorageKey: string,
  legacyStorageKey: string,
  checkpoint: T,
): boolean {
  const collection = readCheckpointCollection<T>(storage, collectionStorageKey, legacyStorageKey)
  collection[checkpoint.key] = checkpoint
  try {
    storage.setItem(collectionStorageKey, JSON.stringify(collection))
    storage.removeItem(legacyStorageKey)
    return true
  } catch {
    return false
  }
}

export function deleteCheckpoint(
  storage: CheckpointStorage,
  collectionStorageKey: string,
  legacyStorageKey: string,
  key: string,
): boolean {
  const collection = readCheckpointCollection<CheckpointIdentity>(storage, collectionStorageKey, legacyStorageKey)
  if (!collection[key]) return true
  delete collection[key]
  try {
    storage.setItem(collectionStorageKey, JSON.stringify(collection))
    storage.removeItem(legacyStorageKey)
    return true
  } catch {
    return false
  }
}
