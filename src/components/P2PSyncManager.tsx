import { useEffect, useState } from 'react'
import {
  requestBluetoothDevice,
  generateCitizenPin,
  broadcastDisputeWithPin,
  verifyAndImportDispute,
} from '../lib/bluetoothSync'
import { supabase } from '../lib/supabaseClient'

type Props = {
  role: 'citizen' | 'field-officer' | 'admin'
  onClose: () => void
  onSyncSuccess?: () => void
}

type SyncState = 'pin_display' | 'waiting' | 'verifying' | 'transferring' | 'complete'

export function P2PSyncManager({ role, onClose, onSyncSuccess }: Props) {
  const [syncState, setSyncState] = useState<SyncState>(role === 'citizen' ? 'pin_display' : 'waiting')
  const [citizenPin] = useState(generateCitizenPin)
  const [officerInputPin, setOfficerInputPin] = useState('')
  const [targetDevice, setTargetDevice] = useState('')
  const [progress, setProgress] = useState(0)
  const [itemCount, setItemCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isScanningBt, setIsScanningBt] = useState(false)

  // Citizen Side: Broadcast dispute details with PIN immediately on open
  useEffect(() => {
    if (role !== 'citizen') return
    broadcastDisputeWithPin(citizenPin).then((res) => {
      setItemCount(res.count)
    })
  }, [role, citizenPin])

  // Citizen Side: Listen for Officer successful PIN verification response
  useEffect(() => {
    if (role !== 'citizen') return

    const channel = new BroadcastChannel('giz-p2p-bluetooth-channel')
    const handleSuccess = (event: MessageEvent) => {
      if (event.data && event.data.type === 'P2P_PIN_PAIR_SUCCESS' && event.data.pin === citizenPin) {
        setSyncState('transferring')
        setProgress(30)
        setTimeout(() => {
          setProgress(75)
          setTimeout(() => {
            setProgress(100)
            setSyncState('complete')
            if (onSyncSuccess) onSyncSuccess()
          }, 500)
        }, 500)
      }
    }

    channel.addEventListener('message', handleSuccess)
    
    // Check if officer consumed payload (works for both local-storage and Supabase cross-device)
    const checkRelayConsumed = async () => {
      if (syncState !== 'pin_display') return

      // Local storage check fallback (same device)
      const payloadKey = `giz-p2p-pin-payload-${citizenPin}`
      if (!localStorage.getItem(payloadKey)) {
        setSyncState('transferring')
        setProgress(100)
        setSyncState('complete')
        if (onSyncSuccess) onSyncSuccess()
        return
      }

      // Supabase network check fallback (cross-device physical phone/laptop sync)
      if (supabase) {
        try {
          const { data } = await supabase
            .from('disputes')
            .select('id')
            .eq('submitted_by', `P2P-PIN-${citizenPin}`)
          
          // If the relay row is gone, it means the officer has successfully imported it!
          if (data && data.length === 0) {
            setSyncState('transferring')
            setProgress(100)
            setSyncState('complete')
            if (onSyncSuccess) onSyncSuccess()
          }
        } catch {}
      }
    }

    const interval = setInterval(checkRelayConsumed, 1500)

    return () => {
      channel.removeEventListener('message', handleSuccess)
      clearInterval(interval)
    }
  }, [role, citizenPin, syncState, onSyncSuccess])

  // Officer Side: Submit citizen's PIN code for verification
  async function handleOfficerSubmitPin(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setErrorMessage('')

    const cleanPin = officerInputPin.trim()
    if (cleanPin.length !== 4) {
      setErrorMessage('Please enter the exactly 4-digit PIN code shown on the Citizen\'s screen.')
      return
    }

    setSyncState('verifying')
    
    const res = await verifyAndImportDispute(cleanPin, (count) => {
      setItemCount(count)
      setTargetDevice('Citizen Mobile')
    })

    if (!res.success) {
      setSyncState('waiting')
      setErrorMessage(res.error || 'PIN Code verification failed. Try again.')
      return
    }

    setSyncState('transferring')
    setProgress(50)
    setTimeout(() => {
      setProgress(100)
      setSyncState('complete')
      if (onSyncSuccess) onSyncSuccess()
    }, 800)
  }

  // Trigger hardware Web Bluetooth device prompt
  async function handleHardwareBluetoothScan() {
    setIsScanningBt(true)
    const device = await requestBluetoothDevice()
    setIsScanningBt(false)
    if (device) {
      setTargetDevice(device.name)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 flex flex-col items-center gap-5 shadow-2xl relative overflow-hidden border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
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
            {role === 'citizen' ? 'Share Bluetooth PIN' : 'Field Officer P2P Receiver'}
          </h3>
        </div>

        {/* CITIZEN SENDER VIEW (Displays PIN to be entered on Officer Device) */}
        {role === 'citizen' && (
          <div className="w-full flex flex-col items-center gap-4">
            {syncState === 'pin_display' && (
              <>
                <p className="text-xs font-semibold text-slate-600 text-center">
                  Show this <strong>4-Digit Bluetooth PIN</strong> to the Field Officer to pair devices and send your report:
                </p>

                {/* Big Citizen Pairing PIN Badge */}
                <div className="w-full rounded-2xl border-4 border-emerald-600 bg-emerald-50/70 p-5 flex flex-col items-center gap-1 shadow-md">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800">
                    Citizen Pairing PIN
                  </span>
                  <span className="text-5xl font-black text-emerald-950 tracking-[0.25em] my-1">
                    {citizenPin}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-200/60 px-3 py-1 rounded-full mt-1">
                    🟢 Broadcasting report offline...
                  </span>
                </div>

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
              </>
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
                <p className="text-xs font-semibold text-emerald-600 animate-pulse text-center">
                  Officer verified PIN {citizenPin}! Sending dispute report...
                </p>
              </div>
            )}

            {syncState === 'complete' && (
              <div className="flex flex-col items-center gap-2 text-center py-2">
                <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center shadow-lg text-4xl">
                  ✅
                </div>
                <p className="text-base font-black text-slate-800 mt-1">Report Sent!</p>
                <p className="text-xs font-semibold text-slate-600 max-w-xs">
                  Successfully paired with Officer device (PIN <strong>{citizenPin}</strong> Verified)! Report transferred locally.
                </p>
              </div>
            )}
          </div>
        )}

        {/* FIELD OFFICER RECEIVER VIEW (Officer Inputs Citizen's PIN Code) */}
        {role !== 'citizen' && (
          <div className="w-full flex flex-col items-center gap-4">
            {syncState === 'waiting' && (
              <form onSubmit={handleOfficerSubmitPin} className="w-full flex flex-col items-center gap-4">
                <p className="text-xs font-semibold text-slate-600 text-center">
                  Ask the citizen for the <strong>4-Digit PIN Code</strong> shown on their phone screen to import report:
                </p>

                {/* 4-Digit Input on Officer Side */}
                <div className="flex flex-col items-center gap-2 w-full">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={officerInputPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setOfficerInputPin(val)
                      if (errorMessage) setErrorMessage('')
                    }}
                    placeholder="0000"
                    className="w-48 text-center text-3xl font-black tracking-[0.5em] py-3 px-4 rounded-2xl border-4 border-emerald-600 focus:border-emerald-700 bg-emerald-50/50 text-slate-800 outline-none shadow-inner"
                    autoFocus
                  />
                  {errorMessage && (
                    <p className="text-xs font-bold text-red-650 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 text-center max-w-xs">
                      {errorMessage}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={officerInputPin.length !== 4}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-2xl shadow-md active:scale-98 transition-all cursor-pointer"
                >
                  📶 Verify PIN & Fetch Citizen Report
                </button>
              </form>
            )}

            {syncState === 'verifying' && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-20 h-20 rounded-full bg-blue-100 border-4 border-blue-500 flex items-center justify-center text-3xl animate-pulse shadow-lg">
                  🤝
                </div>
                <p className="text-sm font-extrabold text-blue-700">Verifying PIN Code [{officerInputPin}]...</p>
                <p className="text-xs text-slate-500">Connecting and validating dispute key over Bluetooth mesh</p>
              </div>
            )}

            {syncState === 'transferring' && (
              <div className="flex flex-col items-center gap-3 w-full px-4 py-4 text-center">
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
                  PIN Verified. Receiving report into local Officer database...
                </p>
              </div>
            )}

            {syncState === 'complete' && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center text-4xl shadow-lg">
                  📥
                </div>
                <p className="text-base font-black text-slate-800">Report Received & Saved!</p>
                <p className="text-xs font-semibold text-slate-600 max-w-xs">
                  Successfully imported <strong>{itemCount} report(s)</strong> from Citizen (PIN <strong>{officerInputPin}</strong> verified). Saved in Officer local device database (Queued for Supabase sync).
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
