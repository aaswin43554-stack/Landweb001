import { useEffect, useState } from 'react'
import {
  requestBluetoothDevice,
  generateOfficerPin,
  sendDisputeWithPin,
  listenForPinPairing,
} from '../lib/bluetoothSync'

type Props = {
  role: 'citizen' | 'field-officer' | 'admin'
  onClose: () => void
  onSyncSuccess?: () => void
}

type SyncState = 'pin_entry' | 'pairing' | 'transferring' | 'complete'

export function P2PSyncManager({ role, onClose, onSyncSuccess }: Props) {
  const [syncState, setSyncState] = useState<SyncState>('pin_entry')
  const [citizenInputPin, setCitizenInputPin] = useState('')
  const [officerPin, setOfficerPin] = useState(generateOfficerPin)
  const [targetDevice, setTargetDevice] = useState('')
  const [progress, setProgress] = useState(0)
  const [itemCount, setItemCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isScanningBt, setIsScanningBt] = useState(false)

  // Field Officer device listens for incoming citizen P2P transfers matching officerPin
  useEffect(() => {
    if (role === 'citizen') return

    const cleanup = listenForPinPairing(officerPin, (count, sender) => {
      setItemCount(count)
      setTargetDevice(sender)
      setSyncState('complete')
      if (onSyncSuccess) onSyncSuccess()
    })
    return cleanup
  }, [role, officerPin, onSyncSuccess])

  // Citizen side: Listen for PIN pairing success confirmation back from Officer
  useEffect(() => {
    if (role !== 'citizen' || syncState !== 'pairing') return

    const channel = new BroadcastChannel('giz-p2p-bluetooth-channel')
    const handleSuccess = (event: MessageEvent) => {
      if (event.data && event.data.type === 'P2P_PIN_PAIR_SUCCESS' && event.data.pin === citizenInputPin.trim()) {
        setSyncState('transferring')
        setProgress(60)
        setTimeout(() => {
          setProgress(100)
          setSyncState('complete')
          if (onSyncSuccess) onSyncSuccess()
        }, 800)
      }
    }

    channel.addEventListener('message', handleSuccess)
    return () => channel.removeEventListener('message', handleSuccess)
  }, [role, syncState, citizenInputPin, onSyncSuccess])

  // Trigger hardware Web Bluetooth device prompt
  async function handleHardwareBluetoothScan() {
    setIsScanningBt(true)
    const device = await requestBluetoothDevice()
    setIsScanningBt(false)
    if (device) {
      setTargetDevice(device.name)
    }
  }

  // Citizen initiates PIN pairing & report transfer
  async function handleCitizenSubmitPin(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setErrorMessage('')

    const cleanPin = citizenInputPin.trim()
    if (cleanPin.length !== 4) {
      setErrorMessage('Please enter the 4-digit PIN code shown on the Officer screen.')
      return
    }

    setSyncState('pairing')
    setProgress(20)

    const res = await sendDisputeWithPin(cleanPin)
    if (!res.success) {
      setSyncState('pin_entry')
      setErrorMessage(res.error || 'Failed to connect. Please check the PIN.')
      return
    }

    setItemCount(res.count)
    setTargetDevice("Officer's Mobile Device")

    // Automatic fallback pairing completion after 1.5s if BroadcastChannel syncs locally
    setTimeout(() => {
      setSyncState('transferring')
      setProgress(70)
      setTimeout(() => {
        setProgress(100)
        setSyncState('complete')
        if (onSyncSuccess) onSyncSuccess()
      }, 600)
    }, 1200)
  }

  function handleRefreshOfficerPin() {
    const newPin = generateOfficerPin()
    setOfficerPin(newPin)
    setSyncState('pin_entry')
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 flex flex-col items-center gap-5 shadow-2xl relative overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Decorative Grid Background */}
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
            {role === 'citizen' ? 'Bluetooth PIN Pairing' : 'Field Officer P2P Receiver'}
          </h3>
        </div>

        {/* CITIZEN SENDER VIEW */}
        {role === 'citizen' && (
          <div className="w-full flex flex-col items-center gap-4">
            {syncState === 'pin_entry' && (
              <form onSubmit={handleCitizenSubmitPin} className="w-full flex flex-col items-center gap-4">
                <p className="text-xs font-semibold text-slate-600 text-center">
                  Look at your Field Officer&apos;s phone screen and enter their <strong>4-Digit Bluetooth PIN Code</strong>:
                </p>

                {/* 4-Digit Input */}
                <div className="flex flex-col items-center gap-2 w-full">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={citizenInputPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setCitizenInputPin(val)
                      if (errorMessage) setErrorMessage('')
                    }}
                    placeholder="0000"
                    className="w-48 text-center text-3xl font-black tracking-[0.5em] py-3 px-4 rounded-2xl border-4 border-emerald-600 focus:border-emerald-700 bg-emerald-50/50 text-slate-800 outline-none shadow-inner"
                    autoFocus
                  />
                  {errorMessage && (
                    <p className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 text-center">
                      {errorMessage}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={citizenInputPin.length !== 4}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-2xl shadow-md active:scale-98 transition-all cursor-pointer"
                >
                  📶 Pair & Transfer Report to Officer
                </button>

                <div className="w-full border-t border-slate-100 pt-3 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={handleHardwareBluetoothScan}
                    disabled={isScanningBt}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-2 px-3 rounded-xl border border-slate-200 transition-all cursor-pointer"
                  >
                    {isScanningBt ? 'Scanning Browser Bluetooth...' : '🔍 Scan Hardware Bluetooth Prompt'}
                  </button>
                  {targetDevice && (
                    <p className="text-[11px] font-semibold text-emerald-700">Selected: {targetDevice}</p>
                  )}
                </div>
              </form>
            )}

            {syncState === 'pairing' && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-20 h-20 rounded-full bg-blue-100 border-4 border-blue-500 flex items-center justify-center text-3xl animate-pulse shadow-lg">
                  🤝
                </div>
                <p className="text-sm font-extrabold text-blue-700">Verifying PIN [{citizenInputPin}]...</p>
                <p className="text-xs text-slate-500">Pairing citizen device with Field Officer mobile over Bluetooth</p>
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
                  Transferring report to Officer storage (PIN {citizenInputPin} Verified)...
                </p>
              </div>
            )}

            {syncState === 'complete' && (
              <div className="flex flex-col items-center gap-2 text-center py-2">
                <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center shadow-lg text-4xl">
                  ✅
                </div>
                <p className="text-base font-black text-slate-800 mt-1">Transfer Complete!</p>
                <p className="text-xs font-semibold text-slate-600 max-w-xs">
                  Report successfully paired & transferred to Officer device (PIN <strong>{citizenInputPin}</strong> verified)! It will automatically upload to Supabase when the officer gets internet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* FIELD OFFICER RECEIVER VIEW */}
        {role !== 'citizen' && (
          <div className="w-full flex flex-col items-center gap-4 text-center py-2">
            {syncState === 'complete' ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center text-4xl shadow-lg">
                  📥
                </div>
                <p className="text-base font-black text-slate-800">Report Received!</p>
                <p className="text-xs font-semibold text-slate-600 max-w-xs">
                  Successfully received <strong>{itemCount} report(s)</strong> from {targetDevice || 'Citizen'} via PIN <strong>{officerPin}</strong>. Saved in Officer local device database (Queued for Supabase cloud sync).
                </p>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-4">
                <p className="text-xs font-semibold text-slate-500">
                  Share this <strong>4-Digit PIN Code</strong> with the citizen so they can pair & transfer their land report:
                </p>

                {/* Big Officer PIN Display Card */}
                <div className="w-full rounded-2xl border-4 border-emerald-600 bg-emerald-50/70 p-5 flex flex-col items-center gap-1 shadow-md">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800">
                    Officer Bluetooth PIN Code
                  </span>
                  <span className="text-5xl font-black text-emerald-950 tracking-[0.25em] my-1">
                    {officerPin}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-200/60 px-3 py-1 rounded-full mt-1">
                    🟢 Receiver Mode Active — Listening...
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRefreshOfficerPin}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-2 px-3 rounded-xl border border-slate-200 transition-all cursor-pointer"
                >
                  🔄 Regenerate PIN Code
                </button>
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
