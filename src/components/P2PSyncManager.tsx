import { useState, useEffect, useRef } from 'react'
import { importReceivedFile, shareFullReportAsFile, downloadReportFile } from '../lib/bluetoothSync'
import type { ReportPackage } from '../lib/bluetoothSync'
import { buildSyncPayload, encodeCompact } from '../lib/syncPayload'
import { getDisputeQueue } from '../lib/offlineStorage'
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
type OfficerMethod = 'file' | 'qr'

async function buildCompactCode(activeShareData?: Props['activeShareData']): Promise<string> {
  let payload
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

  return encodeCompact(payload)
}

export function P2PSyncManager({ role, onClose, onSyncSuccess, activeShareData }: Props) {
  const [compact, setCompact] = useState('')
  const [codeReady, setCodeReady] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const [hasPhotos, setHasPhotos] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [citizenShareMsg, setCitizenShareMsg] = useState('')
  const [isSearchingDevice, setIsSearchingDevice] = useState(false)

  const [officerMethod, setOfficerMethod] = useState<OfficerMethod>('file')
  const [officerState, setOfficerState] = useState<OfficerState>('idle')
  const [importedRef, setImportedRef] = useState('')
  const [importedNote, setImportedNote] = useState('')
  const [importedPhotoCount, setImportedPhotoCount] = useState(0)
  const [importedHasAudio, setImportedHasAudio] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (role !== 'citizen') return
    buildCompactCode(activeShareData).then((c) => { setCompact(c); setCodeReady(true) })
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

    const pkg: ReportPackage = activeShareData?.referenceNumber
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
      : {
          version: 2 as const,
          referenceNumber: `DEMO-DSP-${Date.now().toString().slice(-4)}`,
          parcelId: 'DEMO-PARCEL-0001',
          category: 'boundary',
          note: 'Land dispute report (demo)',
          photos: [],
          audio: null,
          timestamp: Date.now(),
        }

    if (preferredMethod === 'download') {
      setIsSearchingDevice(true)
      downloadReportFile(pkg)
      setCitizenShareMsg(`📥 Report file downloaded (giz-report-${pkg.referenceNumber}.giz.json)! Share this file with the Officer via QuickShare / Bluetooth in your phone's File Manager.`)
      setIsSearchingDevice(false)
      return
    }

    setIsSearchingDevice(true)
    const res = await shareFullReportAsFile(pkg)
    setIsSearchingDevice(false)

    if (res === 'shared') {
      setCitizenShareMsg(`✅ Share panel opened! Select QuickShare, Bluetooth, or AirDrop to send to the Officer.`)
    } else if (res === 'cancelled') {
      setCitizenShareMsg(`↩️ Share cancelled. Tap the button again to retry.`)
    } else {
      setCitizenShareMsg(`📥 Report file downloaded (giz-report-${pkg.referenceNumber}.giz.json)! Import this file in the Officer app.`)
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

              {/* Option 1: Direct File Share (Photos & Audio Included) */}
              <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                    <span className="text-xs font-extrabold text-emerald-800">Share Report File (Photos & Audio)</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {hasPhotos && <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">📸 Photos</span>}
                    {hasAudio && <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">🎙️ Audio</span>}
                  </div>
                </div>

                <p className="text-[11px] text-emerald-700 font-semibold">
                  Sends full report package with photos & voice notes to nearby Officer device:
                </p>

                {isSearchingDevice && (
                  <div className="rounded-xl border-2 border-emerald-400 bg-emerald-100/70 p-2.5 flex flex-col items-center gap-1.5 text-center animate-in fade-in duration-200">
                    <div className="relative flex items-center justify-center w-8 h-8">
                      <div className="absolute w-8 h-8 rounded-full bg-emerald-500/30 animate-ping" />
                      <div className="relative w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px]">📡</div>
                    </div>
                    <p className="text-xs font-extrabold text-emerald-900">Opening Share Sheet...</p>
                    <p className="text-[10px] font-semibold text-emerald-700">Select QuickShare, Bluetooth, or AirDrop</p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleCitizenShareWithMedia('quickshare')}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-sm shadow transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>⚡</span> Share File (QuickShare / Bluetooth / AirDrop)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCitizenShareWithMedia('download')}
                    className="w-full py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>📥</span> Save / Download Report File (.giz.json)
                  </button>
                </div>

                {citizenShareMsg && (
                  <div className="rounded-xl border border-emerald-300 bg-white p-2.5 text-xs font-bold text-emerald-900 shadow-sm animate-in fade-in duration-200">
                    {citizenShareMsg}
                  </div>
                )}
              </div>

              {/* Option 2: QR Code Scan (Text Only) */}
              <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                    <span className="text-xs font-extrabold text-blue-800">QR Code Scan (Text Only)</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">📷 Camera Scan</span>
                </div>

                <p className="text-[11px] text-blue-700 font-semibold">
                  Officer scans your screen with camera (100% offline text details, no photos/audio):
                </p>

                {!showQrCode ? (
                  <button
                    type="button"
                    onClick={() => setShowQrCode(true)}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>📷</span> Show QR Code
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                    {codeReady ? (
                      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-blue-200 my-1">
                        <QrCode value={`[GIZ-REPORT]\n${compact}`} size={160} className="w-40 h-40" />
                      </div>
                    ) : (
                      <div className="w-40 h-40 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowQrCode(false)}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer mt-1"
                    >
                      Hide QR Code
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── OFFICER VIEW ─── */}
          {role !== 'citizen' && (
            <div className="flex flex-col gap-4">
              {officerState !== 'success' && (
                <>
                  {/* Method selector tabs */}
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl">
                    {([
                      { key: 'file', label: '📂 File (Photos & Audio)', sub: 'Bluetooth / QuickShare' },
                      { key: 'qr',   label: '📷 QR Code',   sub: '100% offline text' },
                    ] as const).map(({ key, label, sub }) => (
                      <button key={key} type="button"
                        onClick={() => { setOfficerMethod(key); setOfficerState('idle'); setErrorMsg('') }}
                        className={`flex flex-col items-center py-2.5 px-2 rounded-lg text-center transition-all cursor-pointer ${officerMethod === key ? 'bg-white shadow text-emerald-800 font-extrabold border border-emerald-200' : 'text-slate-500 font-semibold hover:bg-white/60'}`}>
                        <span className="text-xs font-extrabold">{label}</span>
                        <span className="text-[10px] opacity-75">{sub}</span>
                      </button>
                    ))}
                  </div>

                  {/* File Import — photos & audio */}
                  {officerMethod === 'file' && (
                    <div className="flex flex-col gap-3">
                      <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4 flex flex-col gap-3 text-center">
                        <span className="text-3xl">📂</span>
                        <p className="text-sm font-extrabold text-emerald-800">Import Report File from Citizen</p>
                        <p className="text-xs text-emerald-700 font-semibold">
                          Citizen sends a <strong>giz-report-xxx.txt</strong> or <strong>.giz.json</strong> file via QuickShare/Bluetooth. Once received in your Downloads, tap "Select File" below.
                        </p>
                        <input ref={fileInputRef} type="file"
                          accept="text/plain,text/*,.txt,.json,.giz.json,application/json,*/*"
                          onChange={handleOfficerFileImport}
                          className="hidden" id="giz-file-import" />
                        <label htmlFor="giz-file-import"
                          className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-sm shadow transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98">
                          {officerState === 'importing' ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                              Importing...
                            </span>
                          ) : <><span>📂</span> Select Received File (.txt / .json)</>}
                        </label>
                      </div>
                    </div>
                  )}

                  {/* QR Scan */}
                  {officerMethod === 'qr' && (
                    <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-4 flex flex-col items-center gap-3 text-center">
                      <span className="text-4xl">📷</span>
                      <p className="text-sm font-bold text-blue-800">Scan Citizen's QR Code with Camera</p>
                      <p className="text-xs text-blue-700 font-semibold">100% offline. Transfers dispute text and case details. Point camera at citizen's screen using the Scan QR button.</p>
                      <button type="button" onClick={onClose}
                        className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-extrabold rounded-xl text-sm shadow transition-all cursor-pointer active:scale-98">
                        📷 Go to QR Scanner
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

