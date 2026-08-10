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
import { queueDispute, updateCachedParcel, getCachedParcels, addSyncLog } from '../lib/offlineStorage'

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

function splitDescription(description: string | null): { category: string; note: string; remark: string } {
  if (!description) return { category: 'Uncategorized', note: '', remark: '' }
  
  let remark = ''
  let cleanDesc = description
  const remarkIdx = description.indexOf('\n[Officer Remark:')
  if (remarkIdx !== -1) {
    remark = description.slice(remarkIdx + 18, -1)
    cleanDesc = description.slice(0, remarkIdx)
  }

  const parts = cleanDesc.split(' — ')
  const category = parts[0] || 'Uncategorized'
  let note = parts.slice(1).join(' — ')
  const evidenceIdx = note.indexOf(' [Photo Evidence:')
  if (evidenceIdx !== -1) {
    note = note.slice(0, evidenceIdx)
  }

  return { category, note, remark }
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
  const [drawerTab, setDrawerTab] = useState<'details' | 'arbitration' | 'gps_audit'>('details')
  const [actionStatus, setActionStatus] = useState<DisputeStatus>('submitted')
  const [actionComment, setActionComment] = useState('')
  const [isSavingAction, setIsSavingAction] = useState(false)

  // GPS Audit tool states
  const [capturedPoints, setCapturedPoints] = useState<{ lat: number; lng: number }[]>([])
  const [gpsStep, setGpsStep] = useState(0)

  // P2P import states
  const [showImportPanel, setShowImportPanel] = useState(false)
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
  function handleImportSubmit() {
    try {
      setImportError(false)
      const data = JSON.parse(p2pCodeInput.trim())
      if (!data.id || !data.parcelId || !data.category) {
        setImportError(true)
        return
      }

      queueDispute({
        parcelId: data.parcelId,
        category: data.category,
        note: data.note || '',
        photos: data.photos || [],
        audio: data.audio || null,
      })

      setP2pCodeInput('')
      setShowImportPanel(false)
      alert('Dispute imported successfully into local offline queue!')
      loadData()
    } catch {
      setImportError(true)
    }
  }

  // Simulate scanning of code
  function handleSimulatedScan() {
    const mockPayload = {
      id: `DEMO-SCAN-${Date.now()}`,
      parcelId: 'DEMO-PARCEL-0005',
      category: 'boundary',
      note: 'Citizen reports fence moved by 2.5 meters during offline agricultural harvest.',
      photos: [],
      audio: null,
    }
    setP2pCodeInput(JSON.stringify(mockPayload, null, 2))
    alert('Simulated QR Code scan successful! Click "Import Dispute" to load into queue.')
  }

  // Expand dispute card for case management
  function openDisputeDetails(d: Dispute) {
    const { remark } = splitDescription(d.description)
    setSelectedDispute(d)
    setDrawerTab('details')
    setActionStatus(d.status)
    setActionComment(remark)
    setCapturedPoints([])
    setGpsStep(0)
  }

  // Save dispute action updates
  async function handleSaveAction() {
    if (!selectedDispute) return
    setIsSavingAction(true)
    const success = await updateDisputeStatus(selectedDispute.id, actionStatus, actionComment.trim())
    setIsSavingAction(false)
    if (success) {
      addSyncLog(`Officer Action: Updated status of ${selectedDispute.fake_reference_number} to ${actionStatus}`)
      setSelectedDispute(null)
      alert('Case resolution updated successfully!')
      loadData()
    } else {
      alert('Error updating case resolution status.')
    }
  }

  // GPS Simulation Points builder
  const simulatedWaypoints = useMemo(() => {
    if (!selectedDispute || !selectedDispute.parcel) return []
    // Pull base parcel coords from cache
    const parcelId = selectedDispute.parcel_id
    const cachedParcel = getCachedParcels().find(p => p.id === parcelId)
    const baseLat = cachedParcel?.geo_coords.lat || 19.9
    const baseLng = cachedParcel?.geo_coords.lng || 102.6
    
    return [
      { lat: baseLat - 0.0015, lng: baseLng - 0.0012 },
      { lat: baseLat - 0.0014, lng: baseLng + 0.0016 },
      { lat: baseLat + 0.0018, lng: baseLng + 0.0015 },
      { lat: baseLat + 0.0016, lng: baseLng - 0.0014 }
    ]
  }, [selectedDispute])

  // Capture Point
  function handleCaptureGpsPoint() {
    if (gpsStep >= simulatedWaypoints.length) return
    const pt = simulatedWaypoints[gpsStep]
    setCapturedPoints([...capturedPoints, pt])
    setGpsStep(prev => prev + 1)
  }

  // Apply redrawn GPS boundary
  function handleApplyGpsAudit() {
    if (capturedPoints.length < 3 || !selectedDispute) return
    
    // Find matching parcel in registry
    const parcelId = selectedDispute.parcel_id
    const cachedParcels = getCachedParcels()
    const match = cachedParcels.find(p => p.id === parcelId)
    
    if (match) {
      const updatedParcel = {
        ...match,
        status: 'registered' as const, // Cleaned up
        zone_type: match.zone_type === 'disputed' ? 'agricultural' : match.zone_type,
        polygon_coords: capturedPoints
      }
      
      updateCachedParcel(updatedParcel)
      updateDisputeStatus(selectedDispute.id, 'resolved', 'Resolved and boundaries redrawn via GPS perimeter audit walk.')
      addSyncLog(`GPS Audit: Redrew parcel boundaries for ${parcelId}. Dispute closed.`)
      
      alert('Success! GPS boundary polygons successfully saved and registered. Dispute case closed.')
      setSelectedDispute(null)
      loadData()
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
              <p className="text-xs text-slate-300">Boundary Arbitration & GPS Auditing Panel</p>
            </div>
          </div>
          
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
        
        {/* P2P Import Panel */}
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
                onClick={handleImportSubmit}
                disabled={!p2pCodeInput.trim()}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold"
              >
                Import Dispute
              </button>
              <button
                type="button"
                onClick={handleSimulatedScan}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Simulate QR Scan
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

        {isLoading && <p className="text-center text-slate-400 py-8">Loading disputes...</p>}

        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8 font-semibold">No disputes match these filters.</p>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((d) => {
            const meta = STATUS_META[d.status]
            const { category, note, remark } = splitDescription(d.description)
            const ZoneIcon = d.parcel ? ZONE_ICONS[d.parcel.zone_type] : AlertIcon
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

      {/* Case Management Drawer */}
      {selectedDispute && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4 animate-fade-in"
          onClick={() => setSelectedDispute(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 flex flex-col gap-4 shadow-xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Tab Headers */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold text-slate-400 tracking-wider font-mono">
                  {selectedDispute.fake_reference_number}
                </span>
                <h3 className="text-base font-black text-slate-800">Officer Investigation Drawer</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDispute(null)}
                className="p-1 rounded-full hover:bg-slate-100"
              >
                <XIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Tab switch buttons */}
            <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold text-slate-600 gap-1 select-none">
              <button
                type="button"
                onClick={() => setDrawerTab('details')}
                className={`flex-1 py-1.5 text-center rounded-lg transition-all ${drawerTab === 'details' ? 'bg-white text-slate-800 shadow-xs' : 'hover:bg-slate-200'}`}
              >
                🔍 Details
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('arbitration')}
                className={`flex-1 py-1.5 text-center rounded-lg transition-all ${drawerTab === 'arbitration' ? 'bg-white text-slate-800 shadow-xs' : 'hover:bg-slate-200'}`}
              >
                ⚔️ Arbitration
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('gps_audit')}
                className={`flex-1 py-1.5 text-center rounded-lg transition-all ${drawerTab === 'gps_audit' ? 'bg-white text-slate-800 shadow-xs' : 'hover:bg-slate-200'}`}
              >
                🛰️ GPS Audit
              </button>
            </div>

            {/* TAB CONTENT: DETAILS */}
            {drawerTab === 'details' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 text-xs text-slate-700">
                  <p><span className="font-bold">Village Jurisdiction:</span> {selectedDispute.parcel?.demo_village_name}</p>
                  <p><span className="font-bold">Cadastral ID:</span> {selectedDispute.parcel_id}</p>
                  
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mt-1">
                    <p className="font-bold text-[9px] uppercase text-slate-400">Citizen Note</p>
                    <p className="text-slate-800 font-semibold mt-1">
                      {splitDescription(selectedDispute.description).note || 'No notes added.'}
                    </p>
                  </div>

                  {selectedDispute.photos && selectedDispute.photos.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      <p className="font-bold text-[9px] uppercase text-slate-400">Citizen Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedDispute.photos.map((url, idx) => (
                          <a href={url} target="_blank" rel="noreferrer" key={idx} className="w-16 h-16 rounded-xl border border-slate-350 overflow-hidden shadow-xs shrink-0 cursor-pointer">
                            <img src={url} className="w-full h-full object-cover" alt="dispute attachment" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDispute.audio && (
                    <div className="flex flex-col gap-1 mt-2">
                      <p className="font-bold text-[9px] uppercase text-slate-400">Voice Evidence Note</p>
                      <audio src={selectedDispute.audio} controls className="w-full h-8 mt-1" />
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 flex flex-col gap-3 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="action-status" className="font-bold text-slate-650">Update Status</label>
                    <select
                      id="action-status"
                      value={actionStatus}
                      onChange={(e) => setActionStatus(e.target.value as DisputeStatus)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-xs font-semibold"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="in_review">In Review</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="action-comment" className="font-bold text-slate-650">Officer Comments</label>
                    <textarea
                      id="action-comment"
                      value={actionComment}
                      onChange={(e) => setActionComment(e.target.value)}
                      placeholder="Enter official resolution notes..."
                      rows={3}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-xs resize-none"
                    />
                  </div>

                  <div className="flex gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedDispute(null)}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAction}
                      disabled={isSavingAction}
                      className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-350 text-white font-bold rounded-xl text-xs"
                    >
                      {isSavingAction ? 'Saving...' : 'Save Update'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: ARBITRATION */}
            {drawerTab === 'arbitration' && (
              <div className="flex flex-col gap-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-700 mb-1">Conflicting Boundary Lines Overlay</h4>
                  <p className="text-[10px] text-slate-400 leading-tight">Visualizing overlapping spatial coordinates submitted by both neighbors.</p>
                </div>

                {/* Conflicting Boundary Overlay Map */}
                <div className="w-full h-36 bg-slate-900 rounded-2xl relative border-2 border-slate-850 overflow-hidden shadow-inner flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 200 120">
                    {/* Neighbor A Line (Blue) */}
                    <polygon points="30,85 70,25 150,45 130,100" fill="#2563eb" fillOpacity="0.15" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="3,3" />
                    {/* Neighbor B Line (Orange) */}
                    <polygon points="50,80 85,30 165,35 120,95" fill="#d97706" fillOpacity="0.15" stroke="#d97706" strokeWidth="2.5" strokeDasharray="3,3" />
                    
                    {/* Disputed overlap zone (Pulsing striped red polygon) */}
                    <polygon
                      points="50,80 70,25 150,45 120,95"
                      fill="url(#stripes)"
                      stroke="#dc2626"
                      strokeWidth="2.5"
                      className="animate-pulse"
                    />

                    {/* SVG Definitions for stripes patterns */}
                    <defs>
                      <pattern id="stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="8" stroke="#fee2e2" strokeWidth="3" />
                        <line x1="0" y1="0" x2="0" y2="8" stroke="#dc2626" strokeWidth="1.5" />
                      </pattern>
                    </defs>

                    {/* Labels */}
                    <text x="35" y="98" fill="#dbeafe" fontSize="9" fontWeight="bold">Claim A</text>
                    <text x="135" y="25" fill="#fef3c7" fontSize="9" fontWeight="bold">Claim B</text>
                    <text x="85" y="70" fill="#fee2e2" fontSize="9" fontWeight="extrabold" className="animate-pulse">Overlap Strip</text>
                  </svg>
                </div>

                {/* Joint Review columns side-by-side */}
                <div className="flex gap-3 text-[10px]">
                  {/* Neighbor A Claimant Column */}
                  <div className="flex-1 bg-blue-50/50 border border-blue-200 rounded-2xl p-2.5 flex flex-col gap-1.5">
                    <p className="font-extrabold text-blue-900 border-b border-blue-100 pb-1">👤 Neighbor A (Claimant)</p>
                    <p className="font-bold text-slate-800">Somphone S.</p>
                    <p className="text-slate-600 italic">"The boundary line historically runs along the old tamarind stump. Their concrete markers built in 2026 encroached 1.5m."</p>
                    <div className="bg-white border border-blue-150 p-1 rounded-lg text-[9px] font-mono text-slate-450 mt-1">
                      Lat: 19.9110<br />Lng: 102.6130
                    </div>
                  </div>

                  {/* Neighbor B Respondent Column */}
                  <div className="flex-1 bg-amber-50/50 border border-amber-250 rounded-2xl p-2.5 flex flex-col gap-1.5">
                    <p className="font-extrabold text-amber-900 border-b border-amber-100 pb-1">👤 Neighbor B (Respondent)</p>
                    <p className="font-bold text-slate-800">Phouvieng S.</p>
                    <p className="text-slate-600 italic">"We replaced the fence posts exactly along our traditional lease path. The lease document supports our placement."</p>
                    <div className="bg-white border border-amber-200 p-1 rounded-lg text-[9px] font-mono text-slate-450 mt-1">
                      Lat: 19.9115<br />Lng: 102.6125
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('gps_audit')}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-center shadow active:scale-95 transition-all cursor-pointer"
                  >
                    🛰️ Launch GPS Audit Walk
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: GPS AUDIT TOOL */}
            {drawerTab === 'gps_audit' && (
              <div className="flex flex-col gap-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-700 mb-1">GPS Boundary Perimeter Walk</h4>
                  <p className="text-[10px] text-slate-400 leading-tight">Walk around the plot coordinates and capture corner benchmarks in real-time.</p>
                </div>

                {/* Audit walk simulation canvas */}
                <div className="w-full h-40 bg-slate-900 rounded-2xl relative border-2 border-slate-850 overflow-hidden shadow-inner flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 200 120">
                    <rect x="0" y="0" width="200" height="120" fill="#1e293b" />
                    
                    {/* Background Grid */}
                    <g stroke="#334155" strokeWidth="0.5">
                      <line x1="20" y1="0" x2="20" y2="120" />
                      <line x1="60" y1="0" x2="60" y2="120" />
                      <line x1="100" y1="0" x2="100" y2="120" />
                      <line x1="140" y1="0" x2="140" y2="120" />
                      <line x1="180" y1="0" x2="180" y2="120" />
                      <line x1="0" y1="20" x2="200" y2="20" />
                      <line x1="0" y1="60" x2="200" y2="60" />
                      <line x1="0" y1="100" x2="200" y2="100" />
                    </g>

                    {/* Pre-existing disputed plot outline */}
                    <polygon points="50,75 80,30 140,40 110,85" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,3" />

                    {/* Developing new polygon outline (Green) */}
                    {capturedPoints.length > 0 && (
                      <polyline
                        points={capturedPoints.map((_, i) => {
                          const pts = [
                            '60,85',
                            '70,25',
                            '150,45',
                            '120,95'
                          ]
                          return pts[i]
                        }).slice(0, capturedPoints.length).join(' ')}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Closed polygon (if complete) */}
                    {capturedPoints.length === 4 && (
                      <polygon points="60,85 70,25 150,45 120,95" fill="#10b981" fillOpacity="0.15" />
                    )}

                    {/* Current Walk Position Dot Indicator */}
                    {gpsStep < simulatedWaypoints.length && (
                      <circle
                        cx={['60', '70', '150', '120'][gpsStep]}
                        cy={['85', '25', '45', '95'][gpsStep]}
                        r="6"
                        fill="#f43f5e"
                        className="animate-pulse"
                      />
                    )}
                  </svg>

                  {/* Satellite status box */}
                  <div className="absolute top-2 left-2 bg-slate-950/80 text-emerald-400 font-mono text-[9px] px-2 py-1 rounded-md border border-slate-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    GPS Accuracy: ±1.2m
                  </div>
                </div>

                {/* Progress check list of points */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-bold text-slate-700">Captured Corners Ledger ({capturedPoints.length} of 4)</span>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 max-h-24 overflow-y-auto flex flex-col gap-1 text-[10px] font-mono text-slate-550">
                    {capturedPoints.length === 0 && <span className="text-slate-400 italic">No corner coordinates captured yet.</span>}
                    {capturedPoints.map((pt, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-750">
                        <span>📍 Corner Benchmark #{i+1}</span>
                        <span>{pt.lat.toFixed(6)}°, {pt.lng.toFixed(6)}°</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {gpsStep < simulatedWaypoints.length ? (
                    <button
                      type="button"
                      onClick={handleCaptureGpsPoint}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow active:scale-95 transition-all cursor-pointer"
                    >
                      📸 Capture Point #{gpsStep + 1}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyGpsAudit}
                      disabled={capturedPoints.length < 3}
                      className="flex-1 py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold rounded-2xl shadow active:scale-95 transition-all cursor-pointer"
                    >
                      💾 Apply New Boundary & Resolve
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setCapturedPoints([]); setGpsStep(0) }}
                    className="px-3.5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl border border-slate-250 cursor-pointer"
                  >
                    Reset Walk
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
