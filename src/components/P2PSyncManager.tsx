import { useState, useMemo } from 'react'
import { importReceivedReport } from '../lib/bluetoothSync'
import { buildSyncPayload, encodeCompact, generateVisualPin } from '../lib/syncPayload'
import { getDisputeQueue } from '../lib/offlineStorage'
import { supabase } from '../lib/supabaseClient'

type Props = {
  role: 'citizen' | 'field-officer' | 'admin'
  onClose: () => void
  onSyncSuccess?: () => void
}

type OfficerState = 'idle' | 'importing' | 'success' | 'error'

/**
 * Builds the compact report code and stores it in two places:
 * 1. localStorage — for same-device / same-browser testing
 * 2. Supabase relay row — for cross-device pairing (citizen phone → officer phone)
 */
async function buildAndStorePin(): Promise<{ pin: string; compact: string }> {
  const queue = await getDisputeQueue()
  const latest = queue[0]

  const payload = latest
    ? buildSyncPayload({
        referenceNumber: latest.referenceNumber,
        parcelId: latest.parcelId,
        category: latest.category as any,
        note: latest.note,
        photos: latest.photos ?? [],
        audio: latest.audio ?? null,
      })
    : buildSyncPayload({
        referenceNumber: `DEMO-DSP-${Date.now().toString().slice(-4)}`,
        parcelId: 'DEMO-PARCEL-0001',
        category: 'boundary',
        note: 'Land dispute reported offline',
        photos: [],
        audio: null,
      })

  const compact = encodeCompact(payload)
  const pin = generateVisualPin(compact)

  // 1. localStorage — same device fallback
  localStorage.setItem(`giz-pin-${pin}`, compact)

  // 2. Supabase relay — cross-device pairing
  if (supabase) {
    try {
      // Clean up any old relay rows for this PIN first
      await supabase
        .from('disputes')
        .delete()
        .eq('submitted_by', `P2P-RELAY-${pin}`)

      // Upload relay row: store compact code inside description field
      await supabase.from('disputes').insert({
        parcel_id: payload.parcelId || 'DEMO-PARCEL-0001',
        submitted_by: `P2P-RELAY-${pin}`,
        description: `P2P-CODE:${compact}`,
        status: 'submitted',
        fake_reference_number: `P2P-${pin}-${Date.now().toString().slice(-4)}`,
      })
    } catch (e) {
      // Supabase upload failed (offline) — officer must paste the received text
      console.warn('P2P Supabase relay upload failed (offline mode):', e)
    }
  }

  return { pin, compact }
}

