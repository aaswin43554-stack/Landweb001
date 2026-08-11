/**
 * P2P Offline Bluetooth Share Module
 *
 * HOW IT WORKS:
 * ─────────────────────────────────────────────────
 * navigator.share({ files: [...] }) opens the phone's NATIVE share tray
 * (QuickShare, AirDrop, Nearby Share, Bluetooth) and can transfer ACTUAL FILES
 * including photos and audio — completely offline, 0% internet required.
 *
 * The full report (text + photos base64 + audio base64) is packaged into a single
 * .giz.json file and shared as a real file via the OS native share panel.
 *
 * Officer receives the file → opens app → taps "Import File" → all data including
 * photos and audio is saved to officer's device → auto-syncs to Supabase when internet available.
 */

import { queueDispute, addSyncLog, getCachedDbDisputes, cacheDbDisputes, getDisputeQueue } from './offlineStorage'
import { parseSyncPayload, encodeCompact, buildSyncPayload } from './syncPayload'
import type { Dispute } from './land'

// ─── FULL REPORT PACKAGE (includes photos + audio) ──────────────────────────

export type ReportPackage = {
  version: 2
  referenceNumber: string
  parcelId: string
  category: string
  note: string
  photos: string[]      // base64 data URLs
  audio: string | null  // base64 data URL
  timestamp: number
}

/**
 * Builds a complete report package including photos and audio from the local queue.
 */
export async function buildReportPackage(): Promise<ReportPackage | null> {
  const queue = await getDisputeQueue()
  const latest = queue[0]
  if (!latest) return null

  return {
    version: 2,
    referenceNumber: latest.referenceNumber,
    parcelId: latest.parcelId,
    category: latest.category,
    note: latest.note,
    photos: latest.photos ?? [],
    audio: latest.audio ?? null,
    timestamp: latest.timestamp ?? Date.now(),
  }
}

/**
 * Shares the FULL report as a real file via the phone's native share tray.
 * Includes photos and audio. Works 100% offline via Bluetooth / AirDrop / QuickShare.
 *
 * Officer receives a .giz.json file — they open the app and import it.
 */
export async function shareFullReportAsFile(pkg: ReportPackage): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const json = JSON.stringify(pkg)
  const blob = new Blob([json], { type: 'application/json' })
  const file = new File([blob], `giz-report-${pkg.referenceNumber}.giz.json`, { type: 'application/json' })

  // Try file sharing (supported on Android Chrome, iOS Safari 15.1+)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `GIZ Land Dispute — ${pkg.referenceNumber}`,
        text: `Land dispute report with ${pkg.photos.length} photo(s). Open GIZ app to import.`,
        files: [file],
      })
      addSyncLog(`P2P Share: Citizen shared full report ${pkg.referenceNumber} (${pkg.photos.length} photos, audio: ${!!pkg.audio}) via native file share`)
      return 'shared'
    } catch (err: any) {
      if (err.name === 'AbortError') return 'cancelled'
      // Fall through to text-only share
    }
  }

  // Fallback: share as text (no photos/audio, just the compact report code)
  if (navigator.share) {
    try {
      const payload = buildSyncPayload({
        referenceNumber: pkg.referenceNumber,
        parcelId: pkg.parcelId,
        category: pkg.category as any,
        note: pkg.note,
        photos: pkg.photos,
        audio: pkg.audio,
      })
      const compact = encodeCompact(payload)
      await navigator.share({
        title: `GIZ Land Dispute — ${pkg.referenceNumber}`,
        text: `[GIZ-REPORT]\n${compact}`,
      })
      addSyncLog(`P2P Share: Citizen shared compact report ${pkg.referenceNumber} (text only, photos not included)`)
      return 'shared'
    } catch (err: any) {
      if (err.name === 'AbortError') return 'cancelled'
    }
  }

  return 'unsupported'
}

// ─── OFFICER IMPORT ──────────────────────────────────────────────────────────

