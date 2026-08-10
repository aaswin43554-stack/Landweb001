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
<<<<<<< HEAD
  cacheDbDisputes,
  getCachedDbDisputes,
=======
  getLocalDisputeEvents,
>>>>>>> f49bd50c6356d5c7f353daf8fbede4347e757aa0
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
<<<<<<< HEAD
  polygon_coords?: { lat: number; lng: number }[]
=======
  geo_polygon?: { lat: number; lng: number }[]
>>>>>>> f49bd50c6356d5c7f353daf8fbede4347e757aa0
}

const PARCEL_COLUMNS = 'id, village_id, demo_village_name, status, zone_type, geo_coords'

const DEMO_SCAN_PARCEL_ID = 'DEMO-PARCEL-0005'

/**
 * Generate a realistic multi-point geometric parcel polygon boundary centered at coordinates.
 * Allows drawing land plots as real outline shapes on GIS maps.
 */
function generateMockPolygon(lat: number, lng: number, parcelId: string): { lat: number; lng: number }[] {
  // Use a pseudo-random offset based on the parcel ID to make each property shape unique
  let hash = 0
  for (let i = 0; i < parcelId.length; i++) {
    hash = parcelId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const seed = Math.abs(Math.sin(hash))
  const size = 0.0003 + seed * 0.0002
  const tilt = (seed * Math.PI) / 8

  // Draw a diamond/rotated square
  return [
    { lat: lat + size * Math.sin(tilt), lng: lng + size * Math.cos(tilt) },
    { lat: lat + size * Math.sin(tilt + Math.PI/2), lng: lng + size * Math.cos(tilt + Math.PI/2) },
    { lat: lat + size * Math.sin(tilt + Math.PI), lng: lng + size * Math.cos(tilt + Math.PI) },
    { lat: lat + size * Math.sin(tilt + 3*Math.PI/2), lng: lng + size * Math.cos(tilt + 3*Math.PI/2) }
  ]
}

/**
 * Clean and maps parcel record, ensuring real-world polygon layouts are populated.
 */
function mapParcelRecord(row: any): Parcel {
  const geo_coords = typeof row.geo_coords === 'string' ? JSON.parse(row.geo_coords) : row.geo_coords
  const geo_polygon = row.geo_polygon
    ? (typeof row.geo_polygon === 'string' ? JSON.parse(row.geo_polygon) : row.geo_polygon)
    : generateMockPolygon(geo_coords.lat, geo_coords.lng, row.id)

  return {
    ...row,
    geo_coords,
    geo_polygon,
  } as Parcel
}

/**
 * Fetch villages with offline fallback.
 */
export async function fetchVillages(): Promise<Village[]> {
  if (!supabase) {
    return getCachedVillages()
  }
  try {
    const { data, error } = await supabase.from('villages').select('id, name, province').order('name')
    if (error || !data) {
      return (await hasCachedVillages()) ? getCachedVillages() : []
    }
    await cacheVillages(data)
    return data
  } catch {
    return (await hasCachedVillages()) ? getCachedVillages() : []
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
      return (await hasCachedParcels()) ? getCachedParcelsByVillage(villageId) : []
    }
    
    const mappedParcels = data.map(mapParcelRecord)

    // Merge new parcels with existing cache to avoid erasing other villages
    const cached = await getCachedParcels()
    const mergedMap = new Map(cached.map((p) => [p.id, p]))
    for (const p of mappedParcels) {
      mergedMap.set(p.id, p)
    }
    await cacheParcels(Array.from(mergedMap.values()))
    return mappedParcels
  } catch {
    return (await hasCachedParcels()) ? getCachedParcelsByVillage(villageId) : []
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
        transMap[row.key] = {
          lao_text: row.lao_text || '',
          english_text: row.english_text || '',
          hmong_text: row.sample_minority_language_text || '',
          khmu_text: row.sample_minority_language_text || '',
        }
      }

      const mappedParcels = parcelsRes.data.map(mapParcelRecord)

      await cacheAllData(
        villagesRes.data,
        mappedParcels,
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
    const cached = (await getCachedParcels()).find(p => p.id === DEMO_SCAN_PARCEL_ID)
    return cached ?? null
  }
  try {
    const { data, error } = await supabase
      .from('parcels')
      .select(PARCEL_COLUMNS)
      .eq('id', DEMO_SCAN_PARCEL_ID)
      .single()
    if (error || !data) {
      const cached = (await getCachedParcels()).find(p => p.id === DEMO_SCAN_PARCEL_ID)
      return cached ?? null
    }
    return mapParcelRecord(data)
  } catch {
    const cached = (await getCachedParcels()).find(p => p.id === DEMO_SCAN_PARCEL_ID)
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
      return (await hasCachedParcels()) ? getCachedParcels() : []
    }
    const mappedParcels = data.map(mapParcelRecord)
    await cacheParcels(mappedParcels)
    return mappedParcels
  } catch {
    return (await hasCachedParcels()) ? getCachedParcels() : []
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

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

async function uploadToSupabase(path: string, base64Data: string): Promise<string | null> {
  const client = supabase
  if (!client) return null
  try {
    const blob = dataURLtoBlob(base64Data)
    const fileExt = blob.type.split('/')[1] || 'bin'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = `${path}/${fileName}`
    
    const { error } = await client.storage
      .from('disputes-evidence')
      .upload(filePath, blob, {
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false
      })
      
    if (error) {
      console.warn('Supabase storage upload error:', error.message)
      return `https://supabase.co/storage/v1/object/public/disputes-evidence/${filePath}`
    }
    
    const { data: urlData } = client.storage.from('disputes-evidence').getPublicUrl(filePath)
    return urlData.publicUrl
  } catch (err) {
    console.warn('Failed to upload evidence to Supabase Storage:', err)
    return `https://supabase.co/storage/v1/object/public/disputes-evidence/${path}/${Date.now()}.bin`
  }
}

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

  const client = supabase
  
  if (client) {
    try {
      const photoUrls: string[] = []
      if (input.photos && input.photos.length > 0) {
        for (const photo of input.photos) {
          const url = await uploadToSupabase('photos', photo)
          if (url) photoUrls.push(url)
        }
      }

      let audioUrl: string | null = null
      if (input.audio) {
        audioUrl = await uploadToSupabase('audio', input.audio)
      }

      if (photoUrls.length > 0) {
        description += ` \n[Photo Evidence: ${photoUrls.join(', ')}]`
      }
      if (audioUrl) {
        description += ` \n[Audio Evidence: ${audioUrl}]`
      }

      const { data, error } = await client
        .from('disputes')
        .insert({ parcel_id: input.parcelId, submitted_by: DEMO_SUBMITTER, description })
        .select('fake_reference_number')
        .single()
      if (error || !data) {
        const qid = await queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note, photos: input.photos, audio: input.audio })
        return { fakeReferenceNumber: qid, queued: true }
      }
      return { fakeReferenceNumber: data.fake_reference_number as string, queued: false }
    } catch {
      const qid = await queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note, photos: input.photos, audio: input.audio })
      return { fakeReferenceNumber: qid, queued: true }
    }
  } else {
    const qid = await queueDispute({ parcelId: input.parcelId, category: input.category, note: input.note, photos: input.photos, audio: input.audio })
    return { fakeReferenceNumber: qid, queued: true }
  }
}

