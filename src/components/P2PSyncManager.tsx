import { useState, useEffect, useRef } from 'react'
import { importReceivedReport, importReceivedFile, shareFullReportAsFile, buildReportPackage } from '../lib/bluetoothSync'
import { buildSyncPayload, encodeCompact, generateVisualPin } from '../lib/syncPayload'
import { getDisputeQueue } from '../lib/offlineStorage'
import { supabase } from '../lib/supabaseClient'
import { QrCode } from './QrCode'

type Props = {
  role: 'citizen' | 'field-officer' | 'admin'
  onClose: () => void
  onSyncSuccess?: () => void
  activeShareData?: {
    referenceNumber: string
    parcelId: string
    category: string
    note: string
    photos: string[]
    audio: string | null
  } | null
}

type OfficerState = 'idle' | 'importing' | 'success' | 'error'
type OfficerMethod = 'qr' | 'file' | 'pin' | 'paste'

async function buildAndStorePin(activeShareData?: Props['activeShareData']): Promise<{ pin: string; compact: string }> {
  let payload;
  if (activeShareData && activeShareData.referenceNumber) {
    payload = buildSyncPayload({
      referenceNumber: activeShareData.referenceNumber,
      parcelId: activeShareData.parcelId || 'DEMO-PARCEL-0001',
      category: (activeShareData.category as any) || 'boundary',
      note: activeShareData.note || '',
      photos: activeShareData.photos ?? [],
      audio: activeShareData.audio ?? null,
    })
  } else {
    try {
      const queue = await getDisputeQueue()
      const latest = queue[0]
      payload = latest
        ? buildSyncPayload({ referenceNumber: latest.referenceNumber, parcelId: latest.parcelId, category: latest.category as any, note: latest.note, photos: latest.photos ?? [], audio: latest.audio ?? null })
        : buildSyncPayload({ referenceNumber: `DEMO-DSP-${Date.now().toString().slice(-4)}`, parcelId: 'DEMO-PARCEL-0001', category: 'boundary', note: 'Land dispute reported offline', photos: [], audio: null })
    } catch {
      payload = buildSyncPayload({ referenceNumber: `DEMO-DSP-${Date.now().toString().slice(-4)}`, parcelId: 'DEMO-PARCEL-0001', category: 'boundary', note: 'Land dispute reported offline', photos: [], audio: null })
    }
  }

  const compact = encodeCompact(payload)
  const pin = generateVisualPin(compact)
  try {
    localStorage.setItem(`giz-pin-${pin}`, compact)
  } catch {}

  // Fire-and-forget non-blocking Supabase relay upload
  if (supabase) {
    const client = supabase
    ;(async () => {
      try {
        await client.from('disputes').delete().eq('submitted_by', `P2P-RELAY-${pin}`)
        await client.from('disputes').insert({
          parcel_id: payload.parcelId || 'DEMO-PARCEL-0001',
          submitted_by: `P2P-RELAY-${pin}`,
          description: `P2P-CODE:${compact}`,
          status: 'submitted',
          fake_reference_number: `P2P-${pin}-${Date.now().toString().slice(-4)}`,
        })
      } catch {}
    })()
  }
  return { pin, compact }
}

