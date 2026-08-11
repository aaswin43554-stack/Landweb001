import type { DisputeCategory } from './land'

/**
 * Payload exchanged device-to-device when there is no network: the citizen
 * renders it as a QR code, the field officer scans it.
 *
 * Compact format (v2): GIZ:REF:PARCEL:CAT:NOTE:PC:AU
 * Example: GIZ:0023:0005:b:Fence dispute:0:0  (~35 chars)
 *
 * Category shortcodes: b=boundary w=wrong_info o=ownership x=other
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

const CAT_ENCODE: Record<DisputeCategory, string> = { boundary: 'b', wrong_info: 'w', ownership: 'o', other: 'x' }
const CAT_DECODE: Record<string, DisputeCategory> = { b: 'boundary', w: 'wrong_info', o: 'ownership', x: 'other' }
const MAX_COMPACT_NOTE = 40

/**
 * Encodes payload as a compact pipe-delimited string ~30-50 chars instead of 200+ char JSON.
 * Format: GIZ:REF:PARCEL:CAT:NOTE:PC:AU
 */
export function encodeCompact(payload: SyncPayload): string {
  const note = payload.note.trim().slice(0, MAX_COMPACT_NOTE).replace(/:/g, ';')
  const cat = CAT_ENCODE[payload.category] ?? 'x'
  return `GIZ:${payload.id}:${payload.parcelId}:${cat}:${note}:${payload.photoCount}:${payload.hasAudio ? 1 : 0}`
}

/**
 * Generates a human-friendly 6-character alphanumeric visual code from the compact string.
 * Example: "K4X9A2" — used as the display PIN shown to the citizen.
 */
export function generateVisualPin(compactCode: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let hash = 0
  for (let i = 0; i < compactCode.length; i++) {
    hash = ((hash << 5) - hash + compactCode.charCodeAt(i)) | 0
  }
  let result = ''
  let seed = Math.abs(hash)
  for (let i = 0; i < 6; i++) {
    result += chars[seed % chars.length]
    seed = Math.floor(seed / chars.length) + compactCode.charCodeAt(i % compactCode.length)
  }
  return result
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
  // Use compact format for sharing. Falls back to JSON for QR code compatibility.
  return encodeCompact(payload)
}

/**
 * Accepts a scanned or pasted sync code. Tolerates the older format that
 * had no version field so previously-generated codes still import.
 */
export function parseSyncPayload(raw: string): SyncPayload | null {
  const trimmed = raw.trim().replace(/^\[GIZ-REPORT\]\n?/, '')

  // ── v2 compact format: GIZ:REF:PARCEL:CAT:NOTE:PC:AU ──
  if (trimmed.startsWith('GIZ:')) {
    try {
      const parts = trimmed.split(':')
      if (parts.length < 7) return null
      const [, id, parcelId, cat, note, pc, au] = parts
      if (!id || !parcelId || !cat) return null
      return {
        v: 1,
        id,
        parcelId,
        category: (CAT_DECODE[cat] ?? 'other') as DisputeCategory,
        note: note.replace(/;/g, ':'),
        photoCount: Number(pc) || 0,
        hasAudio: au === '1',
      }
    } catch {
      return null
    }
  }

  // ── v1 legacy JSON format (backwards compatibility) ──
  try {
    const data = JSON.parse(trimmed)
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
