import { useEffect, useState } from 'react'
import {
  getCachedDbDisputes,
  cacheDbDisputes,
  addSyncLog,
} from '../lib/offlineStorage'
import type { Dispute } from '../lib/land'
import {
  requestBluetoothDevice,
  sendDisputesOverP2P,
  listenForIncomingP2PDisputes,
} from '../lib/bluetoothSync'

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
  const [isScanningBt, setIsScanningBt] = useState(false)

  // Listen for live P2P Broadcast Channel transmissions on Officer device
  useEffect(() => {
    const cleanup = listenForIncomingP2PDisputes((count) => {
      setItemCount((prev) => prev + count)
      setSyncState('transferring')
      setProgress(100)
      setSyncState('complete')
      if (onSyncSuccess) onSyncSuccess()
    })
    return cleanup
  }, [onSyncSuccess])

  // Trigger hardware Web Bluetooth device scan prompt
  async function handleHardwareBluetoothScan() {
    setIsScanningBt(true)
    const device = await requestBluetoothDevice()
    setIsScanningBt(false)
    if (device) {
      setTargetDevice(device.name)
      setSyncState('connected')
    }
  }

  useEffect(() => {
    // Search phase timeout
    const searchTimer = setTimeout(() => {
      if (syncState === 'searching') {
        setSyncState('connected')
        if (role === 'citizen') {
          setTargetDevice("Field Officer's Mobile (FO-TABLET-92)")
        } else {
          setTargetDevice("Citizen's Mobile (CIT-PHONE-54)")
        }
      }
    }, 2500)

    return () => clearTimeout(searchTimer)
  }, [role, syncState])

  useEffect(() => {
    if (syncState !== 'connected') return

    const transferTimer = setTimeout(async () => {
      setSyncState('transferring')
      
      let count = 0
      if (role === 'citizen') {
        // Send queued disputes live over P2P Data Channel & localStorage
        const res = await sendDisputesOverP2P()
        count = res.count
        setItemCount(count)
      } else {
        // Officer pulls disputes from P2P storage
        const sharedKey = 'giz-shared-p2p-disputes'
        const sharedDisputes = JSON.parse(localStorage.getItem(sharedKey) || '[]')
        count = sharedDisputes.length
        
        if (count === 0) {
          count = 1
          setItemCount(count)
          
          const mockImported: Dispute = {
            id: `p2p-imported-${Date.now()}`,
            parcel_id: 'DEMO-PARCEL-0026',
            submitted_by: 'Villager (P2P Bluetooth)',
            status: 'submitted',
            fake_reference_number: `DEMO-DSP-P2P-${Date.now().toString().slice(-4)}`,
            created_at: new Date().toISOString(),
            description: 'Boundary Issue — Neighbor claims land overlap at village forest border.',
            parcel: { demo_village_name: 'Ban Silimone', village_id: 'DEMO-VLG-002', zone_type: 'forest' }
          }
          const currentDb = getCachedDbDisputes()
          cacheDbDisputes([mockImported, ...currentDb])
          addSyncLog('Bluetooth P2P: Dispute imported to Officer local device database')
        } else {
          setItemCount(count)
          const currentDb = getCachedDbDisputes()
          const newDisputes: Dispute[] = sharedDisputes.map((d: any) => ({
            id: d.id || `p2p-imported-${Date.now()}`,
            parcel_id: d.parcelId,
            submitted_by: 'Villager (P2P Bluetooth)',
            status: 'submitted',
            fake_reference_number: d.id.includes('DEMO-DSP') ? d.id : `DEMO-DSP-${Date.now().toString().slice(-4)}`,
            created_at: new Date(d.timestamp || Date.now()).toISOString(),
            description: `${(d.category || 'Issue').toUpperCase()} — ${d.note || ''}`,
            parcel: { demo_village_name: 'Ban Namdeng', village_id: 'DEMO-VLG-001', zone_type: 'forest' },
            photos: d.photos || [],
            audio: d.audio || null
          }))
          
          const mergedDb = [...currentDb]
          for (const dispute of newDisputes) {
            if (!mergedDb.some(d => d.id === dispute.id || d.fake_reference_number === dispute.fake_reference_number)) {
              mergedDb.unshift(dispute)
            }
          }
          
          cacheDbDisputes(mergedDb)
          localStorage.removeItem(sharedKey)
          addSyncLog(`Bluetooth P2P: Imported ${count} disputes via peer network`)
        }
      }
      
      let currentProgress = 0
      const interval = setInterval(() => {
        currentProgress += 20
        setProgress(currentProgress)
        if (currentProgress >= 100) {
          clearInterval(interval)
          setSyncState('complete')
          if (onSyncSuccess) onSyncSuccess()
        }
      }, 100)
      
    }, 1500)

    return () => clearTimeout(transferTimer)
  }, [syncState, role, onSyncSuccess])

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Background Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:16px_16px] opacity-5 pointer-events-none" />

        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors z-10 cursor-pointer"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Heading */}
        <div className="text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            0% Internet Required
          </span>
          <h3 className="text-xl font-extrabold text-slate-800 mt-2">P2P Bluetooth Data Transfer</h3>
        </div>

        {/* Device Pairing Container */}
        <div className="w-48 h-48 flex items-center justify-center relative">
          
          {syncState === 'searching' && (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
              <div className="w-24 h-24 rounded-full border-4 border-emerald-500 bg-emerald-500/10 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-3xl animate-pulse">📶</span>
              </div>
              <div className="absolute w-40 h-40 rounded-full border-2 border-emerald-500/30 animate-pulse duration-1000" />
              <div className="absolute w-28 h-28 rounded-full border-2 border-emerald-500/20 animate-pulse duration-700" />
            </div>
          )}

          {syncState === 'connected' && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full bg-blue-100 border-4 border-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-3xl">
                🤝
              </div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Paired Bluetooth Device
              </p>
            </div>
          )}

          {syncState === 'transferring' && (
            <div className="flex flex-col items-center gap-3 w-full px-4">
              <div className="relative w-28 h-28 flex items-center justify-center">
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

          {syncState === 'complete' && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20 text-4xl">
                ✅
              </div>
              <p className="text-xs font-extrabold text-emerald-700 uppercase tracking-widest">
                Transferred
              </p>
            </div>
          )}
        </div>

        {/* Informational Logs */}
        <div className="w-full text-center px-4">
          {syncState === 'searching' && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-600">Searching for nearby Field Officer devices...</p>
              <button
                type="button"
                onClick={handleHardwareBluetoothScan}
                disabled={isScanningBt}
                className="py-2 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow cursor-pointer active:scale-98 transition-all"
              >
                {isScanningBt ? 'Scanning Hardware Bluetooth...' : '🔍 Scan Hardware Bluetooth Devices'}
              </button>
            </div>
          )}

          {syncState === 'connected' && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-slate-800">Connected to Field Officer Device</p>
              <p className="text-xs text-slate-500 font-semibold">{targetDevice}</p>
            </div>
          )}

          {syncState === 'transferring' && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-slate-700">
                {role === 'citizen' 
                  ? `Sending ${itemCount} dispute report(s)...`
                  : `Receiving dispute reports from villager phone...`
                }
              </p>
              <p className="text-xs font-semibold text-emerald-600 animate-pulse">
                Encrypting & saving into Officer local database
              </p>
            </div>
          )}

          {syncState === 'complete' && (
            <div className="flex flex-col gap-1">
              <p className="text-base font-black text-slate-800">Transfer Complete!</p>
              <p className="text-xs font-semibold text-slate-500">
                {role === 'citizen'
                  ? `Report successfully sent to Officer's mobile storage.`
                  : `Successfully saved ${itemCount} report(s) into local device storage.`
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
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
