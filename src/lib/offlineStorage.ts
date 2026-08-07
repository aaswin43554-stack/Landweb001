/**
 * Offline-first database storage layer for the GIZ Land Use Transparency Prototype.
 * Upgraded from localStorage to Dexie-backed IndexedDB for high-capacity offline reliability,
 * allowing local binary uploads, large village parcel polygons caches, and transaction safety.
 */

import Dexie, { type Table } from 'dexie'
import type { Village, Parcel } from './land'

// Custom types for IndexedDB
export type CachedTranslations = Record<string, { lao_text: string; english_text: string; hmong_text: string; khmu_text: string }>

export type QueuedDispute = {
  id: string
  referenceNumber: string
  parcelId: string
  category: string
  note: string
  timestamp: number
  retries: number
  photos?: string[]
  audio?: string | null
}

export type SyncStatus = {
  isOnline: boolean
  lastSync: number | null
  pendingCount: number
  hasCachedData: boolean
}

export type DisputeOverride = {
  id: string
  status: 'submitted' | 'in_review' | 'resolved'
  comment: string
  updatedAt: number
}

export type LocalDisputeEvent = {
  disputeId: string
  fromStatus: string | null
  toStatus: string
  actor: string
  note: string | null
  createdAt: number
}

export interface MetadataRecord {
  key: string
  value: any
}

// Dexie Database definition
class LandDatabase extends Dexie {
  villages!: Table<Village, string>
  parcels!: Table<Parcel, string>
  translations!: Table<{ key: string; lao_text: string; english_text: string; hmong_text: string; khmu_text: string }, string>
  disputeQueue!: Table<QueuedDispute, string>
  disputeOverrides!: Table<DisputeOverride, string>
  disputeEvents!: Table<LocalDisputeEvent, string>
  metadata!: Table<MetadataRecord, string>

  constructor() {
    super('giz-land-db')
    this.version(4).stores({
      villages: 'id, name',
      parcels: 'id, village_id, status, zone_type',
      translations: 'key',
      disputeQueue: 'id, parcelId, category',
      disputeOverrides: 'id, status',
      disputeEvents: '++idx, disputeId, toStatus',
      metadata: 'key',
    })
  }
}

export const db = new LandDatabase()

const CACHE_VERSION = 4

// ============================================================================
// METADATA HELPERS
// ============================================================================

async function getMetadata<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const record = await db.metadata.get(key)
    return record ? (record.value as T) : defaultValue
  } catch {
    return defaultValue
  }
}

async function setMetadata<T>(key: string, value: T): Promise<boolean> {
  try {
    await db.metadata.put({ key, value })
    return true
  } catch {
    return false
  }
}

/**
 * Initialize cache version on first load. Clear all tables on mismatch.
 */
async function initCacheVersion(): Promise<void> {
  const currentVersion = await getMetadata<number>('cache-version', 0)
  if (currentVersion !== CACHE_VERSION) {
    await Promise.all([
      db.villages.clear(),
      db.parcels.clear(),
      db.translations.clear(),
      db.disputeQueue.clear(),
      db.disputeOverrides.clear(),
      db.disputeEvents.clear(),
      db.metadata.clear(),
    ])
    await setMetadata('cache-version', CACHE_VERSION)
  }
}

// Run version checks immediately
initCacheVersion().catch(err => console.warn('Database initialization failed:', err))

// ============================================================================
// VILLAGES CACHE
// ============================================================================

export async function cacheVillages(villages: Village[]): Promise<boolean> {
  try {
    await db.villages.bulkPut(villages)
    return true
  } catch {
    return false
  }
}

export async function getCachedVillages(): Promise<Village[]> {
  return db.villages.toArray()
}

export async function hasCachedVillages(): Promise<boolean> {
  const count = await db.villages.count()
  return count > 0
}

// ============================================================================
// PARCELS CACHE
// ============================================================================

export async function cacheParcels(parcels: Parcel[]): Promise<boolean> {
  try {
    await db.parcels.bulkPut(parcels)
    return true
  } catch {
    return false
  }
}

export async function getCachedParcels(): Promise<Parcel[]> {
  return db.parcels.toArray()
}

export async function getCachedParcelsByVillage(villageId: string): Promise<Parcel[]> {
  return db.parcels.where('village_id').equals(villageId).toArray()
}

export async function hasCachedParcels(): Promise<boolean> {
  const count = await db.parcels.count()
  return count > 0
}

// ============================================================================
// TRANSLATIONS CACHE
// ============================================================================

export async function cacheTranslations(translations: CachedTranslations): Promise<boolean> {
  try {
    const rows = Object.entries(translations).map(([key, item]) => ({
      key,
      ...item,
    }))
    await db.translations.bulkPut(rows)
    return true
  } catch {
    return false
  }
}

