import { supabase } from './supabaseClient'
import {
  cacheVillages,
  cacheParcels,
  getCachedVillages,
  getCachedParcels,
  getCachedParcelsByVillage,
  hasCachedVillages,
  hasCachedParcels,
  queueDispute,
  getDisputeQueue,
  removeDisputeFromQueue,
  cacheAllData,
} from './offlineStorage'

export type ParcelStatus = 'registered' | 'pending' | 'disputed'
export type ZoneType = 'forest' | 'agricultural' | 'residential' | 'disputed'

export type Village = {
  id: string
  name: string
  province: string
}

export type Parcel = {
  id: string
  village_id: string
  demo_village_name: string
  status: ParcelStatus
  zone_type: ZoneType
  geo_coords: { lat: number; lng: number }
}

const PARCEL_COLUMNS = 'id, village_id, demo_village_name, status, zone_type, geo_coords'

// Fixed so the "simulated scan" always returns the same demo result.
const DEMO_SCAN_PARCEL_ID = 'DEMO-PARCEL-0005'

/**
 * Fetch villages with offline fallback.
 * Tries Supabase first, caches on success, falls back to localStorage on failure.
 */
export async function fetchVillages(): Promise<Village[]> {
  if (!supabase) {
    return getCachedVillages()
  }
  try {
    const { data, error } = await supabase.from('villages').select('id, name, province').order('name')
    if (error || !data) {
      return hasCachedVillages() ? getCachedVillages() : []
    }
    cacheVillages(data)
    return data
  } catch {
    return hasCachedVillages() ? getCachedVillages() : []
  }
}

/**
 * Fetch parcels for a specific village with offline fallback.
 */
export async function fetchParcelsByVillage(villageId: string): Promise<Parcel[]> {
  if (!supabase) {
    return getCachedParcelsByVillage(villageId)
  }
  try {
    const { data, error } = await supabase
      .from('parcels')
      .select(PARCEL_COLUMNS)
      .eq('village_id', villageId)
      .order('id')
    if (error || !data) {
      return hasCachedParcels() ? getCachedParcelsByVillage(villageId) : []
    }
    // Merge new parcels with existing cache to avoid erasing other villages
    const cached = getCachedParcels()
    const mergedMap = new Map(cached.map((p) => [p.id, p]))
    for (const p of data as Parcel[]) {
      mergedMap.set(p.id, p)
    }
    cacheParcels(Array.from(mergedMap.values()))
    return data as Parcel[]
  } catch {
    return hasCachedParcels() ? getCachedParcelsByVillage(villageId) : []
  }
}

/**
 * Preload and cache all static data (villages, parcels, translations) on startup.
 */
export async function preloadAndCacheAll(): Promise<void> {
  const client = supabase
  if (!client) return
  try {
    const [villagesRes, parcelsRes, translationsRes] = await Promise.all([
      client.from('villages').select('id, name, province').order('name'),
      client.from('parcels').select(PARCEL_COLUMNS).order('id'),
      client.from('translations').select('key, lao_text, english_text, sample_minority_language_text'),
    ])

    if (
      villagesRes.data &&
      parcelsRes.data &&
      translationsRes.data
    ) {
      const transMap: Record<string, { lao_text: string; english_text: string; hmong_text: string; khmu_text: string }> = {}
      for (const row of translationsRes.data) {
        // Map the database minority text to both Hmong and Khmu for our enhanced schema
        transMap[row.key] = {
          lao_text: row.lao_text || '',
          english_text: row.english_text || '',
          hmong_text: row.sample_minority_language_text || '',
          khmu_text: row.sample_minority_language_text || '',
        }
      }

      cacheAllData(
        villagesRes.data,
        parcelsRes.data as Parcel[],
        transMap
      )
    }
  } catch (err) {
    console.warn('Failed to preload and cache all data:', err)
  }
}

/**
 * Fetch the demo scan parcel with offline fallback.
 */
export async function fetchDemoScanParcel(): Promise<Parcel | null> {
  if (!supabase) {
    const cached = getCachedParcels().find(p => p.id === DEMO_SCAN_PARCEL_ID)
    return cached ?? null
  }
  try {
    const { data, error } = await supabase
      .from('parcels')
      .select(PARCEL_COLUMNS)
      .eq('id', DEMO_SCAN_PARCEL_ID)
      .single()
    if (error || !data) {
      const cached = getCachedParcels().find(p => p.id === DEMO_SCAN_PARCEL_ID)
      return cached ?? null
    }
    return data as Parcel
  } catch {
    const cached = getCachedParcels().find(p => p.id === DEMO_SCAN_PARCEL_ID)
    return cached ?? null
  }
}

