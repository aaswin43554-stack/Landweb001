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
  getDisputeOverrides,
  saveDisputeOverride,
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

const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  boundary: 'Boundary problem',
  wrong_info: 'Wrong information shown',
  ownership: 'Ownership question',
  other: 'Other concern',
}

const DEMO_SUBMITTER = 'demo-citizen'

/**
 * Create a dispute with offline queuing support and media attachments.
 */
export async function createDispute(input: {
  parcelId: string
  category: DisputeCategory
  note: string
  photos?: string[]
  audio?: string | null
}): Promise<{ fakeReferenceNumber: string; queued: boolean } | null> {
  let description = [DISPUTE_CATEGORY_LABELS[input.category], input.note.trim()].filter(Boolean).join(' — ')
  if (input.photos && input.photos.length > 0) {
    description += ` [Evidence: ${input.photos.length} photos]`
  }
  if (input.audio) {
    description += ' [Evidence: 1 voice note]'
  }

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
        queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note, photos: input.photos, audio: input.audio })
        return { fakeReferenceNumber: `DEMO-DSP-OFFLINE-${Date.now()}`, queued: true }
      }
      return { fakeReferenceNumber: data.fake_reference_number as string, queued: false }
    } catch {
      // Network error - queue for later
      queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note, photos: input.photos, audio: input.audio })
      return { fakeReferenceNumber: `DEMO-DSP-OFFLINE-${Date.now()}`, queued: true }
    }
  } else {
    // Offline - queue for later sync
    queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note, photos: input.photos, audio: input.audio })
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
      let description = [DISPUTE_CATEGORY_LABELS[dispute.category as DisputeCategory], dispute.note.trim()].filter(Boolean).join(' — ')
      if (dispute.photos && dispute.photos.length > 0) {
        description += ` [Evidence: ${dispute.photos.length} photos]`
      }
      if (dispute.audio) {
        description += ' [Evidence: 1 voice note]'
      }

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
  photos?: string[]
  audio?: string | null
}

const DISPUTE_COLUMNS =
  'id, parcel_id, submitted_by, description, status, fake_reference_number, created_at, parcel:parcels(demo_village_name, village_id, zone_type)'

export async function fetchDisputes(): Promise<Dispute[]> {
  const client = supabase

  // Load offline queued disputes
  const queue = getDisputeQueue()
  const queuedDisputes: Dispute[] = queue.map((d) => {
    let description = [DISPUTE_CATEGORY_LABELS[d.category as DisputeCategory], d.note.trim()].filter(Boolean).join(' — ')
    if (d.photos && d.photos.length > 0) {
      description += ` [Evidence: ${d.photos.length} photos]`
    }
    if (d.audio) {
      description += ' [Evidence: 1 voice note]'
    }

    return {
      id: d.id,
      parcel_id: d.parcelId,
      submitted_by: DEMO_SUBMITTER,
      description,
      status: 'submitted',
      fake_reference_number: d.id,
      created_at: new Date(d.timestamp).toISOString(),
      parcel: getCachedParcels().find((p) => p.id === d.parcelId) || null,
      photos: d.photos,
      audio: d.audio,
    } as Dispute
  })

  let dbDisputes: Dispute[] = []
  if (client) {
    try {
      const { data, error } = await client
        .from('disputes')
        .select(DISPUTE_COLUMNS)
        .order('created_at', { ascending: false })
      if (data && !error) {
        dbDisputes = data.map((row) => ({
          ...row,
          parcel: Array.isArray(row.parcel) ? (row.parcel[0] ?? null) : row.parcel,
        })) as Dispute[]
      }
    } catch {
      // Offline fallback for database fetch
    }
  }

  const allDisputes = [...queuedDisputes, ...dbDisputes]

  // Apply offline resolution status overrides
  const overrides = getDisputeOverrides()
  return allDisputes.map((d) => {
    const override = overrides[d.id] || overrides[d.fake_reference_number]
    if (override) {
      return {
        ...d,
        status: override.status,
        description: d.description + (override.comment ? ` \n[Officer Remark: ${override.comment}]` : ''),
      }
    }
    return d
  })
}

/**
 * Update case status with local overrides support for offline robustness.
 */
export async function updateDisputeStatus(
  disputeId: string,
  status: 'submitted' | 'in_review' | 'resolved',
  comment: string
): Promise<boolean> {
  // Always update locally for instant responsiveness
  saveDisputeOverride(disputeId, status, comment)

  const client = supabase
  if (!client) return true // Offline success

  try {
    const { error } = await client
      .from('disputes')
      .update({ status, description: comment ? `Resolved — [Officer remark: ${comment}]` : undefined })
      .or(`id.eq.${disputeId},fake_reference_number.eq.${disputeId}`)
    return !error
  } catch {
    return true // Fallback succeeds via local storage override
  }
}
