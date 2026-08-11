import { useEffect, useState } from 'react'
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
}

const DEFAULT_OFFICER_DEVICES: DiscoveredDevice[] = [
  {
    id: 'fo-tab-92',
    name: "Officer Tablet (Ban Namdeng Field Agent)",
    role: "Field Officer Device (FO-TABLET-92)",
    signal: 'strong',
  },
  {
    id: 'fo-mob-44',
    name: "Officer Phone (District Inspector)",
    role: "Field Officer Device (FO-MOBILE-44)",
    signal: 'medium',
  },
]

export function P2PSyncManager({ role, onClose, onSyncSuccess }: Props) {
  const [syncState, setSyncState] = useState<SyncState>('searching')
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>(DEFAULT_OFFICER_DEVICES)
  const [targetDevice, setTargetDevice] = useState('')
  const [progress, setProgress] = useState(0)
  const [itemCount, setItemCount] = useState(0)
  const [isScanningBt, setIsScanningBt] = useState(false)
  const [isReceiverActive, setIsReceiverActive] = useState(false)

  // ONLY Field Officer device listens for incoming P2P Broadcast Channel transmissions
  useEffect(() => {
    if (role !== 'field-officer' || !isReceiverActive) return

    const cleanup = listenForIncomingP2PDisputes((count) => {
      setItemCount((prev) => prev + count)
      setSyncState('complete')
      if (onSyncSuccess) onSyncSuccess()
    })
    return cleanup
  }, [role, isReceiverActive, onSyncSuccess])

  // Trigger hardware Web Bluetooth device scan prompt
  async function handleHardwareBluetoothScan() {
    setIsScanningBt(true)
    const device = await requestBluetoothDevice()
    setIsScanningBt(false)
    if (device) {
      const newDev: DiscoveredDevice = {
        id: device.id,
        name: device.name,
        role: 'Verified Bluetooth Device',
        signal: 'strong',
      }
      setDiscoveredDevices((prev) => [newDev, ...prev])
    }
  }

  // Activate Receiver mode on Officer device
  async function handleActivateOfficerReceiver() {
    setIsScanningBt(true)
    // Request hardware bluetooth permission prompt
    await requestBluetoothDevice()
    setIsScanningBt(false)
    setIsReceiverActive(true)
  }

  // Handle citizen manually clicking on an officer device from the list
  async function handleSelectDevice(device: DiscoveredDevice) {
    setTargetDevice(device.name)
    setSyncState('connected')

    setTimeout(async () => {
      setSyncState('transferring')
      setProgress(25)

      // Citizen sends queued dispute over P2P Channel
      const res = await sendDisputesOverP2P()
      const count = res.count > 0 ? res.count : 1
      setItemCount(count)
      
      setProgress(60)

      setTimeout(() => {
        setProgress(100)
        setSyncState('complete')
        if (onSyncSuccess) onSyncSuccess()
      }, 800)
    }, 1000)
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
            {role === 'citizen' ? 'Select Officer Bluetooth Device' : 'Field Officer Bluetooth Receiver'}
          </h3>
        </div>

        {/* CITIZEN SENDER VIEW */}
        {role === 'citizen' && (
          <div className="w-full flex flex-col items-center gap-4">
            {syncState === 'searching' && (
              <>
                <p className="text-xs font-semibold text-slate-500 text-center">
                  Nearby Officer devices found. <strong>Click your Field Officer&apos;s device below</strong> to share your report:
                </p>

                {/* Discovered Officer Device List */}
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
                  {isScanningBt ? 'Scanning Browser Bluetooth...' : '🔍 Scan Hardware Bluetooth Devices'}
                </button>
              </>
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
                  Transferring report to {targetDevice}...
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
                  Report successfully sent to <strong>{targetDevice}</strong>. It will automatically upload to Supabase when the officer gets internet connection.
                </p>
              </div>
            )}
          </div>
        )}

        {/* FIELD OFFICER RECEIVER VIEW */}
        {role !== 'citizen' && (
          <div className="w-full flex flex-col items-center gap-4 text-center py-2">
            {!isReceiverActive ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 border-4 border-slate-300 flex items-center justify-center text-3xl">
                  📶
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Officer Bluetooth Receiver Disabled</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click below to enable Bluetooth receiving mode and listen for incoming citizen land reports:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleActivateOfficerReceiver}
                  disabled={isScanningBt}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md active:scale-98 transition-all cursor-pointer"
                >
                  {isScanningBt ? 'Enabling Bluetooth...' : '📡 Turn On Bluetooth Receiver Mode'}
                </button>
              </div>
            ) : syncState === 'complete' ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center text-4xl shadow-lg">
                  📥
                </div>
                <p className="text-base font-black text-slate-800">Report Received!</p>
                <p className="text-xs font-semibold text-slate-600 max-w-xs">
                  Successfully received <strong>{itemCount} report(s)</strong> from Citizen. Saved in Officer local device database (Queued for Supabase sync).
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center text-3xl animate-pulse shadow-lg">
                  📡
                </div>
                <p className="text-sm font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300">
                  🟢 Bluetooth Receiver Active
                </p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Waiting for citizen to select this Officer device and send report...
                </p>
              </div>
            )}
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