/**
 * Fetch all parcels with offline fallback.
 */
export async function fetchAllParcels(): Promise<Parcel[]> {
  if (!supabase) {
    return getCachedParcels()
  }
  try {
    const { data, error } = await supabase.from('parcels').select(PARCEL_COLUMNS).order('id')
    if (error || !data) {
      return hasCachedParcels() ? getCachedParcels() : []
    }
    cacheParcels(data as Parcel[])
    return data as Parcel[]
  } catch {
    return hasCachedParcels() ? getCachedParcels() : []
  }
}

export type DisputeCategory = 'boundary' | 'wrong_info' | 'ownership' | 'other'

// Plain-English labels folded into the disputes.description column, since
// the M1 schema has no separate category field. The field-officer view
// (M6) is allowed more technical language, so this is fine to read raw.
const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  boundary: 'Boundary problem',
  wrong_info: 'Wrong information shown',
  ownership: 'Ownership question',
  other: 'Other concern',
}

// No auth/real identity in this prototype (see M0 guardrails), so every
// submission is attributed to a fixed demo citizen rather than a real name.
const DEMO_SUBMITTER = 'demo-citizen'

/**
 * Create a dispute with offline queuing support.
 * If online, submits to Supabase immediately.
 * If offline, queues locally for later sync.
 */
export async function createDispute(input: {
  parcelId: string
  category: DisputeCategory
  note: string
}): Promise<{ fakeReferenceNumber: string; queued: boolean } | null> {
  const description = [DISPUTE_CATEGORY_LABELS[input.category], input.note.trim()].filter(Boolean).join(' — ')
  
  const client = supabase
  
  if (client) {
    try {
      const { data, error } = await client
        .from('disputes')
        .insert({ parcel_id: input.parcelId, submitted_by: DEMO_SUBMITTER, description })
        .select('fake_reference_number')
        .single()
      if (error || !data) {
        // If online but request failed, queue for retry
        queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note })
        return { fakeReferenceNumber: `DEMO-DSP-OFFLINE-${Date.now()}`, queued: true }
      }
      return { fakeReferenceNumber: data.fake_reference_number as string, queued: false }
    } catch {
      // Network error - queue for later
      queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note })
      return { fakeReferenceNumber: `DEMO-DSP-OFFLINE-${Date.now()}`, queued: true }
    }
  } else {
    // Offline - queue for later sync
    queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note })
    return { fakeReferenceNumber: `DEMO-DSP-OFFLINE-${Date.now()}`, queued: true }
  }
}

/**
 * Sync queued disputes when coming back online.
 * Call this when connection is restored.
 */
export async function syncQueuedDisputes(): Promise<{ synced: number; failed: number }> {
  const client = supabase
  if (!client) return { synced: 0, failed: 0 }
  
  const queue = getDisputeQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }
  
  let synced = 0
  let failed = 0
  
  for (const dispute of queue) {
    try {
      const description = [DISPUTE_CATEGORY_LABELS[dispute.category as DisputeCategory], dispute.note.trim()].filter(Boolean).join(' — ')
      const { error } = await client
        .from('disputes')
        .insert({ parcel_id: dispute.parcelId, submitted_by: DEMO_SUBMITTER, description })
      
      if (error) {
        failed++
      } else {
        synced++
        removeDisputeFromQueue(dispute.id)
      }
    } catch {
      failed++
    }
  }
  
  return { synced, failed }
}

// M6 field-officer dashboard. Display-only — there is no RLS update policy
// on `disputes` for the anon key, so this stays a read-only queue view
// rather than a case-management tool (matches the M6/M7 "demo queue view
// only" guardrail in module_prompts.txt).
export type DisputeStatus = 'submitted' | 'in_review' | 'resolved'

export type Dispute = {
  id: string
  parcel_id: string
  submitted_by: string
  description: string | null
  status: DisputeStatus
  fake_reference_number: string
  created_at: string
  parcel: { demo_village_name: string; village_id: string; zone_type: ZoneType } | null
}

const DISPUTE_COLUMNS =
  'id, parcel_id, submitted_by, description, status, fake_reference_number, created_at, parcel:parcels(demo_village_name, village_id, zone_type)'

export async function fetchDisputes(): Promise<Dispute[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('disputes')
    .select(DISPUTE_COLUMNS)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => ({
    ...row,
    parcel: Array.isArray(row.parcel) ? (row.parcel[0] ?? null) : row.parcel,
  })) as Dispute[]
}
