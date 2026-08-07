import type { DisputeCategory } from './land'

/**
 * Payload exchanged device-to-device when there is no network: the citizen
 * renders it as a QR code, the field officer scans it.
 *
 * Photos and audio are deliberately NOT included. A single base64 photo is
 * hundreds of kilobytes and a QR code tops out around 3KB, so embedding
 * media would produce a code no camera could read. The payload instead
 * records how much evidence is waiting on the citizen's device, and that
 * media syncs normally once either device reaches a network.
 */
export type SyncPayload = {
  v: 1
  id: string
  parcelId: string
  category: DisputeCategory
  note: string
  photoCount: number
  hasAudio: boolean
}

const MAX_NOTE_LENGTH = 600

export function buildSyncPayload(input: {
  referenceNumber: string
  parcelId: string
  category: DisputeCategory
  note: string
  photos: string[]
  audio: string | null
}): SyncPayload {
  return {
    v: 1,
    id: input.referenceNumber,
    parcelId: input.parcelId,
    category: input.category,
    note: input.note.trim().slice(0, MAX_NOTE_LENGTH),
    photoCount: input.photos.length,
    hasAudio: Boolean(input.audio),
  }
}

export function encodeSyncPayload(payload: SyncPayload): string {
  return JSON.stringify(payload)
}

/**
 * Accepts a scanned or pasted sync code. Tolerates the older format that
 * had no version field so previously-generated codes still import.
 */
export function parseSyncPayload(raw: string): SyncPayload | null {
  try {
    const data = JSON.parse(raw.trim())
    if (!data || typeof data !== 'object') return null
    if (!data.id || !data.parcelId || !data.category) return null

    return {
      v: 1,
      id: String(data.id),
      parcelId: String(data.parcelId),
      category: data.category as DisputeCategory,
      note: typeof data.note === 'string' ? data.note : '',
      photoCount: Number(data.photoCount) || (Array.isArray(data.photos) ? data.photos.length : 0),
      hasAudio: Boolean(data.hasAudio ?? data.audio),
    }
  } catch {
    return null
  }
}