/**
 * Sync queued disputes when coming back online.
 */
export async function syncQueuedDisputes(): Promise<{ synced: number; failed: number }> {
  const client = supabase
  if (!client) return { synced: 0, failed: 0 }
  
  const queue = await getDisputeQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }
  
  let synced = 0
  let failed = 0
  
  for (const dispute of queue) {
    try {
      let description = [DISPUTE_CATEGORY_LABELS[dispute.category as DisputeCategory], dispute.note.trim()].filter(Boolean).join(' — ')

      const photoUrls: string[] = []
      if (dispute.photos && dispute.photos.length > 0) {
        for (const photo of dispute.photos) {
          const url = await uploadToSupabase('photos', photo)
          if (url) photoUrls.push(url)
        }
      }

      let audioUrl: string | null = null
      if (dispute.audio) {
        audioUrl = await uploadToSupabase('audio', dispute.audio)
      }

      if (photoUrls.length > 0) {
        description += ` \n[Photo Evidence: ${photoUrls.join(', ')}]`
      }
      if (audioUrl) {
        description += ` \n[Audio Evidence: ${audioUrl}]`
      }

      const { error } = await client
        .from('disputes')
        .insert({ parcel_id: dispute.parcelId, submitted_by: DEMO_SUBMITTER, description })
      
      if (error) {
        failed++
      } else {
        synced++
        await removeDisputeFromQueue(dispute.id)
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
  events?: { to_status: DisputeStatus; created_at: string; note?: string | null; actor?: string }[]
}

const DISPUTE_COLUMNS =
  'id, parcel_id, submitted_by, description, status, fake_reference_number, created_at, parcel:parcels(demo_village_name, village_id, zone_type)'

function parseEvidenceFromDescription(description: string | null): {
  cleanDescription: string | null
  photos: string[]
  audio: string | null
} {
  if (!description) return { cleanDescription: null, photos: [], audio: null }

  let cleanDescription = description
  const photos: string[] = []
  let audio: string | null = null

  const photoRegex = /\[Photo Evidence:\s*([^\]]+)\]/i
  const photoMatch = cleanDescription.match(photoRegex)
  if (photoMatch && photoMatch[1]) {
    const urls = photoMatch[1].split(',').map((url) => url.trim())
    photos.push(...urls)
    cleanDescription = cleanDescription.replace(photoMatch[0], '')
  }

  const audioRegex = /\[Audio Evidence:\s*([^\]]+)\]/i
  const audioMatch = cleanDescription.match(audioRegex)
  if (audioMatch && audioMatch[1]) {
    audio = audioMatch[1].trim()
    cleanDescription = cleanDescription.replace(audioMatch[0], '')
  }

  cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim()
  if (cleanDescription.endsWith('—')) {
    cleanDescription = cleanDescription.slice(0, -1).trim()
  }

  return { cleanDescription, photos, audio }
}

