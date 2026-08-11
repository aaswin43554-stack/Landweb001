import { useState } from 'react'
import { importReceivedReport } from '../lib/bluetoothSync'

type Props = {
  role: 'citizen' | 'field-officer' | 'admin'
  onClose: () => void
  onSyncSuccess?: () => void
  /** Pass citizen's sync code directly so the officer paste box pre-fills on success */
  citizenSyncCode?: string
}

type OfficerState = 'idle' | 'importing' | 'success' | 'error'

export function P2PSyncManager({ role, onClose, onSyncSuccess, citizenSyncCode: _unused }: Props) {
  // ─── OFFICER STATE ────────────────────────────────────────────────────────
  const [pasteText, setPasteText] = useState('')
  const [officerState, setOfficerState] = useState<OfficerState>('idle')
  const [importedRef, setImportedRef] = useState('')
  const [importedNote, setImportedNote] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleOfficerImport() {
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
      setErrorMsg(result.error)
      setOfficerState('error')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-900 px-6 pt-6 pb-8 text-white text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-4xl mb-2">{role === 'citizen' ? '📶' : '📥'}</div>
          <h3 className="text-lg font-extrabold">
            {role === 'citizen' ? 'Bluetooth / QuickShare Sender' : 'Field Officer Receiver'}
          </h3>
          <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
            0% Internet Required
          </span>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">

          {/* ─── CITIZEN VIEW ─── */}
          {role === 'citizen' && (
            <div className="flex flex-col gap-3 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Your report has been saved offline. Send it to the Field Officer using your phone's Bluetooth or Nearby Share:
              </p>

              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-left flex flex-col gap-2">
                <p className="text-xs font-extrabold text-emerald-800 uppercase tracking-wide">How it works:</p>
                <ol className="text-xs text-emerald-900 font-semibold list-decimal list-inside flex flex-col gap-1">
                  <li>Tap <strong>"Send Report"</strong> below</li>
                  <li>Your phone opens the <strong>native share panel</strong></li>
                  <li>Select <strong>Bluetooth</strong>, <strong>QuickShare</strong>, or <strong>Nearby Share</strong></li>
                  <li>Choose the Officer's device from the list</li>
                  <li>Report code sends wirelessly — <strong>0% internet!</strong></li>
                </ol>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Officer will receive this:</p>
                <p className="text-[11px] font-mono text-slate-700 break-all line-clamp-2">
                  [GIZ-REPORT] {'{...report data...}'}
                </p>
              </div>

              <p className="text-[10px] text-slate-400 font-semibold">
                Officer opens the app → Import P2P Sync → Pastes the received text → Report saved on their device → Auto-uploads to Supabase when they get internet.
              </p>
            </div>
          )}

          {/* ─── OFFICER VIEW ─── */}
          {role !== 'citizen' && (
            <div className="flex flex-col gap-3">
              {officerState !== 'success' && (
                <>
                  <p className="text-sm font-semibold text-slate-700 text-center">
                    Ask the citizen to send the report via Bluetooth or QuickShare to this device. Then paste the received text below:
                  </p>

                  <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 flex flex-col gap-2">
                    <p className="text-xs font-extrabold text-blue-800 uppercase tracking-wide">How to receive:</p>
                    <ol className="text-xs text-blue-900 font-semibold list-decimal list-inside flex flex-col gap-1">
                      <li>Citizen taps <strong>"Send Report via Bluetooth"</strong> on their phone</li>
                      <li>Citizen selects this device via <strong>Bluetooth / QuickShare</strong></li>
                      <li>You receive a text message on this phone</li>
                      <li><strong>Copy that text</strong> and paste it in the box below</li>
                      <li>Tap <strong>"Import Report"</strong> — it saves offline!</li>
                    </ol>
                  </div>

                  <textarea
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value)
                      if (officerState === 'error') setOfficerState('idle')
                      setErrorMsg('')
                    }}
                    placeholder={'Paste the text received from citizen here...\n\nExample:\n[GIZ-REPORT]\n{"v":1,"id":"DEMO-DSP-..."}'}
                    rows={6}
                    className="w-full rounded-xl border-2 border-slate-300 focus:border-emerald-500 outline-none p-3 font-mono text-xs text-slate-800 bg-slate-50 resize-none transition-colors"
                  />

                  {officerState === 'error' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-xs font-bold text-red-700">❌ {errorMsg}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleOfficerImport}
                    disabled={!pasteText.trim() || officerState === 'importing'}
                    className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-sm transition-all shadow cursor-pointer active:scale-98"
                  >
                    {officerState === 'importing' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Importing...
                      </span>
                    ) : '📥 Import Report from Citizen'}
                  </button>
                </>
              )}

              {officerState === 'success' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-600 flex items-center justify-center text-4xl shadow-lg">
                    ✅
                  </div>
                  <p className="text-base font-black text-slate-800">Report Saved on Your Device!</p>
                  <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-left flex flex-col gap-1">
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Imported Report</p>
                    <p className="text-sm font-black text-slate-800">{importedRef}</p>
                    {importedNote && (
                      <p className="text-xs text-slate-600 line-clamp-2">{importedNote}</p>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 max-w-xs">
                    Saved in your local device database. Will automatically upload to Supabase when you reach an internet connection area.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className={`w-full py-3 font-bold rounded-2xl text-sm cursor-pointer active:scale-98 transition-all ${
              officerState === 'success'
                ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            {officerState === 'success' ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
