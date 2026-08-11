/**
 * P2P Offline Bluetooth Share Module
 *
 * HOW REAL OFFLINE TRANSFER WORKS FROM A WEB APP:
 * ─────────────────────────────────────────────────
 * Web browsers cannot open raw Bluetooth sockets directly (OS security restriction).
 * The only real way a web app can trigger actual offline wireless transfer is via
 * navigator.share() — which opens the phone's NATIVE share tray (QuickShare, AirDrop,
 * Nearby Share, Bluetooth). The citizen selects their method and the report sync code
 * is sent wirelessly with 0% internet.
 *
 * Officer device receives the text and pastes it into the Officer app import box.
 * When officer later gets internet, the report auto-uploads to Supabase.
 */

import { queueDispute, addSyncLog, getCachedDbDisputes, cacheDbDisputes } from './offlineStorage'
import { parseSyncPayload } from './syncPayload'
import type { Dispute } from './land'

// ─── CITIZEN SIDE ──────────────────────────────────────────────────────────────

/**
 * Opens the phone's NATIVE share tray (Bluetooth / QuickShare / AirDrop / Nearby Share).
 * Works with 0% internet. The report sync code is sent wirelessly via the phone OS.
 */
export async function shareReportViaBluetooth(
  syncCode: string,
  referenceNumber: string
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (!navigator.share) {
    return 'unsupported'
  }

  try {
    await navigator.share({
      title: `GIZ Land Dispute Report — Ref: ${referenceNumber}`,
      text: `[GIZ-REPORT]\n${syncCode}`,
    })
    addSyncLog(`P2P Share: Citizen shared report ${referenceNumber} via native Bluetooth/QuickShare`)
    return 'shared'
  } catch (err: any) {
    if (err.name === 'AbortError') return 'cancelled'
    console.warn('Native share failed:', err)
    return 'unsupported'
  }
}

// ─── OFFICER SIDE ──────────────────────────────────────────────────────────────

export type ImportResult =
  | { success: true; referenceNumber: string; category: string; note: string; parcelId: string }
  | { success: false; error: string }

/**
 * Officer pastes the raw sync code received via Bluetooth/QuickShare.
 * Decodes and stores the dispute into local IndexedDB.
 * Auto-queues for Supabase upload when internet is restored.
 */
export async function importReceivedReport(rawText: string): Promise<ImportResult> {
  try {
    // Strip the [GIZ-REPORT] prefix if the officer pasted the full message text
    const syncCode = rawText.trim().replace(/^\[GIZ-REPORT\]\n?/, '')

    if (!syncCode) {
      return { success: false, error: 'Empty sync code. Please paste the full text received from the citizen device.' }
    }

    const payload = parseSyncPayload(syncCode)

    if (!payload || !payload.id) {
      return { success: false, error: 'Invalid report code. Make sure you pasted the entire text message received from the citizen.' }
    }

    // Queue into officer's offline IndexedDB for later Supabase sync
    await queueDispute({
      id: `p2p-bt-${payload.id}`,
      referenceNumber: payload.id,
      parcelId: payload.parcelId || 'UNKNOWN',
      category: payload.category || 'other',
      note: payload.note || '',
      photos: [],
      audio: null,
    })

    // Also add to the local dispute cache so it immediately shows in the Officer dashboard
    const currentDb = getCachedDbDisputes()
    const alreadyExists = currentDb.some(d => d.fake_reference_number === payload.id)
    if (!alreadyExists) {
      const newDispute: Dispute = {
        id: `p2p-bt-${payload.id}`,
        parcel_id: payload.parcelId || 'UNKNOWN',
        submitted_by: 'Citizen (P2P Bluetooth Transfer)',
        status: 'submitted',
        fake_reference_number: payload.id,
        created_at: new Date().toISOString(),
        description: `${(payload.category || 'other').toUpperCase()} — ${payload.note || ''}`,
        parcel: { demo_village_name: 'Received via Bluetooth', village_id: 'UNKNOWN', zone_type: 'forest' },
        photos: [],
        audio: null,
      }
      cacheDbDisputes([newDispute, ...currentDb])
    }

    addSyncLog(`P2P Import: Officer saved report ${payload.id} from citizen Bluetooth transfer. Queued for Supabase sync.`)

    return {
      success: true,
      referenceNumber: payload.id,
      category: payload.category || 'other',
      note: payload.note || '',
      parcelId: payload.parcelId || 'UNKNOWN',
    }
  } catch (err: any) {
    console.error('Import error:', err)
    return { success: false, error: `Failed to decode report: ${err.message || 'Unknown error'}` }
  }
}