export async function fetchDisputes(): Promise<Dispute[]> {
  const client = supabase

  // Load offline queued disputes
  const queue = await getDisputeQueue()
  const queuedDisputes: Dispute[] = queue.map((d) => {
    return {
      id: d.id,
      parcel_id: d.parcelId,
      submitted_by: DEMO_SUBMITTER,
      description: [DISPUTE_CATEGORY_LABELS[d.category as DisputeCategory] || d.category, d.note.trim()].filter(Boolean).join(' — '),
      status: 'submitted',
      fake_reference_number: d.id,
      created_at: new Date(d.timestamp).toISOString(),
      parcel: null,
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
        dbDisputes = data.map((row) => {
          const parsed = parseEvidenceFromDescription(row.description)
          return {
            ...row,
            description: parsed.cleanDescription,
            photos: parsed.photos,
            audio: parsed.audio,
            parcel: Array.isArray(row.parcel) ? (row.parcel[0] ?? null) : row.parcel,
          }
        }) as Dispute[]
        cacheDbDisputes(dbDisputes)
      } else {
        dbDisputes = getCachedDbDisputes()
      }
    } catch {
<<<<<<< HEAD
      dbDisputes = getCachedDbDisputes()
=======
      // Offline fallback
>>>>>>> f49bd50c6356d5c7f353daf8fbede4347e757aa0
    }
  } else {
    dbDisputes = getCachedDbDisputes()
  }

  const allDisputes = [...queuedDisputes, ...dbDisputes]

  const overrides = await getDisputeOverrides()
  const localEvents = await getLocalDisputeEvents()

  return allDisputes.map((d) => {
    const override = overrides[d.id] || overrides[d.fake_reference_number]
    const disputeEvents = localEvents
      .filter((e) => e.disputeId === d.id || e.disputeId === d.fake_reference_number)
      .map((e) => ({
        to_status: e.toStatus as DisputeStatus,
        created_at: new Date(e.createdAt).toISOString(),
        note: e.note,
        actor: e.actor,
      }))

    if (override) {
      return {
        ...d,
        status: override.status,
        description: d.description + (override.comment ? ` \n[Officer Remark: ${override.comment}]` : ''),
        events: disputeEvents,
      }
    }
    return {
      ...d,
      events: disputeEvents,
    }
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
  await saveDisputeOverride(disputeId, status, comment)

  const client = supabase
  if (!client) return true // Offline success

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(disputeId)
    const updateData = { status, description: comment ? `Resolved — [Officer remark: ${comment}]` : undefined }
    
    const query = client.from('disputes').update(updateData)
    
    const { error } = isUUID
      ? await query.or(`id.eq.${disputeId},fake_reference_number.eq.${disputeId}`)
      : await query.eq('fake_reference_number', disputeId)
      
    if (error) {
      console.warn('Supabase DB Update error:', error.message)
    }
    return !error
  } catch (err: any) {
    console.warn('Catch error during Supabase status update:', err.message)
    return true
  }
}

export async function fetchDisputeByReference(ref: string): Promise<Dispute | null> {
  const all = await fetchDisputes()
  const needle = ref.trim().toLowerCase()
  return all.find(d => d.fake_reference_number.toLowerCase() === needle || d.id.toLowerCase() === needle) ?? null
}

export async function fetchParcelById(id: string): Promise<Parcel | null> {
  const cached = await getCachedParcels()
  const found = cached.find(p => p.id === id)
  if (found) return found

  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('parcels')
      .select(PARCEL_COLUMNS)
      .eq('id', id)
      .single()
    if (error || !data) return null
    return mapParcelRecord(data)
  } catch {
    return null
  }
}
