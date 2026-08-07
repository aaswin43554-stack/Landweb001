import { useEffect, useMemo, useState } from 'react'
import {
  AlertIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ClockIcon,
  CropIcon,
  HomeIcon,
  SearchIcon,
  TreeIcon,
  XIcon,
} from '../components/icons'
import { ConnectionStatus } from '../components/ConnectionStatus'
import {
  fetchDisputes,
  fetchVillages,
  updateDisputeStatus,
  type Dispute,
  type DisputeStatus,
  type Village,
  type ZoneType,
} from '../lib/land'
import { useTranslations } from '../lib/translations'
import { queueDispute } from '../lib/offlineStorage'
import { parseSyncPayload } from '../lib/syncPayload'
import { QrScanner } from '../components/QrScanner'
import { EvidenceGallery } from '../components/EvidenceGallery'

const ZONE_ICONS: Record<ZoneType, typeof TreeIcon> = {
  forest: TreeIcon,
  agricultural: CropIcon,
  residential: HomeIcon,
  disputed: AlertIcon,
}

const STATUS_META: Record<DisputeStatus, { label: string; Icon: typeof ClockIcon; text: string; bg: string; border: string }> = {
  submitted: { label: 'Submitted', Icon: ClockIcon, text: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-400' },
  in_review: { label: 'In review', Icon: SearchIcon, text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-400' },
  resolved: { label: 'Resolved', Icon: CheckCircleIcon, text: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-400' },
}

const STATUS_FILTERS: (DisputeStatus | 'all')[] = ['all', 'submitted', 'in_review', 'resolved']

function splitDescription(description: string | null): { category: string; note: string } {
  if (!description) return { category: 'Uncategorized', note: '' }
  const parts = description.split(' — ')
  return { category: parts[0] || 'Uncategorized', note: parts.slice(1).join(' — ') }
}

/**
 * The most recent officer remark for a dispute, or '' if there is none.
 */
function latestRemark(dispute: Dispute): string {
  const withNotes = (dispute.events ?? []).filter((e) => e.note)
  return withNotes.length > 0 ? (withNotes[withNotes.length - 1].note as string) : ''
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function FieldOfficerScreen() {
  const { t } = useTranslations()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [villageFilter, setVillageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'all'>('all')
  const [sortAsc, setSortAsc] = useState(false)

  // Drawer / Action States
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)
  const [actionStatus, setActionStatus] = useState<DisputeStatus>('submitted')
  const [actionComment, setActionComment] = useState('')
  const [isSavingAction, setIsSavingAction] = useState(false)

  // P2P import states
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [p2pCodeInput, setP2pCodeInput] = useState('')
  const [importError, setImportError] = useState(false)

  function loadData() {
    setIsLoading(true)
    Promise.all([fetchDisputes(), fetchVillages()]).then(([d, v]) => {
      setDisputes(d)
      setVillages(v)
      setIsLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    let rows = disputes
    if (villageFilter !== 'all') rows = rows.filter((d) => d.parcel?.village_id === villageFilter)
    if (statusFilter !== 'all') rows = rows.filter((d) => d.status === statusFilter)
    return [...rows].sort((a, b) =>
      sortAsc ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at),
    )
  }, [disputes, villageFilter, statusFilter, sortAsc])

  // Import Dispute from QR code / text stream
  async function handleImportSubmit(raw: string = p2pCodeInput) {
    const payload = parseSyncPayload(raw)
    if (!payload) {
      setImportError(true)
      return
    }

    setImportError(false)
    await queueDispute({
      id: payload.id,
      referenceNumber: payload.id,
      parcelId: payload.parcelId,
      category: payload.category,
      note: payload.note,
      photos: [],
      audio: null,
    })

    setP2pCodeInput('')
    setShowImportPanel(false)

    const pending = [
      payload.photoCount > 0 ? `${payload.photoCount} photo(s)` : null,
      payload.hasAudio ? 'a voice note' : null,
    ].filter(Boolean)

    alert(
      pending.length > 0
        ? `Imported ${payload.id}. ${pending.join(' and ')} remain on the citizen's device and will sync when either device is online.`
        : `Imported ${payload.id} into the local offline queue.`,
    )
    loadData()
  }

  function handleScanResult(value: string) {
    setShowScanner(false)
    setP2pCodeInput(value)
    handleImportSubmit(value)
  }

  // Expand dispute card for case management
  function openDisputeDetails(d: Dispute) {
    setSelectedDispute(d)
    setActionStatus(d.status)
    setActionComment('')
  }

  // Save dispute action updates
  async function handleSaveAction() {
    if (!selectedDispute) return
    setIsSavingAction(true)
    const success = await updateDisputeStatus(
      selectedDispute.id,
      actionStatus,
      actionComment.trim(),
    )
    setIsSavingAction(false)
    if (success) {
      setSelectedDispute(null)
      alert('Case updated. The citizen can now see this on their "My Case" screen.')
      loadData()
    } else {
      alert('Error updating case resolution status.')
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative">
      <div className="bg-slate-800 text-white px-4 py-5 shadow-sm">
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <BriefcaseIcon className="w-7 h-7 shrink-0 text-slate-350" />
            <div>
              <h2 className="text-lg font-bold">{t('nav.field_officer')}</h2>
              <p className="text-xs text-slate-300">Case Resolution & Offline Sync Tool</p>
            </div>
          </div>
          
          {/* P2P Sync Trigger Button */}
          <button
            type="button"
            onClick={() => setShowImportPanel(!showImportPanel)}
            className="flex items-center gap-1 bg-emerald-700 text-white border-2 border-emerald-600 px-3 py-1.5 rounded-xl font-bold text-xs hover:bg-emerald-800 transition-all cursor-pointer shadow-sm"
          >
            📥 Import P2P Sync
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 py-5 max-w-2xl mx-auto w-full pb-16">
        
        {/* P2P Import Panel Overlay */}
        {showImportPanel && (
          <div className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-md flex flex-col gap-3 animate-in slide-in-from-top-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-800 text-sm">Offline P2P Import Scanner</p>
              <button
                type="button"
                onClick={() => setShowImportPanel(false)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <XIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500">
              Paste the Base64 sync code from the citizen's device below, or simulate camera scanning.
            </p>

            <textarea
              value={p2pCodeInput}
              onChange={(e) => setP2pCodeInput(e.target.value)}
              placeholder="Paste sync code here..."
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-2 font-mono text-xs focus:outline-slate-400"
            />

            {importError && (
              <p className="text-xs font-semibold text-red-600">❌ Invalid Sync Code structure. Try again.</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleImportSubmit()}
                disabled={!p2pCodeInput.trim()}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold"
              >
                Import Dispute
              </button>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Scan QR Code
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            aria-label="Filter by village"
            className="rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <option value="all">All villages</option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DisputeStatus | 'all')}
            aria-label="Filter by status"
            className="rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : STATUS_META[s].label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setSortAsc((s) => !s)}
            className="rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-650 active:bg-slate-100"
          >
            {sortAsc ? 'Oldest first' : 'Newest first'}
          </button>
        </div>

        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Showing {filtered.length} of {disputes.length} disputes
        </p>

        {isLoading && <p className="text-center text-slate-400 py-8">Loading…</p>}

        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8 font-semibold">No disputes match these filters.</p>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((d) => {
            const meta = STATUS_META[d.status]
            const { category, note } = splitDescription(d.description)
            const remark = latestRemark(d)
            const ZoneIcon = d.parcel ? ZONE_ICONS[d.parcel.zone_type] : AlertIcon
            
            // Check if this dispute contains evidence markers
            const hasPhotos = d.photos && d.photos.length > 0
            const hasAudio = Boolean(d.audio)

            return (
              <button
                key={d.id}
                type="button"
                onClick={() => openDisputeDetails(d)}
                className={`w-full text-left rounded-xl border-2 hover:bg-slate-50 transition-all ${meta.border} bg-white p-4 flex flex-col gap-2 relative shadow-sm hover:scale-101 active:scale-99 cursor-pointer`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="font-mono text-sm font-bold text-slate-700 truncate">{d.fake_reference_number}</span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full ${meta.bg} ${meta.text} px-2.5 py-1 text-xs font-bold shrink-0`}
                  >
                    <meta.Icon className="w-4 h-4" />
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <ZoneIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold">{d.parcel?.demo_village_name ?? 'Unknown village'}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-xs truncate">{d.parcel_id}</span>
                </div>

                <p className="text-sm font-bold text-slate-800">{category}</p>
                {note && <p className="text-sm text-slate-600 line-clamp-2">{note}</p>}
                
                {/* Evidence icons badges */}
                {(hasPhotos || hasAudio) && (
                  <div className="flex gap-2 items-center mt-1">
                    {hasPhotos && <span className="text-[10px] font-bold bg-slate-100 text-slate-750 px-1.5 py-0.5 rounded-md">📸 Photos</span>}
                    {hasAudio && <span className="text-[10px] font-bold bg-slate-100 text-slate-750 px-1.5 py-0.5 rounded-md">🎙️ Voice Clip</span>}
                  </div>
                )}

                {remark && (
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-2 mt-1 text-xs text-slate-700">
                    <span className="font-bold">Remarks:</span> {remark}
                  </div>
                )}

                <p className="text-[10px] text-slate-400 mt-1">
                  Submitted {formatDate(d.created_at)} · {d.submitted_by}
                </p>
              </button>
            )
          })}
        </div>

        <div className="mt-4 shrink-0">
          <ConnectionStatus />
        </div>
      </div>

      {showScanner && (
        <QrScanner
          title="Scan citizen sync code"
          hint="Point the camera at the QR code on the citizen's phone."
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Case Management Resolution Drawer overlay */}
      {selectedDispute && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4"
          onClick={() => setSelectedDispute(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 flex flex-col gap-4 shadow-xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 tracking-wider font-mono">
                  {selectedDispute.fake_reference_number}
                </span>
                <h3 className="text-lg font-bold text-slate-800">Case Resolution Panel</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDispute(null)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <XIcon className="w-6 h-6 text-slate-500" />
              </button>
            </div>

            <div className="border-t border-slate-100 pt-3 flex flex-col gap-2 text-sm text-slate-700">
              <p>
                <span className="font-bold">Village:</span> {selectedDispute.parcel?.demo_village_name}
              </p>
              <p>
                <span className="font-bold">Parcel ID:</span> {selectedDispute.parcel_id}
              </p>
              <p>
                <span className="font-bold">Zoning:</span> {selectedDispute.parcel ? t(`zone.${selectedDispute.parcel.zone_type}`) : 'Unknown'}
              </p>
              
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mt-1">
                <p className="font-bold text-xs uppercase text-slate-400">Citizen Note</p>
                <p className="text-slate-800 font-semibold mt-1 whitespace-pre-wrap break-words">
                  {splitDescription(selectedDispute.description).note || 'No notes added by citizen.'}
                </p>
              </div>

              {(selectedDispute.events?.length ?? 0) > 0 && (
                <div className="mt-2">
                  <p className="font-bold text-xs uppercase text-slate-400">Case history</p>
                  <ol className="mt-1.5 flex flex-col gap-1.5">
                    {selectedDispute.events?.map((e, i) => (
                      <li key={i} className="text-xs text-slate-600 border-l-2 border-slate-200 pl-2.5">
                        <span className="font-bold text-slate-800">{STATUS_META[e.to_status].label}</span>
                        <span className="text-slate-400"> · {formatDate(e.created_at)} · {e.actor}</span>
                        {e.note && <p className="text-slate-700 mt-0.5 break-words">{e.note}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Multimodal Attachments Previews */}
              <EvidenceGallery
                photos={selectedDispute.photos ?? []}
                audio={selectedDispute.audio ?? null}
                referenceNumber={selectedDispute.fake_reference_number}
              />
            </div>

            {/* Action controls */}
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="action-status" className="font-bold text-xs uppercase text-slate-400">
                  Update Status
                </label>
                <select
                  id="action-status"
                  value={actionStatus}
                  onChange={(e) => setActionStatus(e.target.value as DisputeStatus)}
                  className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 bg-white text-sm"
                >
                  <option value="submitted">Submitted</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="action-comment" className="font-bold text-xs uppercase text-slate-400">
                  Add remark (shown to the citizen)
                </label>
                <textarea
                  id="action-comment"
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder="Explain what happens next, in plain language..."
                  rows={3}
                  className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 bg-white text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAction}
                  disabled={isSavingAction}
                  className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-350 text-white font-bold rounded-xl text-sm"
                >
                  {isSavingAction ? 'Saving...' : 'Save Resolution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
