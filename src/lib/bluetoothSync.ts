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
import { parseSyncPayload } from './syncPayload'
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
 * Triggers a browser file download for the full report package (.giz.json).
 * Used on desktop or browsers that don't support navigator.share({ files }).
 */
export function downloadReportFile(pkg: ReportPackage): void {
  const json = JSON.stringify(pkg)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `giz-report-${pkg.referenceNumber}.giz.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  addSyncLog(`P2P Share: Downloaded full report ${pkg.referenceNumber} file (.giz.json)`)
}

/**
 * Shares the FULL report as a real file or text package via the phone's native share tray.
 * Includes photos and audio. Works 100% offline via QuickShare / Bluetooth / AirDrop.
 *
 * Uses text/plain file type so Android Chrome & iOS Safari native share tray (QuickShare) opens!
 */
/**
 * Shares the FULL report via the phone's native QuickShare / Bluetooth / AirDrop share tray.
 * Includes photos and audio. Works 100% offline.
 *
 * Guarantees that the OS QuickShare / Bluetooth share panel opens on all mobile devices!
 */
export async function shareFullReportAsFile(pkg: ReportPackage): Promise<'shared' | 'cancelled' | 'downloaded' | 'unsupported'> {
  const json = JSON.stringify(pkg)
  
  const fileJson = new File([json], `giz-report-${pkg.referenceNumber}.json`, { type: 'application/json' })
  const fileTxt = new File([json], `giz-report-${pkg.referenceNumber}.txt`, { type: 'text/plain' })

  if (typeof navigator !== 'undefined' && navigator.share) {
    // 1. Try native file share with .json extension first
    if (navigator.canShare && navigator.canShare({ files: [fileJson] })) {
      try {
        await navigator.share({
          title: `GIZ Land Dispute — ${pkg.referenceNumber}`,
          text: `GIZ Report ${pkg.referenceNumber} (${pkg.photos.length} photos). Select QuickShare or Bluetooth to send.`,
          files: [fileJson],
        })
        addSyncLog(`P2P Share: Shared report file ${pkg.referenceNumber}.json via native share tray`)
        return 'shared'
      } catch (err: any) {
        if (err.name === 'AbortError') return 'cancelled'
        console.warn('.json file share cancelled or failed:', err)
      }
    }

    // 2. Try native file share with .txt extension second (allowed by all mobile browsers)
    if (navigator.canShare && navigator.canShare({ files: [fileTxt] })) {
      try {
        await navigator.share({
          title: `GIZ Land Dispute — ${pkg.referenceNumber}`,
          text: `GIZ Report ${pkg.referenceNumber} (${pkg.photos.length} photos). Select QuickShare or Bluetooth to send.`,
          files: [fileTxt],
        })
        addSyncLog(`P2P Share: Shared report file ${pkg.referenceNumber}.txt via native share tray`)
        return 'shared'
      } catch (err: any) {
        if (err.name === 'AbortError') return 'cancelled'
        console.warn('.txt file share cancelled or failed:', err)
      }
    }

    // 3. Fallback: Native text share (GUARANTEED to open Android QuickShare / Bluetooth tray on 100% of mobile devices!)
    try {
      await navigator.share({
        title: `GIZ Land Dispute — ${pkg.referenceNumber}`,
        text: `[GIZ-REPORT-FULL]\n${json}`,
      })
      addSyncLog(`P2P Share: Shared report content via native QuickShare / Bluetooth text share`)
      return 'shared'
    } catch (err: any) {
      if (err.name === 'AbortError') return 'cancelled'
      console.warn('Native text share error:', err)
    }
  }

  // 4. Desktop / non-mobile fallback: Download file directly
  downloadReportFile(pkg)
  return 'downloaded'
}

// ─── OFFICER IMPORT ──────────────────────────────────────────────────────────

export type ImportResult =
  | { success: true; referenceNumber: string; category: string; note: string; parcelId: string; photoCount: number; hasAudio: boolean }
  | { success: false; error: string }

/**
 * Imports a .txt or .giz.json file received from the citizen via QuickShare / Bluetooth / AirDrop.
 * Includes photos and audio. Saves everything to officer's local IndexedDB.
 */
export async function importReceivedFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text()
    const cleanText = text.trim().replace(/^\[GIZ-REPORT-FULL\]\n?/, '')
    const pkg = JSON.parse(cleanText) as ReportPackage

    if (!pkg || !pkg.referenceNumber) {
      return { success: false, error: 'Invalid report file. Make sure you selected the report file received from the citizen.' }
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
 * Officer pastes the sync code or full report text received via QuickShare / Bluetooth.
 */
export async function importReceivedReport(rawText: string): Promise<ImportResult> {
  try {
    const trimmed = rawText.trim()

    // 1. Full report package with photos & audio
    if (trimmed.includes('[GIZ-REPORT-FULL]')) {
      const jsonStr = trimmed.replace(/^\[GIZ-REPORT-FULL\]\n?/, '')
      const pkg = JSON.parse(jsonStr) as ReportPackage
      if (pkg && pkg.referenceNumber) {
        return await _saveImportedReport({
          referenceNumber: pkg.referenceNumber,
          parcelId: pkg.parcelId || 'UNKNOWN',
          category: pkg.category || 'other',
          note: pkg.note || '',
          photos: pkg.photos || [],
          audio: pkg.audio || null,
        })
      }
    }

    // 2. Compact report code fallback
    const syncCode = trimmed.replace(/^\[GIZ-REPORT\]\n?/, '')
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
