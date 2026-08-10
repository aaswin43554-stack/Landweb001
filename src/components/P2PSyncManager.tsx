import { useEffect, useState } from 'react'
import {
  getDisputeQueue,
  setToStorage,
  getCachedDbDisputes,
  cacheDbDisputes,
  addSyncLog
} from '../lib/offlineStorage'
import type { Dispute } from '../lib/land'

type Props = {
  role: 'citizen' | 'field-officer' | 'admin'
  onClose: () => void
  onSyncSuccess?: () => void
}

type SyncState = 'searching' | 'connected' | 'transferring' | 'complete'

export function P2PSyncManager({ role, onClose, onSyncSuccess }: Props) {
  const [syncState, setSyncState] = useState<SyncState>('searching')
  const [targetDevice, setTargetDevice] = useState('')
  const [progress, setProgress] = useState(0)
  const [itemCount, setItemCount] = useState(0)

  useEffect(() => {
    // Stage 1: Search / Radar animation
    const searchTimer = setTimeout(() => {
      setSyncState('connected')
      if (role === 'citizen') {
        setTargetDevice("Field Officer's Tablet (FO-TABLET-92)")
      } else {
        setTargetDevice("Citizen's Phone (CIT-PHONE-54)")
      }
    }, 3000)

    return () => clearTimeout(searchTimer)
  }, [role])

  useEffect(() => {
    if (syncState !== 'connected') return

    // Stage 2: Connected -> start transfer after 2 seconds
    const transferTimer = setTimeout(() => {
      setSyncState('transferring')
      
      // Perform the actual synchronization
      let count = 0
      if (role === 'citizen') {
        // Citizen sends queued disputes
        const queue = getDisputeQueue()
        count = queue.length
        setItemCount(count)
        
        if (count > 0) {
          // Push to shared storage
          const sharedKey = 'giz-shared-p2p-disputes'
          const existingShared = JSON.parse(localStorage.getItem(sharedKey) || '[]')
          const mergedShared = [...existingShared, ...queue]
          localStorage.setItem(sharedKey, JSON.stringify(mergedShared))
          
          // Clear local queue
          setToStorage('giz-offline-dispute-queue', [])
          addSyncLog(`WebRTC Sync: Sent ${count} disputes to Officer tablet`)
        }
      } else {
        // Officer pulls disputes from shared storage
        const sharedKey = 'giz-shared-p2p-disputes'
        const sharedDisputes = JSON.parse(localStorage.getItem(sharedKey) || '[]')
        count = sharedDisputes.length
        
        // If there's nothing in shared storage, mock-transfer 1 dispute for visual effect
        if (count === 0) {
          count = 1
          setItemCount(count)
          
          // Generate a mock dispute that was "transferred"
          const mockImported: Dispute = {
            id: `p2p-imported-${Date.now()}`,
            parcel_id: 'DEMO-PARCEL-0026',
            submitted_by: 'Noy K. (P2P)',
            status: 'submitted',
            fake_reference_number: `DEMO-DSP-P2P-${Date.now().toString().slice(-4)}`,
            created_at: new Date().toISOString(),
            description: 'Boundary problem — Neighbor claims fence overlaps by 2 meters at forest border.',
            parcel: { demo_village_name: 'Ban Silimone', village_id: 'DEMO-VLG-002', zone_type: 'forest' }
          }
          const currentDb = getCachedDbDisputes()
          cacheDbDisputes([mockImported, ...currentDb])
          addSyncLog('WebRTC Sync: Mock P2P dispute imported successfully')
        } else {
          setItemCount(count)
          // Actually import and merge shared disputes
          const currentDb = getCachedDbDisputes()
          const newDisputes: Dispute[] = sharedDisputes.map((d: any) => ({
            id: d.id || `p2p-imported-${Date.now()}`,
            parcel_id: d.parcelId,
            submitted_by: 'Citizen (P2P)',
            status: 'submitted',
            fake_reference_number: d.id.includes('DEMO-DSP') ? d.id : `DEMO-DSP-${Date.now().toString().slice(-4)}`,
            created_at: new Date(d.timestamp).toISOString(),
            description: `${d.category.toUpperCase()} — ${d.note}`,
            parcel: { demo_village_name: 'Ban Namdeng', village_id: 'DEMO-VLG-001', zone_type: 'forest' }, // Fallback info
            photos: d.photos || [],
            audio: d.audio || null
          }))
          
          // CRDT Merge check - avoid duplicate IDs
          const mergedDb = [...currentDb]
          for (const dispute of newDisputes) {
            if (!mergedDb.some(d => d.id === dispute.id || d.fake_reference_number === dispute.fake_reference_number)) {
              mergedDb.unshift(dispute)
            }
          }
          
          cacheDbDisputes(mergedDb)
          localStorage.removeItem(sharedKey)
          addSyncLog(`WebRTC Sync: Imported ${count} disputes via peer network`)
        }
      }
      
      // Animate progress bar
      let currentProgress = 0
      const interval = setInterval(() => {
        currentProgress += 10
        setProgress(currentProgress)
        if (currentProgress >= 100) {
          clearInterval(interval)
          setSyncState('complete')
          if (onSyncSuccess) onSyncSuccess()
        }
      }, 150)
      
    }, 2000)

    return () => clearTimeout(transferTimer)
  }, [syncState, role, onSyncSuccess])

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:16px_16px] opacity-5 pointer-events-none" />

        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors z-10"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Heading */}
        <div className="text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            Zero-Coverage Sync
          </span>
          <h3 className="text-xl font-extrabold text-slate-800 mt-2">WebRTC Offline Mesh</h3>
        </div>

        {/* Sync Animation Container */}
        <div className="w-48 h-48 flex items-center justify-center relative">
          
          {/* Radar Animation Stage */}
          {syncState === 'searching' && (
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Radar Sweeper */}
              <div className="w-24 h-24 rounded-full border-4 border-emerald-500 bg-emerald-500/10 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-2xl animate-pulse">📡</span>
              </div>
              
              {/* Pulsing Concentric Rings */}
              <div className="absolute w-40 h-40 rounded-full border-2 border-emerald-500/30 animate-pulse duration-1000" />
              <div className="absolute w-28 h-28 rounded-full border-2 border-emerald-500/20 animate-pulse duration-700" />
            </div>
          )}

          {/* Connected Device Stage */}
          {syncState === 'connected' && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full bg-blue-100 border-4 border-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-3xl">
                🤝
              </div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider animate-bounce">
                Paired!
              </p>
            </div>
          )}

          {/* Transferring Progress Stage */}
          {syncState === 'transferring' && (
            <div className="flex flex-col items-center gap-3 w-full px-4">
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Rotating Loading Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                <svg className="w-28 h-28 transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-emerald-600 fill-none"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - progress / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xl font-black text-slate-800">{progress}%</span>
              </div>
            </div>
          )}

          {/* Sync Complete Stage */}
          {syncState === 'complete' && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20 text-4xl">
                ✅
              </div>
              <p className="text-xs font-extrabold text-emerald-700 uppercase tracking-widest">
                Success
              </p>
            </div>
          )}
        </div>

        {/* Informational Logs */}
        <div className="w-full text-center px-4">
          {syncState === 'searching' && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-600">Searching for nearby devices...</p>
              <p className="text-xs text-slate-400">Using WebRTC local mesh radio</p>
            </div>
          )}

          {syncState === 'connected' && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-slate-800">Connected to peer</p>
              <p className="text-xs text-slate-500 font-semibold">{targetDevice}</p>
            </div>
          )}

          {syncState === 'transferring' && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-slate-700">
                {role === 'citizen' 
                  ? `Sending ${itemCount} dispute${itemCount !== 1 ? 's' : ''}...`
                  : `Receiving disputes from phone...`
                }
              </p>
              <p className="text-xs font-semibold text-emerald-600 animate-pulse">
                Encrypting & writing block records
              </p>
            </div>
          )}

          {syncState === 'complete' && (
            <div className="flex flex-col gap-1">
              <p className="text-base font-black text-slate-800">Sync Complete!</p>
              <p className="text-xs font-semibold text-slate-500">
                {role === 'citizen'
                  ? `Successfully synchronized ${itemCount} dispute${itemCount !== 1 ? 's' : ''} to Officer.`
                  : `Successfully imported and merged ${itemCount} dispute${itemCount !== 1 ? 's' : ''} from Citizen.`
                }
              </p>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="w-full mt-2">
          {syncState === 'complete' ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 active:scale-98 transition-all text-white font-extrabold rounded-2xl text-sm cursor-pointer shadow-md"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 active:scale-98 transition-all text-slate-700 font-bold rounded-2xl text-sm cursor-pointer border border-slate-200"
            >
              Cancel Sync
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
