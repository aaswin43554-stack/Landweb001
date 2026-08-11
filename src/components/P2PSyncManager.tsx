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

type DiscoveredDevice = {
  id: string
  name: string
  role: string
  signal: 'strong' | 'medium'
  isOfficer: boolean
}

const DEFAULT_DISCOVERED_DEVICES: DiscoveredDevice[] = [
  {
    id: 'fo-tab-92',
    name: "Officer Tablet (Ban Namdeng Field Agent)",
    role: "Field Officer Device (FO-TABLET-92)",
    signal: 'strong',
    isOfficer: true,
  },
  {
    id: 'fo-mob-44',
    name: "Officer Phone (District Inspector)",
    role: "Field Officer Device (FO-MOBILE-44)",
    signal: 'medium',
    isOfficer: true,
  },
]

export function P2PSyncManager({ role, onClose, onSyncSuccess }: Props) {
  const [syncState, setSyncState] = useState<SyncState>('searching')
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>(DEFAULT_DISCOVERED_DEVICES)
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
      const newDev: DiscoveredDevice = {
        id: device.id,
        name: device.name,
        role: 'Discovered Bluetooth Device',
        signal: 'strong',
        isOfficer: true,
      }
      setDiscoveredDevices((prev) => [newDev, ...prev])
    }
  }

  // Handle citizen manually clicking on an officer device from the list
  async function handleSelectDevice(device: DiscoveredDevice) {
    setTargetDevice(device.name)
    setSyncState('connected')

    setTimeout(async () => {
      setSyncState('transferring')

      let count = 0
      if (role === 'citizen') {
        const res = await sendDisputesOverP2P()
        count = res.count
        setItemCount(count)
      } else {
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
            parcel: { demo_village_name: 'Ban Silimone', village_id: 'DEMO-VLG-002', zone_type: 'forest' },
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
            audio: d.audio || null,
          }))

          const mergedDb = [...currentDb]
          for (const dispute of newDisputes) {
            if (!mergedDb.some((d) => d.id === dispute.id || d.fake_reference_number === dispute.fake_reference_number)) {
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
        currentProgress += 25
        setProgress(currentProgress)
        if (currentProgress >= 100) {
          clearInterval(interval)
          setSyncState('complete')
          if (onSyncSuccess) onSyncSuccess()
        }
      }, 100)
    }, 1200)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
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
          <h3 className="text-xl font-extrabold text-slate-800 mt-2">
            {role === 'citizen' ? 'Select Officer Bluetooth Device' : 'Field Officer P2P Receiver'}
          </h3>
        </div>

        {/* Dynamic State View */}
        {syncState === 'searching' && (
          <div className="w-full flex flex-col items-center gap-4">
            {role === 'citizen' ? (
              <>
                <p className="text-xs font-semibold text-slate-500 text-center">
                  Nearby Bluetooth devices found. <strong>Click your Field Officer&apos;s device</strong> below to send your report:
                </p>

                {/* Discovered Device List */}
                <div className="w-full flex flex-col gap-2.5">
                  {discoveredDevices.map((dev) => (
                    <button
                      key={dev.id}
                      type="button"
                      onClick={() => handleSelectDevice(dev)}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl border-2 border-emerald-600/30 bg-emerald-50/50 hover:bg-emerald-100 active:scale-98 transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow">
                          📱
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                            {dev.name}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">{dev.role}</p>
                        </div>
                      </div>

                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-200/60 px-2.5 py-1 rounded-full shrink-0">
                        {dev.signal === 'strong' ? '📶 Strong' : '📶 Medium'}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleHardwareBluetoothScan}
                  disabled={isScanningBt}
                  className="w-full py-2.5 px-3 text-xs font-extrabold bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow cursor-pointer active:scale-98 transition-all mt-1"
                >
                  {isScanningBt ? 'Scanning Browser Bluetooth...' : '🔍 Scan Hardware Bluetooth Prompt'}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center shadow-lg text-3xl animate-pulse">
                  📡
                </div>
                <p className="text-sm font-bold text-slate-800">Officer Receiver Mode Active</p>
                <p className="text-xs text-slate-500">
                  Listening for incoming citizen land reports via Bluetooth P2P channel...
                </p>
              </div>
            )}
          </div>
        )}

        {syncState === 'connected' && (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="w-24 h-24 rounded-full bg-blue-100 border-4 border-blue-500 flex items-center justify-center shadow-lg text-3xl">
              🤝
            </div>
            <p className="text-sm font-bold text-blue-600">Connecting to {targetDevice}...</p>
          </div>
        )}

        {syncState === 'transferring' && (
          <div className="flex flex-col items-center gap-3 w-full px-4 py-4">
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
            <p className="text-xs font-semibold text-emerald-600 animate-pulse">
              Transferring dispute report directly over Bluetooth peer channel...
            </p>
          </div>
        )}

        {syncState === 'complete' && (
          <div className="flex flex-col items-center gap-2 text-center py-2">
            <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center shadow-lg text-4xl">
              ✅
            </div>
            <p className="text-base font-black text-slate-800 mt-1">Transfer Complete!</p>
            <p className="text-xs font-semibold text-slate-500 max-w-xs">
              {role === 'citizen'
                ? `Report successfully sent to Officer (${targetDevice}). It will automatically upload to Supabase when the officer gets internet.`
                : `Successfully received and saved ${itemCount} report(s) into Officer local device database.`}
            </p>
          </div>
        )}

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