export async function getCachedTranslations(): Promise<CachedTranslations> {
  const rows = await db.translations.toArray()
  const map: CachedTranslations = {}
  for (const row of rows) {
    map[row.key] = {
      lao_text: row.lao_text,
      english_text: row.english_text,
      hmong_text: row.hmong_text,
      khmu_text: row.khmu_text,
    }
  }
  return map
}

export async function hasCachedTranslations(): Promise<boolean> {
  const count = await db.translations.count()
  return count > 0
}

// ============================================================================
// DISPUTE QUEUE (for offline submissions)
// ============================================================================

export async function queueDispute(dispute: Omit<QueuedDispute, 'id' | 'referenceNumber' | 'timestamp' | 'retries'> & { id?: string; referenceNumber?: string }): Promise<string> {
  const id = dispute.id || `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const newDispute: QueuedDispute = {
    ...dispute,
    id,
    referenceNumber: dispute.referenceNumber || id,
    timestamp: Date.now(),
    retries: 0,
  }
  await db.disputeQueue.put(newDispute)
  return id
}

export async function getDisputeQueue(): Promise<QueuedDispute[]> {
  return db.disputeQueue.toArray()
}

export async function findQueuedDisputeByReference(reference: string): Promise<QueuedDispute | null> {
  const needle = reference.trim().toLowerCase()
  const queue = await getDisputeQueue()
  return queue.find(d => d.referenceNumber.toLowerCase() === needle || d.id.toLowerCase() === needle) ?? null
}

export async function removeDisputeFromQueue(id: string): Promise<boolean> {
  try {
    await db.disputeQueue.delete(id)
    return true
  } catch {
    return false
  }
}

export async function incrementDisputeRetry(id: string): Promise<boolean> {
  try {
    const record = await db.disputeQueue.get(id)
    if (!record) return false
    record.retries += 1
    await db.disputeQueue.put(record)
    return true
  } catch {
    return false
  }
}

export async function getPendingDisputeCount(): Promise<number> {
  return db.disputeQueue.count()
}

// ============================================================================
// SYNC STATUS & TIMESTAMPS
// ============================================================================

export async function updateLastSync(): Promise<boolean> {
  return setMetadata('last-sync', Date.now())
}

export async function getLastSync(): Promise<number | null> {
  return getMetadata<number | null>('last-sync', null)
}

export async function getSyncStatus(isOnline: boolean): Promise<SyncStatus> {
  const lastSync = await getLastSync()
  const pendingCount = await getPendingDisputeCount()
  const vCached = await hasCachedVillages()
  const pCached = await hasCachedParcels()
  const tCached = await hasCachedTranslations()

  return {
    isOnline,
    lastSync,
    pendingCount,
    hasCachedData: vCached && pCached && tCached,
  }
}

export function formatLastSync(lastSync: number | null): string {
  if (!lastSync) return 'Never'
  const diff = Date.now() - lastSync
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}

// ============================================================================
// COMPOSITE CACHE OPERATIONS
// ============================================================================

export async function cacheAllData(villages: Village[], parcels: Parcel[], translations: CachedTranslations): Promise<boolean> {
  const villagesOk = await cacheVillages(villages)
  const parcelsOk = await cacheParcels(parcels)
  const translationsOk = await cacheTranslations(translations)
  const syncOk = await updateLastSync()
  return villagesOk && parcelsOk && translationsOk && syncOk
}

export async function hasAnyCachedData(): Promise<boolean> {
  const vCached = await hasCachedVillages()
  const pCached = await hasCachedParcels()
  const tCached = await hasCachedTranslations()
  return vCached || pCached || tCached
}

// ============================================================================
// DISPUTE RESOLUTION OVERRIDES (for offline officer actions)
// ============================================================================

export async function getDisputeOverrides(): Promise<Record<string, Omit<DisputeOverride, 'id'>>> {
  const records = await db.disputeOverrides.toArray()
  const map: Record<string, Omit<DisputeOverride, 'id'>> = {}
  for (const r of records) {
    map[r.id] = {
      status: r.status,
      comment: r.comment,
      updatedAt: r.updatedAt,
    }
  }
  return map
}

export async function saveDisputeOverride(id: string, status: 'submitted' | 'in_review' | 'resolved', comment: string): Promise<void> {
  await db.disputeOverrides.put({
    id,
    status,
    comment,
    updatedAt: Date.now(),
  })
}

// ============================================================================
// LOCAL DISPUTE EVENTS
// ============================================================================

export async function getLocalDisputeEvents(): Promise<LocalDisputeEvent[]> {
  return db.disputeEvents.toArray()
}

export async function appendLocalDisputeEvent(event: LocalDisputeEvent): Promise<void> {
  await db.disputeEvents.put(event)
}

export async function getLocalDisputeEventsFor(...ids: (string | null | undefined)[]): Promise<LocalDisputeEvent[]> {
  const wanted = new Set(ids.filter(Boolean).map(id => (id as string).toLowerCase()))
  const allEvents = await getLocalDisputeEvents()
  return allEvents.filter(e => wanted.has(e.disputeId.toLowerCase()))
}