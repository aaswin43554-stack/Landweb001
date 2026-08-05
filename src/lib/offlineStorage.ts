/**
 * Offline-first storage layer for the GIZ Land Use Transparency Prototype.
 * Provides localStorage/IndexedDB caching for villages, parcels, translations,
 * and dispute submissions with automatic sync when online.
 */

import type { Village, Parcel } from './land'

// Storage keys
const STORAGE_KEYS = {
  VILLAGES: 'giz-offline-villages',
  PARCELS: 'giz-offline-parcels',
  TRANSLATIONS: 'giz-offline-translations',
  DISPUTE_QUEUE: 'giz-offline-dispute-queue',
  LAST_SYNC: 'giz-offline-last-sync',
  CACHE_VERSION: 'giz-offline-cache-version',
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
function setToStorage<T>(key: string, value: T): boolean {
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