export function P2PSyncManager({ role, onClose, onSyncSuccess }: Props) {
  const [pin, setPin] = useState('')
  const [compact, setCompact] = useState('')
  const [pinReady, setPinReady] = useState(false)
  const [pinCopied, setPinCopied] = useState(false)

  const [officerPin, setOfficerPin] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [officerState, setOfficerState] = useState<OfficerState>('idle')
  const [importedRef, setImportedRef] = useState('')
  const [importedNote, setImportedNote] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Generate PIN on mount for citizen
  useMemo(() => {
    if (role !== 'citizen') return
    buildAndStorePin().then(({ pin: p, compact: c }) => {
      setPin(p)
      setCompact(c)
      setPinReady(true)
    })
  }, [role])

  async function handleCitizenShare() {
    if (!navigator.share) {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(`[GIZ-REPORT]\n${compact}`)
      setPinCopied(true)
      return
    }
    try {
      await navigator.share({
        title: `GIZ Land Dispute — PIN: ${pin}`,
        text: `[GIZ-REPORT]\n${compact}`,
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        await navigator.clipboard.writeText(`[GIZ-REPORT]\n${compact}`)
        setPinCopied(true)
      }
    }
  }

  async function handleOfficerImportByPin() {
    const cleanPin = officerPin.trim().toUpperCase()
    if (cleanPin.length !== 6) return
    setOfficerState('importing')
    setErrorMsg('')

    let compactCode: string | null = null

    // Step 1: Check localStorage (same device / same browser test)
    compactCode = localStorage.getItem(`giz-pin-${cleanPin}`)

    // Step 2: Check Supabase relay (cross-device — citizen on phone, officer on laptop/another phone)
    if (!compactCode && supabase) {
      try {
        const { data } = await supabase
          .from('disputes')
          .select('description')
          .eq('submitted_by', `P2P-RELAY-${cleanPin}`)
          .limit(1)

        if (data && data.length > 0) {
          const desc: string = data[0].description ?? ''
          if (desc.startsWith('P2P-CODE:')) {
            compactCode = desc.replace('P2P-CODE:', '')
            // Delete relay row so it can't be reused
            await supabase
              .from('disputes')
              .delete()
              .eq('submitted_by', `P2P-RELAY-${cleanPin}`)
          }
        }
      } catch (e) {
        console.warn('Supabase PIN relay lookup failed:', e)
      }
    }

    if (compactCode) {
      const result = await importReceivedReport(compactCode)
      if (result.success) {
        setImportedRef(result.referenceNumber)
        setImportedNote(result.note)
        setOfficerState('success')
        localStorage.removeItem(`giz-pin-${cleanPin}`)
        if (onSyncSuccess) onSyncSuccess()
      } else {
        setOfficerState('error')
        setErrorMsg(result.error)
      }
      return
    }

    setOfficerState('error')
    setErrorMsg(`PIN [${cleanPin}] not found on this device or server. Make sure the citizen tapped "Share Report" first, then try again. If offline, ask the citizen to send the text via Bluetooth and paste it below.`)
  }

  async function handleOfficerImportByPaste() {
    if (!pasteText.trim()) return
    setOfficerState('importing')
    setErrorMsg('')
    const result = await importReceivedReport(pasteText)
    if (result.success) {
      setImportedRef(result.referenceNumber)
      setImportedNote(result.note)
      setOfficerState('success')
      if (onSyncSuccess) onSyncSuccess()
    } else {
      setOfficerState('error')
      setErrorMsg(result.error)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-900 px-6 pt-5 pb-7 text-white text-center">
          <button type="button" onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-3xl mb-1.5">{role === 'citizen' ? '📶' : '📥'}</div>
          <h3 className="text-base font-extrabold">
            {role === 'citizen' ? 'Send Report to Officer' : 'Receive Report from Citizen'}
          </h3>
          <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
            0% Internet Required
          </span>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">

          {/* ─── CITIZEN VIEW ─── */}
          {role === 'citizen' && (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-xs font-semibold text-slate-600">
                Your report has a <strong>6-character share code</strong>. Send it to the officer via Bluetooth or QuickShare:
              </p>

              {/* Big 6-char PIN display */}
              {pinReady ? (
                <div className="w-full rounded-2xl border-4 border-emerald-600 bg-emerald-50 p-5 flex flex-col items-center gap-1 shadow-md">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700">Share Code</span>
                  <span className="text-5xl font-black tracking-[0.3em] text-emerald-950 my-1 font-mono">
                    {pin}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-200/60 px-3 py-0.5 rounded-full">
                    Tell this code to the Officer
                  </span>
                </div>
              ) : (
                <div className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 p-8 flex items-center justify-center">
                  <svg className="w-6 h-6 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              )}

              {/* Share button */}
              <button type="button" onClick={handleCitizenShare} disabled={!pinReady}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2">
                <span>📶</span>
                {pinCopied ? '✅ Code Copied! Send to Officer' : 'Send via Bluetooth / QuickShare'}
              </button>

              <div className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                Tapping "Send" opens your phone's <strong>Bluetooth / Nearby Share</strong> panel.<br />
                Officer enters the <strong>6-char code {pin || '——'}</strong> on their device to receive your report.
              </div>
            </div>
          )}

          {/* ─── OFFICER VIEW ─── */}
          {role !== 'citizen' && (
            <div className="flex flex-col gap-4">
              {officerState !== 'success' && (
                <>
                  {/* PIN Entry */}
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm font-bold text-slate-700 text-center">
                      Ask the citizen for their <strong>6-character Share Code</strong> and enter it below:
                    </p>
                    <input
                      type="text"
                      maxLength={6}
                      value={officerPin}
                      onChange={(e) => {
                        setOfficerPin(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))
                        if (officerState === 'error') { setOfficerState('idle'); setErrorMsg('') }
                      }}
                      placeholder="A4X9K2"
                      className="w-44 text-center text-3xl font-black tracking-[0.3em] py-3 px-3 rounded-2xl border-4 border-emerald-600 focus:border-emerald-700 bg-emerald-50 text-slate-900 outline-none shadow-inner font-mono uppercase"
                      autoFocus
                    />
                    <button type="button"
                      onClick={handleOfficerImportByPin}
                      disabled={officerPin.trim().length !== 6 || officerState === 'importing'}
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-sm shadow transition-all active:scale-98 cursor-pointer">
                      {officerState === 'importing' ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Importing...
                        </span>
                      ) : '📥 Import Report via PIN'}
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] font-bold text-slate-400">OR paste received text</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  {/* Paste fallback */}
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={pasteText}
                      onChange={(e) => {
                        setPasteText(e.target.value)
                        if (officerState === 'error') { setOfficerState('idle'); setErrorMsg('') }
                      }}
                      placeholder={'Paste the report text received via Bluetooth:\n\n[GIZ-REPORT]\nGIZ:DEMO-DSP-...:...'}
                      rows={4}
                      className="w-full rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none p-3 font-mono text-xs text-slate-700 bg-slate-50 resize-none transition-colors"
                    />
                    <button type="button"
                      onClick={handleOfficerImportByPaste}
                      disabled={!pasteText.trim() || officerState === 'importing'}
                      className="w-full py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow transition-all cursor-pointer">
                      Import from Pasted Text
                    </button>
                  </div>

                  {officerState === 'error' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                      <p className="text-xs font-bold text-red-700">❌ {errorMsg}</p>
                    </div>
                  )}
                </>
              )}

              {officerState === 'success' && (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center text-4xl shadow-lg">
                    ✅
                  </div>
                  <p className="text-base font-black text-slate-800">Report Saved on Your Device!</p>
                  <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-left flex flex-col gap-1">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Imported Report</p>
                    <p className="text-sm font-black text-slate-800">{importedRef}</p>
                    {importedNote && <p className="text-xs text-slate-600 line-clamp-2">{importedNote}</p>}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 max-w-xs">
                    Saved offline in your local database. Will auto-upload to Supabase when you reach an internet area.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button type="button" onClick={onClose}
            className={`w-full py-3 font-bold rounded-2xl text-sm cursor-pointer active:scale-98 transition-all ${
              officerState === 'success'
                ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}>
            {officerState === 'success' ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