export type ImportResult =
  | { success: true; referenceNumber: string; category: string; note: string; parcelId: string; photoCount: number; hasAudio: boolean }
  | { success: false; error: string }

/**
 * Imports a .giz.json file received from the citizen via Bluetooth/AirDrop.
 * Includes photos and audio. Saves everything to officer's local IndexedDB.
 */
export async function importReceivedFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text()
    const pkg = JSON.parse(text) as ReportPackage

    if (!pkg || pkg.version !== 2 || !pkg.referenceNumber) {
      return { success: false, error: 'Invalid report file. Make sure you selected the .giz.json file received from the citizen.' }
    }

    return await _saveImportedReport({
      referenceNumber: pkg.referenceNumber,
      parcelId: pkg.parcelId || 'UNKNOWN',
      category: pkg.category || 'other',
      note: pkg.note || '',
      photos: pkg.photos || [],
      audio: pkg.audio || null,
    })
  } catch (err: any) {
    return { success: false, error: `Failed to read file: ${err.message || 'Unknown error'}` }
  }
}

/**
 * Officer pastes the compact sync code received via Bluetooth text share.
 * Photos and audio NOT included (text-only fallback).
 */
export async function importReceivedReport(rawText: string): Promise<ImportResult> {
  try {
    const syncCode = rawText.trim().replace(/^\[GIZ-REPORT\]\n?/, '')

    if (!syncCode) {
      return { success: false, error: 'Empty sync code. Please paste the full text received from the citizen device.' }
    }

    const payload = parseSyncPayload(syncCode)

    if (!payload || !payload.id) {
      return { success: false, error: 'Invalid report code. Make sure you pasted the entire text message received from the citizen.' }
    }

    return await _saveImportedReport({
      referenceNumber: payload.id,
      parcelId: payload.parcelId || 'UNKNOWN',
      category: payload.category || 'other',
      note: payload.note || '',
      photos: [],
      audio: null,
    })
  } catch (err: any) {
    return { success: false, error: `Failed to decode report: ${err.message || 'Unknown error'}` }
  }
}

async function _saveImportedReport(data: {
  referenceNumber: string
  parcelId: string
  category: string
  note: string
  photos: string[]
  audio: string | null
}): Promise<ImportResult> {
  // Queue into officer's offline IndexedDB for later Supabase sync
  await queueDispute({
    id: `p2p-bt-${data.referenceNumber}`,
    referenceNumber: data.referenceNumber,
    parcelId: data.parcelId,
    category: data.category,
    note: data.note,
    photos: data.photos,
    audio: data.audio,
  })

  // Add to the local dispute cache so it immediately shows in the Officer dashboard
  const currentDb = getCachedDbDisputes()
  const alreadyExists = currentDb.some(d => d.fake_reference_number === data.referenceNumber)
  if (!alreadyExists) {
    const newDispute: Dispute = {
      id: `p2p-bt-${data.referenceNumber}`,
      parcel_id: data.parcelId,
      submitted_by: 'Citizen (P2P Bluetooth Transfer)',
      status: 'submitted',
      fake_reference_number: data.referenceNumber,
      created_at: new Date().toISOString(),
      description: `${data.category.toUpperCase()} — ${data.note}`,
      parcel: { demo_village_name: 'Received via Bluetooth', village_id: 'UNKNOWN', zone_type: 'forest' },
      photos: data.photos,
      audio: data.audio,
    }
    cacheDbDisputes([newDispute, ...currentDb])
  }

  addSyncLog(`P2P Import: Officer saved report ${data.referenceNumber} (${data.photos.length} photos, audio: ${!!data.audio}). Queued for Supabase sync.`)

  return {
    success: true,
    referenceNumber: data.referenceNumber,
    category: data.category,
    note: data.note,
    parcelId: data.parcelId,
    photoCount: data.photos.length,
    hasAudio: !!data.audio,
  }
}