export function P2PSyncManager({ role, onClose, onSyncSuccess, activeShareData }: Props) {
  const [pin, setPin] = useState('')
  const [compact, setCompact] = useState('')
  const [pinReady, setPinReady] = useState(false)
  const [hasPhotos, setHasPhotos] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [citizenShareMsg, setCitizenShareMsg] = useState('')
  const [isSearchingDevice, setIsSearchingDevice] = useState(false)

  const [officerMethod, setOfficerMethod] = useState<OfficerMethod>('file')
  const [officerPin, setOfficerPin] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [officerState, setOfficerState] = useState<OfficerState>('idle')
  const [importedRef, setImportedRef] = useState('')
  const [importedNote, setImportedNote] = useState('')
  const [importedPhotoCount, setImportedPhotoCount] = useState(0)
  const [importedHasAudio, setImportedHasAudio] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (role !== 'citizen') return
    buildAndStorePin(activeShareData).then(({ pin: p, compact: c }) => { setPin(p); setCompact(c); setPinReady(true) })
    if (activeShareData) {
      setHasPhotos((activeShareData.photos?.length ?? 0) > 0)
      setHasAudio(!!activeShareData.audio)
    } else {
      getDisputeQueue().then(q => {
        const latest = q[0]
        if (latest) {
          setHasPhotos((latest.photos?.length ?? 0) > 0)
          setHasAudio(!!latest.audio)
        }
      })
    }
  }, [role, activeShareData])

  async function handleCitizenShareWithMedia(preferredMethod: 'quickshare' | 'bluetooth' | 'download' = 'quickshare') {
    setCitizenShareMsg('')
    setIsSearchingDevice(true)

    let pkg = activeShareData && activeShareData.referenceNumber
      ? {
          version: 2 as const,
          referenceNumber: activeShareData.referenceNumber,
          parcelId: activeShareData.parcelId || 'UNKNOWN',
          category: activeShareData.category || 'other',
          note: activeShareData.note || '',
          photos: activeShareData.photos ?? [],
          audio: activeShareData.audio ?? null,
          timestamp: Date.now(),
        }
      : await buildReportPackage()

    if (!pkg) {
      pkg = {
        version: 2 as const,
        referenceNumber: `DEMO-DSP-${Date.now().toString().slice(-4)}`,
        parcelId: 'DEMO-PARCEL-0001',
        category: 'boundary',
        note: 'Land dispute report with offline media attachments',
        photos: [],
        audio: null,
        timestamp: Date.now(),
      }
    }

    if (preferredMethod === 'download') {
      const { downloadReportFile } = await import('../lib/bluetoothSync')
      downloadReportFile(pkg)
      setCitizenShareMsg(`📥 Report file downloaded (giz-report-${pkg.referenceNumber}.giz.json)! Share this file with the officer via QuickShare / Bluetooth in your phone's File Manager.`)
      setIsSearchingDevice(false)
      return
    }

    const res = await shareFullReportAsFile(pkg)
    setIsSearchingDevice(false)

    if (res === 'shared') {
      setCitizenShareMsg(`✅ Report file sent via ${preferredMethod === 'quickshare' ? 'QuickShare / Nearby Share' : 'Bluetooth / AirDrop'}!`)
    } else if (res === 'downloaded' || res === 'unsupported') {
      setCitizenShareMsg(`📥 Report file saved (giz-report-${pkg.referenceNumber}.giz.json)! Open your phone's File Manager to send via QuickShare or select it in the officer app.`)
    }
  }

  async function handleOfficerFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOfficerState('importing')
    setErrorMsg('')
    const result = await importReceivedFile(file)
    if (result.success) {
      setImportedRef(result.referenceNumber)
      setImportedNote(result.note)
      setImportedPhotoCount(result.photoCount)
      setImportedHasAudio(result.hasAudio)
      setOfficerState('success')
      if (onSyncSuccess) onSyncSuccess()
    } else {
      setOfficerState('error')
      setErrorMsg(result.error)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleOfficerImportByPin() {
    const cleanPin = officerPin.trim().toUpperCase()
    if (cleanPin.length !== 6) return
    setOfficerState('importing')
    setErrorMsg('')
    let compactCode: string | null = localStorage.getItem(`giz-pin-${cleanPin}`)
    if (!compactCode && supabase) {
      try {
        const { data } = await supabase.from('disputes').select('description').eq('submitted_by', `P2P-RELAY-${cleanPin}`).limit(1)
        if (data?.[0]?.description?.startsWith('P2P-CODE:')) {
          compactCode = data[0].description.replace('P2P-CODE:', '')
          await supabase.from('disputes').delete().eq('submitted_by', `P2P-RELAY-${cleanPin}`)
        }
      } catch {}
    }
    if (compactCode) {
      const result = await importReceivedReport(compactCode)
      if (result.success) {
        setImportedRef(result.referenceNumber); setImportedNote(result.note)
        setImportedPhotoCount(result.photoCount); setImportedHasAudio(result.hasAudio)
        setOfficerState('success'); localStorage.removeItem(`giz-pin-${cleanPin}`)
        if (onSyncSuccess) onSyncSuccess()
      } else { setOfficerState('error'); setErrorMsg(result.error) }
    } else {
      setOfficerState('error')
      setErrorMsg(`PIN [${cleanPin}] not found. This method needs internet. Use "Import File" for fully offline transfer with photos & audio.`)
    }
  }

  async function handleOfficerImportByPaste() {
    if (!pasteText.trim()) return
    setOfficerState('importing'); setErrorMsg('')
    const result = await importReceivedReport(pasteText)
    if (result.success) {
      setImportedRef(result.referenceNumber); setImportedNote(result.note)
      setImportedPhotoCount(result.photoCount); setImportedHasAudio(result.hasAudio)
      setOfficerState('success')
      if (onSyncSuccess) onSyncSuccess()
    } else { setOfficerState('error'); setErrorMsg(result.error) }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[93vh] overflow-y-auto animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-900 px-6 pt-5 pb-6 text-white text-center">
          <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="text-3xl mb-1">{role === 'citizen' ? '📶' : '📥'}</div>
          <h3 className="text-base font-extrabold">{role === 'citizen' ? 'Send Report to Officer' : 'Receive Report from Citizen'}</h3>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">

          {/* ─── CITIZEN VIEW ─── */}
          {role === 'citizen' && (
            <div className="flex flex-col gap-4">

              {/* Method 1 — File Share with photos & audio (BEST, 100% offline) */}
              <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                  <span className="text-xs font-extrabold text-emerald-800">Share File — Photos & Audio Included ✅ (Best)</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {hasPhotos && <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">📸 Photos included</span>}
                  {hasAudio && <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">🎙️ Audio included</span>}
                  {!hasPhotos && !hasAudio && <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">No photos/audio in this report</span>}
                </div>
                <p className="text-[11px] text-emerald-700 font-semibold">
                  Sends the complete report file with photos & voice note to nearby officer devices:
                </p>

                {/* Radar Searching Animation */}
                {isSearchingDevice && (
                  <div className="rounded-xl border-2 border-emerald-400 bg-emerald-100/70 p-3 flex flex-col items-center gap-2 text-center animate-in fade-in duration-200">
                    <div className="relative flex items-center justify-center w-12 h-12">
                      <div className="absolute w-12 h-12 rounded-full bg-emerald-500/30 animate-ping" />
                      <div className="relative w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-base">📡</div>
                    </div>
                    <p className="text-xs font-extrabold text-emerald-900">Searching for Officer's Device...</p>
                    <p className="text-[10px] font-semibold text-emerald-700">Make sure the Officer's phone has Bluetooth / QuickShare turned ON</p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => handleCitizenShareWithMedia('quickshare')}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-sm shadow transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2">
                    <span>⚡</span> Send via QuickShare / Nearby Share
                  </button>

                  <button type="button" onClick={() => handleCitizenShareWithMedia('bluetooth')}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2">
                    <span>📶</span> Send via Bluetooth / AirDrop
                  </button>

                  <button type="button" onClick={() => handleCitizenShareWithMedia('download')}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl text-[11px] shadow transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5">
                    <span>📥</span> Direct Download File (.giz.json)
                  </button>
                </div>

                {citizenShareMsg && (
                  <div className="rounded-xl border border-emerald-300 bg-white p-2.5 text-xs font-bold text-emerald-900 shadow-sm animate-in fade-in duration-200">
                    {citizenShareMsg}
                  </div>
                )}
              </div>

              {/* Method 2 — QR Code */}
              <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 self-start">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                  <span className="text-xs font-extrabold text-blue-800">QR Code Scan — Text Only, No Photos 📷</span>
                </div>
                <p className="text-[11px] text-blue-700 font-semibold self-start">Officer scans your screen with their camera (100% offline, no photos/audio):</p>
                {pinReady ? (
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-blue-200">
                    <QrCode value={`[GIZ-REPORT]\n${compact}`} size={148} className="w-36 h-36" />
                  </div>
                ) : (
                  <div className="w-36 h-36 rounded-xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  </div>
                )}
              </div>

              {/* Method 3 — PIN (needs internet) */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">3</span>
                  <span className="text-xs font-extrabold text-slate-700">6-Char PIN — Needs Internet 🌐 (Text Only)</span>
                </div>
                <div className="flex items-center justify-center bg-white rounded-xl border border-slate-200 py-2.5 shadow-sm">
                  <span className="text-2xl font-black tracking-[0.3em] font-mono text-slate-800">{pinReady ? pin : '——'}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── OFFICER VIEW ─── */}
          {role !== 'citizen' && (
            <div className="flex flex-col gap-4">
              {officerState !== 'success' && (
                <>
                  {/* Method selector tabs */}
                  <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
                    {([
                      { key: 'file', label: '📂 File', sub: 'photos+audio' },
                      { key: 'qr',   label: '📷 QR',   sub: '100% offline' },
                      { key: 'pin',  label: '🔢 PIN',   sub: 'internet' },
                      { key: 'paste',label: '📋 Paste', sub: 'text only' },
                    ] as const).map(({ key, label, sub }) => (
                      <button key={key} type="button"
                        onClick={() => { setOfficerMethod(key); setOfficerState('idle'); setErrorMsg('') }}
                        className={`flex flex-col items-center py-2 px-0.5 rounded-lg text-center transition-all cursor-pointer ${officerMethod === key ? 'bg-white shadow text-emerald-800 font-extrabold' : 'text-slate-500 font-semibold hover:bg-white/60'}`}>
                        <span className="text-[11px] font-bold">{label}</span>
                        <span className="text-[9px] opacity-70">{sub}</span>
                      </button>
                    ))}
                  </div>

                  {/* File Import — photos & audio */}
                  {officerMethod === 'file' && (
                    <div className="flex flex-col gap-3">
                      <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4 flex flex-col gap-3 text-center">
                        <span className="text-3xl">📂</span>
                        <p className="text-sm font-extrabold text-emerald-800">Import .giz.json file from Citizen</p>
                        <p className="text-xs text-emerald-700 font-semibold">
                          Citizen sends the file via Bluetooth/AirDrop/QuickShare to this device. Once received, tap "Select File" below to import — <strong>includes all photos and audio files!</strong>
                        </p>
                        <input ref={fileInputRef} type="file" accept=".json,.giz.json" onChange={handleOfficerFileImport}
                          className="hidden" id="giz-file-import" />
                        <label htmlFor="giz-file-import"
                          className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-sm shadow transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98">
                          {officerState === 'importing' ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                              Importing...
                            </span>
                          ) : <><span>📂</span> Select Received .giz.json File</>}
                        </label>
                      </div>
                    </div>
                  )}

                  {/* QR Scan */}
                  {officerMethod === 'qr' && (
                    <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-4 flex flex-col items-center gap-3 text-center">
                      <span className="text-4xl">📷</span>
                      <p className="text-sm font-bold text-blue-800">Scan citizen's QR code with camera</p>
                      <p className="text-xs text-blue-700 font-semibold">100% offline. No photos/audio (text only). Point camera at citizen's screen using the Scan QR button in the top header.</p>
                      <button type="button" onClick={onClose}
                        className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-extrabold rounded-xl text-sm shadow transition-all cursor-pointer active:scale-98">
                        📷 Go to QR Scanner
                      </button>
                    </div>
                  )}

                  {/* PIN */}
                  {officerMethod === 'pin' && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-center">
                        <p className="text-[11px] font-bold text-amber-700">⚠️ Needs internet on both devices. Photos & audio NOT included.</p>
                      </div>
                      <input type="text" maxLength={6} value={officerPin}
                        onChange={(e) => { setOfficerPin(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '')); if (officerState === 'error') { setOfficerState('idle'); setErrorMsg('') } }}
                        placeholder="A4X9K2"
                        className="w-44 text-center text-3xl font-black tracking-[0.3em] py-3 px-3 rounded-2xl border-4 border-blue-500 focus:border-blue-700 bg-blue-50 text-slate-900 outline-none shadow-inner font-mono uppercase" autoFocus />
                      <button type="button" onClick={handleOfficerImportByPin} disabled={officerPin.trim().length !== 6 || officerState === 'importing'}
                        className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-sm shadow transition-all active:scale-98 cursor-pointer">
                        {officerState === 'importing' ? 'Importing...' : '📥 Import via PIN'}
                      </button>
                    </div>
                  )}

                  {/* Paste */}
                  {officerMethod === 'paste' && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-slate-600 text-center">Paste the report text received via Bluetooth. Photos & audio NOT included (text only):</p>
                      <textarea value={pasteText}
                        onChange={(e) => { setPasteText(e.target.value); if (officerState === 'error') { setOfficerState('idle'); setErrorMsg('') } }}
                        placeholder={'Paste text received via Bluetooth:\n\n[GIZ-REPORT]\nGIZ:DEMO-DSP-...:...'}
                        rows={5}
                        className="w-full rounded-xl border-2 border-slate-300 focus:border-emerald-500 outline-none p-3 font-mono text-xs text-slate-700 bg-slate-50 resize-none transition-colors" />
                      <button type="button" onClick={handleOfficerImportByPaste} disabled={!pasteText.trim() || officerState === 'importing'}
                        className="w-full py-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-xl text-sm shadow transition-all cursor-pointer active:scale-98">
                        {officerState === 'importing' ? 'Importing...' : '📋 Import from Pasted Text'}
                      </button>
                    </div>
                  )}

                  {officerState === 'error' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                      <p className="text-xs font-bold text-red-700">❌ {errorMsg}</p>
                    </div>
                  )}
                </>
              )}

              {officerState === 'success' && (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center text-4xl shadow-lg">✅</div>
                  <p className="text-base font-black text-slate-800">Report Saved on Your Device!</p>
                  <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-left flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Imported Report</p>
                    <p className="text-sm font-black text-slate-800">{importedRef}</p>
                    {importedNote && <p className="text-xs text-slate-600 line-clamp-2">{importedNote}</p>}
                    <div className="flex gap-2 flex-wrap mt-1">
                      {importedPhotoCount > 0 && <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">📸 {importedPhotoCount} photo(s)</span>}
                      {importedHasAudio && <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">🎙️ Audio</span>}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 max-w-xs">Saved offline. Auto-uploads to Supabase when internet is available.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button type="button" onClick={onClose}
            className={`w-full py-3 font-bold rounded-2xl text-sm cursor-pointer active:scale-98 transition-all ${officerState === 'success' ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'}`}>
            {officerState === 'success' ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
