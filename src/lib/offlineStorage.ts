/**
 * Offline-first storage layer for the GIZ Land Use Transparency Prototype.
 * Backed by Dexie IndexedDB for high-capacity offline reliability, Platform Biometrics support,
 * and localStorage fallbacks for lighter metadata.
 */

import Dexie, { type Table } from 'dexie'
import type { Village, Parcel, Dispute } from './land'

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

// Helper for Browser Env check
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

// Generic localStorage setter helper used in P2P cleaning
export function setToStorage<T>(key: string, value: T): boolean {
  if (!isBrowser()) return false
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

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
    const dispute = await db.disputeQueue.get(id)
    if (!dispute) return false
    dispute.retries += 1
    await db.disputeQueue.put(dispute)
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
  const hasCached = (await hasCachedVillages()) && (await hasCachedParcels()) && (await hasCachedTranslations())
  return {
    isOnline,
    lastSync,
    pendingCount,
    hasCachedData: hasCached,
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
  return (await hasCachedVillages()) || (await hasCachedParcels()) || (await hasCachedTranslations())
}

// ============================================================================
// DISPUTES DATABASE CACHE (Saved in localStorage to prevent Dexie schema migration locks)
// ============================================================================

const DISPUTES_DB_CACHE_KEY = 'giz-offline-db-disputes'

export function cacheDbDisputes(disputes: Dispute[]): void {
  try {
    localStorage.setItem(DISPUTES_DB_CACHE_KEY, JSON.stringify(disputes))
  } catch {}
}

export function getCachedDbDisputes(): Dispute[] {
  try {
    const item = localStorage.getItem(DISPUTES_DB_CACHE_KEY)
    const cached = item ? JSON.parse(item) : []
    if (cached.length === 0) {
      const initialSeed: Dispute[] = [
        {
          id: 'demo-dsp-uuid-0001',
          parcel_id: 'DEMO-PARCEL-0005',
          submitted_by: 'Somphone S.',
          status: 'submitted',
          fake_reference_number: 'DEMO-DSP-0001',
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          description: 'Boundary problem — Neighbor B built a new wooden fence encroaching about 1.5 meters into my yard. We request immediate field inspection.',
          parcel: { demo_village_name: 'Ban Namdeng', village_id: 'DEMO-VLG-001', zone_type: 'forest' }
        },
        {
          id: 'demo-dsp-uuid-0002',
          parcel_id: 'DEMO-PARCEL-0012',
          submitted_by: 'Bounmy P.',
          status: 'in_review',
          fake_reference_number: 'DEMO-DSP-0002',
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          description: 'Wrong information shown — The system indicates my land zone is purely Agricultural, but 40% of the parcel was re-zoned as Residential in 2020. Please correct the zoning record.',
          parcel: { demo_village_name: 'Ban Thongdee', village_id: 'DEMO-VLG-004', zone_type: 'agricultural' }
        },
        {
          id: 'demo-dsp-uuid-0003',
          parcel_id: 'DEMO-PARCEL-0019',
          submitted_by: 'Chansamone V.',
          status: 'resolved',
          fake_reference_number: 'DEMO-DSP-0003',
          created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
          description: 'Who owns this land — Ownership dispute between siblings. Resolved — [Officer remark: Checked historical ledger of 2015 and family lease agreement. Boundary divided equally into 2 plots.]',
          parcel: { demo_village_name: 'Ban Vilaysook', village_id: 'DEMO-VLG-003', zone_type: 'residential' }
        }
      ]
      localStorage.setItem(DISPUTES_DB_CACHE_KEY, JSON.stringify(initialSeed))
      return initialSeed
    }
    return cached
  } catch {
    return []
  }
}

// ============================================================================
// REGISTRY PARCEL MUTATIONS (Admin Dashboard & GPS Audits)
// ============================================================================

export async function addCachedParcel(parcel: Parcel): Promise<void> {
  await db.parcels.put(parcel)
}

export async function updateCachedParcel(parcel: Parcel): Promise<void> {
  await db.parcels.put(parcel)
}

export async function deleteCachedParcel(id: string): Promise<void> {
  await db.parcels.delete(id)
}

// ============================================================================
// SYNC LOG LEDGER (Saved in localStorage for visual audit trail)
// ============================================================================

const SYNC_LOGS_KEY = 'giz-offline-sync-logs'

export function getSyncLogs(): string[] {
  try {
    const item = localStorage.getItem(SYNC_LOGS_KEY)
    return item ? JSON.parse(item) : [
      'System initialized. Demo databases seeded.',
      'Offline cache populated with default land zoning definitions.',
    ]
  } catch {
    return []
  }
}

export function addSyncLog(message: string): void {
  const logs = getSyncLogs()
  const timestamp = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  logs.unshift(`[${timestamp}] ${message}`)
  try {
    localStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(logs.slice(0, 50)))
  } catch {}
}

// ============================================================================
// DISPUTE RESOLUTION OVERRIDES (for offline officer actions)
// ============================================================================

export async function getDisputeOverrides(): Promise<Record<string, DisputeOverride>> {
  const rows = await db.disputeOverrides.toArray()
  const map: Record<string, DisputeOverride> = {}
  for (const r of rows) {
    map[r.id] = {
      id: r.id,
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
