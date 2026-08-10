/**
 * Offline-first storage layer for the GIZ Land Use Transparency Prototype.
 * Provides localStorage/IndexedDB caching for villages, parcels, translations,
 * and dispute submissions with automatic sync when online.
 */

import type { Village, Parcel, Dispute } from './land'

// Storage keys
const STORAGE_KEYS = {
  VILLAGES: 'giz-offline-villages',
  PARCELS: 'giz-offline-parcels',
  TRANSLATIONS: 'giz-offline-translations',
  DISPUTE_QUEUE: 'giz-offline-dispute-queue',
  LAST_SYNC: 'giz-offline-last-sync',
  CACHE_VERSION: 'giz-offline-cache-version',
  DISPUTE_OVERRIDES: 'giz-offline-dispute-overrides',
} as const

// Cache version - increment when data structure changes
const CACHE_VERSION = 2

// Type definitions
export type CachedVillages = Village[]
export type CachedParcels = Parcel[]
export type CachedTranslations = Record<string, { lao_text: string; english_text: string; hmong_text: string; khmu_text: string }>

export type QueuedDispute = {
  id: string
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

/**
 * Check if we're running in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

/**
 * Generic localStorage getter with error handling
 */
function getFromStorage<T>(key: string, defaultValue: T): T {
  if (!isBrowser()) return defaultValue
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Generic localStorage setter with error handling
 */
export function setToStorage<T>(key: string, value: T): boolean {
  if (!isBrowser()) return false
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}



/**
 * Invalidate cache by clearing all stored data
 */
export function clearOfflineCache(): void {
  if (!isBrowser()) return
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
}

/**
 * Initialize cache version on first load
 */
function initCacheVersion(): void {
  if (!isBrowser()) return
  const currentVersion = getFromStorage<number>(STORAGE_KEYS.CACHE_VERSION, 0)
  if (currentVersion !== CACHE_VERSION) {
    clearOfflineCache()
    setToStorage(STORAGE_KEYS.CACHE_VERSION, CACHE_VERSION)
  }
}

// Initialize on module load
initCacheVersion()

// ============================================================================
// VILLAGES CACHE
// ============================================================================

export function cacheVillages(villages: Village[]): boolean {
  return setToStorage(STORAGE_KEYS.VILLAGES, villages)
}

export function getCachedVillages(): Village[] {
  return getFromStorage<CachedVillages>(STORAGE_KEYS.VILLAGES, [])
}

export function hasCachedVillages(): boolean {
  return getCachedVillages().length > 0
}

// ============================================================================
// PARCELS CACHE
// ============================================================================

export function cacheParcels(parcels: Parcel[]): boolean {
  return setToStorage(STORAGE_KEYS.PARCELS, parcels)
}

export function getCachedParcels(): Parcel[] {
  return getFromStorage<CachedParcels>(STORAGE_KEYS.PARCELS, [])
}

export function getCachedParcelsByVillage(villageId: string): Parcel[] {
  const allParcels = getCachedParcels()
  return allParcels.filter(p => p.village_id === villageId)
}

export function hasCachedParcels(): boolean {
  return getCachedParcels().length > 0
}

// ============================================================================
// TRANSLATIONS CACHE
// ============================================================================

export function cacheTranslations(translations: CachedTranslations): boolean {
  return setToStorage(STORAGE_KEYS.TRANSLATIONS, translations)
}

export function getCachedTranslations(): CachedTranslations {
  return getFromStorage<CachedTranslations>(STORAGE_KEYS.TRANSLATIONS, {})
}

export function hasCachedTranslations(): boolean {
  return Object.keys(getCachedTranslations()).length > 0
}

// ============================================================================
// DISPUTE QUEUE (for offline submissions)
// ============================================================================

export function queueDispute(dispute: Omit<QueuedDispute, 'id' | 'timestamp' | 'retries'>): string {
  const queue = getDisputeQueue()
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const newDispute: QueuedDispute = {
    ...dispute,
    id,
    timestamp: Date.now(),
    retries: 0,
  }
  queue.push(newDispute)
  setToStorage(STORAGE_KEYS.DISPUTE_QUEUE, queue)
  return id
}

export function getDisputeQueue(): QueuedDispute[] {
  return getFromStorage<QueuedDispute[]>(STORAGE_KEYS.DISPUTE_QUEUE, [])
}

export function removeDisputeFromQueue(id: string): boolean {
  const queue = getDisputeQueue()
  const filtered = queue.filter(d => d.id !== id)
  return setToStorage(STORAGE_KEYS.DISPUTE_QUEUE, filtered)
}

export function incrementDisputeRetry(id: string): boolean {
  const queue = getDisputeQueue()
  const dispute = queue.find(d => d.id === id)
  if (!dispute) return false
  dispute.retries += 1
  return setToStorage(STORAGE_KEYS.DISPUTE_QUEUE, queue)
}

export function getPendingDisputeCount(): number {
  return getDisputeQueue().length
}

// ============================================================================
// SYNC STATUS & TIMESTAMPS
// ============================================================================

export function updateLastSync(): boolean {
  return setToStorage(STORAGE_KEYS.LAST_SYNC, Date.now())
}

export function getLastSync(): number | null {
  return getFromStorage<number | null>(STORAGE_KEYS.LAST_SYNC, null)
}

export function getSyncStatus(isOnline: boolean): SyncStatus {
  return {
    isOnline,
    lastSync: getLastSync(),
    pendingCount: getPendingDisputeCount(),
    hasCachedData: hasCachedVillages() && hasCachedParcels() && hasCachedTranslations(),
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

export function cacheAllData(villages: Village[], parcels: Parcel[], translations: CachedTranslations): boolean {
  const villagesOk = cacheVillages(villages)
  const parcelsOk = cacheParcels(parcels)
  const translationsOk = cacheTranslations(translations)
  const syncOk = updateLastSync()
  return villagesOk && parcelsOk && translationsOk && syncOk
}

export function hasAnyCachedData(): boolean {
  return hasCachedVillages() || hasCachedParcels() || hasCachedTranslations()
}

// ============================================================================
// DISPUTES DATABASE CACHE
// ============================================================================

const DISPUTES_DB_CACHE_KEY = 'giz-offline-db-disputes'

export function cacheDbDisputes(disputes: Dispute[]): void {
  setToStorage(DISPUTES_DB_CACHE_KEY, disputes)
}

export function getCachedDbDisputes(): Dispute[] {
  // If empty, return a set of initial seed disputes for the demo
  const cached = getFromStorage<Dispute[]>(DISPUTES_DB_CACHE_KEY, [])
  if (cached.length === 0) {
    const initialSeed: Dispute[] = [
      {
        id: 'demo-dsp-uuid-0001',
        parcel_id: 'DEMO-PARCEL-0005',
        submitted_by: 'Somphone S.',
        status: 'submitted',
        fake_reference_number: 'DEMO-DSP-0001',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
        description: 'Boundary problem — Neighbor B built a new wooden fence encroaching about 1.5 meters into my yard. We request immediate field inspection.',
        parcel: { demo_village_name: 'Ban Namdeng', village_id: 'DEMO-VLG-001', zone_type: 'forest' }
      },
      {
        id: 'demo-dsp-uuid-0002',
        parcel_id: 'DEMO-PARCEL-0012',
        submitted_by: 'Bounmy P.',
        status: 'in_review',
        fake_reference_number: 'DEMO-DSP-0002',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
        description: 'Wrong information shown — The system indicates my land zone is purely Agricultural, but 40% of the parcel was re-zoned as Residential in 2020. Please correct the zoning record.',
        parcel: { demo_village_name: 'Ban Thongdee', village_id: 'DEMO-VLG-004', zone_type: 'agricultural' }
      },
      {
        id: 'demo-dsp-uuid-0003',
        parcel_id: 'DEMO-PARCEL-0019',
        submitted_by: 'Chansamone V.',
        status: 'resolved',
        fake_reference_number: 'DEMO-DSP-0003',
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
        description: 'Who owns this land — Ownership dispute between siblings. Resolved — [Officer remark: Checked historical ledger of 2015 and family lease agreement. Boundary divided equally into 2 plots.]',
        parcel: { demo_village_name: 'Ban Vilaysook', village_id: 'DEMO-VLG-003', zone_type: 'residential' }
      }
    ]
    setToStorage(DISPUTES_DB_CACHE_KEY, initialSeed)
    return initialSeed
  }
  return cached
}

// ============================================================================
// DISPUTE RESOLUTION OVERRIDES (for offline officer actions)
// ============================================================================

export type DisputeOverride = {
  status: 'submitted' | 'in_review' | 'resolved'
  comment: string
  updatedAt: number
}

export function getDisputeOverrides(): Record<string, DisputeOverride> {
  return getFromStorage<Record<string, DisputeOverride>>(STORAGE_KEYS.DISPUTE_OVERRIDES, {})
}

export function saveDisputeOverride(id: string, status: 'submitted' | 'in_review' | 'resolved', comment: string): void {
  const overrides = getDisputeOverrides()
  overrides[id] = {
    status,
    comment,
    updatedAt: Date.now(),
  }
  setToStorage(STORAGE_KEYS.DISPUTE_OVERRIDES, overrides)
}

// ============================================================================
// REGISTRY PARCEL MUTATIONS (Admin & GPS Audits)
// ============================================================================

export function addCachedParcel(parcel: Parcel): void {
  const parcels = getCachedParcels()
  parcels.push(parcel)
  cacheParcels(parcels)
}

export function updateCachedParcel(parcel: Parcel): void {
  const parcels = getCachedParcels()
  const idx = parcels.findIndex(p => p.id === parcel.id)
  if (idx !== -1) {
    parcels[idx] = parcel
  } else {
    parcels.push(parcel)
  }
  cacheParcels(parcels)
}

export function deleteCachedParcel(id: string): void {
  const parcels = getCachedParcels()
  const filtered = parcels.filter(p => p.id !== id)
  cacheParcels(filtered)
}

// ============================================================================
// SYNC ACTIVITY LOGS (Admin Stats & CRDT Log Audits)
// ============================================================================

const SYNC_LOGS_KEY = 'giz-offline-sync-logs'

export function getSyncLogs(): string[] {
  return getFromStorage<string[]>(SYNC_LOGS_KEY, [
    'System initialized. Demo databases seeded.',
    'Offline cache populated with default land zoning definitions.',
  ])
}

export function addSyncLog(message: string): void {
  const logs = getSyncLogs()
  const timestamp = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  logs.unshift(`[${timestamp}] ${message}`)
  // Cap logs at 50 entries
  setToStorage(SYNC_LOGS_KEY, logs.slice(0, 50))
}
