import { useEffect, useMemo, useState } from 'react'
import {
  AlertIcon,
  CropIcon,
  HomeIcon,
  TreeIcon,
  XIcon
} from '../components/icons'
import {
  fetchVillages,
  fetchAllParcels,
  type Parcel,
  type Village,
  type ZoneType,
  type ParcelStatus
} from '../lib/land'
import {
  addCachedParcel,
  updateCachedParcel,
  deleteCachedParcel,
  getSyncLogs,
  addSyncLog
} from '../lib/offlineStorage'
import { useTranslations } from '../lib/translations'

const ZONE_ICONS: Record<ZoneType, typeof TreeIcon> = {
  forest: TreeIcon,
  agricultural: CropIcon,
  residential: HomeIcon,
  disputed: AlertIcon,
}

const ZONE_COLORS: Record<ZoneType, { fill: string; ring: string; text: string; bg: string }> = {
  forest: { fill: '#d1fae5', ring: '#059669', text: '#065f46', bg: 'bg-emerald-50' },
  agricultural: { fill: '#fef3c7', ring: '#d97706', text: '#92400e', bg: 'bg-amber-50' },
  residential: { fill: '#dbeafe', ring: '#2563eb', text: '#1e40af', bg: 'bg-blue-50' },
  disputed: { fill: '#fee2e2', ring: '#dc2626', text: '#991b1b', bg: 'bg-red-50' },
}

const STATUS_COLORS: Record<ParcelStatus, { bg: string; border: string; text: string }> = {
  registered: { bg: 'bg-emerald-50', border: 'border-emerald-250', text: 'text-emerald-800' },
  pending: { bg: 'bg-amber-50', border: 'border-amber-250', text: 'text-amber-800' },
  disputed: { bg: 'bg-red-50', border: 'border-red-250', text: 'text-red-800' },
}

export function AdminDashboardScreen() {
  const { t } = useTranslations()
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [syncLogs, setSyncLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtering states
  const [villageFilter, setVillageFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Edit / Add modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)

  // Form states
  const [formId, setFormId] = useState('')
  const [formVillageId, setFormVillageId] = useState('')
  const [formZoneType, setFormZoneType] = useState<ZoneType>('agricultural')
  const [formStatus, setFormStatus] = useState<ParcelStatus>('registered')
  const [formLat, setFormLat] = useState('19.9000')
  const [formLng, setFormLng] = useState('102.6000')

  function loadData() {
    setIsLoading(true)
    Promise.all([fetchAllParcels(), fetchVillages()]).then(([p, v]) => {
      setParcels(p)
      setVillages(v)
      setSyncLogs(getSyncLogs())
      setIsLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Derived Analytics Stats
  const stats = useMemo(() => {
    const total = parcels.length
    const activeDisputes = parcels.filter(p => p.status === 'disputed' || p.zone_type === 'disputed').length
    const resolvedCases = parcels.filter(p => p.status === 'registered' && p.zone_type !== 'disputed').length
    const pendingCount = parcels.filter(p => p.status === 'pending').length
    
    // Zoning Count
    const zoningCounts: Record<ZoneType, number> = { forest: 0, agricultural: 0, residential: 0, disputed: 0 }
    for (const p of parcels) {
      zoningCounts[p.zone_type] = (zoningCounts[p.zone_type] || 0) + 1
    }

    return {
      total,
      activeDisputes,
      resolvedCases,
      pendingCount,
      zoningCounts
    }
  }, [parcels])

  // Filtered parcels list
  const filteredParcels = useMemo(() => {
    return parcels.filter(p => {
      const matchVillage = villageFilter === 'all' || p.village_id === villageFilter
      const matchSearch = searchQuery === '' || p.id.toLowerCase().includes(searchQuery.toLowerCase()) || p.demo_village_name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchVillage && matchSearch
    })
  }, [parcels, villageFilter, searchQuery])

  // Modal open triggers
  function handleOpenAdd() {
    setFormId(`DEMO-PARCEL-${(parcels.length + 1).toString().padStart(4, '0')}`)
    setFormVillageId(villages[0]?.id || '')
    setFormZoneType('agricultural')
    setFormStatus('registered')
    setFormLat('19.9000')
    setFormLng('102.6000')
    setShowAddModal(true)
  }

  function handleOpenEdit(parcel: Parcel) {
    setSelectedParcel(parcel)
    setFormId(parcel.id)
    setFormVillageId(parcel.village_id)
    setFormZoneType(parcel.zone_type)
    setFormStatus(parcel.status)
    setFormLat(parcel.geo_coords.lat.toFixed(4))
    setFormLng(parcel.geo_coords.lng.toFixed(4))
    setShowEditModal(true)
  }

  // Handle Add Parcel Submit
  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formId.trim() || !formVillageId) return

    const village = villages.find(v => v.id === formVillageId)
    const newParcel: Parcel = {
      id: formId.trim(),
      village_id: formVillageId,
      demo_village_name: village?.name || 'Unknown',
      zone_type: formZoneType,
      status: formStatus,
      geo_coords: { lat: parseFloat(formLat) || 19.9, lng: parseFloat(formLng) || 102.6 }
    }

    addCachedParcel(newParcel)
    addSyncLog(`Admin Action: Created parcel ${newParcel.id} in ${newParcel.demo_village_name}`)
    setShowAddModal(false)
    loadData()
  }

  // Handle Edit Parcel Submit
  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedParcel) return

    const village = villages.find(v => v.id === formVillageId)
    const updatedParcel: Parcel = {
      ...selectedParcel,
      zone_type: formZoneType,
      status: formStatus,
      village_id: formVillageId,
      demo_village_name: village?.name || selectedParcel.demo_village_name,
      geo_coords: { lat: parseFloat(formLat) || selectedParcel.geo_coords.lat, lng: parseFloat(formLng) || selectedParcel.geo_coords.lng }
    }

    // Keep existing polygon boundary coords if available
    if (selectedParcel.polygon_coords) {
      updatedParcel.polygon_coords = selectedParcel.polygon_coords
    }

    updateCachedParcel(updatedParcel)
    addSyncLog(`Admin Action: Reclassified/updated parcel ${updatedParcel.id} properties`)
    setShowEditModal(false)
    loadData()
  }

  // Handle Delete Parcel
  function handleDelete(parcelId: string) {
    if (!confirm(`Are you sure you want to delete parcel ${parcelId} from the registry?`)) return
    deleteCachedParcel(parcelId)
    addSyncLog(`Admin Action: Deleted parcel ${parcelId} from database`)
    setShowEditModal(false)
    loadData()
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-0">

      {/* Top Banner — full width */}
      <div className="bg-slate-900 text-white px-4 py-4 shadow-sm shrink-0">
        <div className="flex items-center justify-between max-w-[1400px] mx-auto w-full">
          <div>
            <h2 className="text-lg md:text-xl font-black flex items-center gap-2">
              📊 Land Registry Administrator Console
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Village Chief Dashboard &amp; Cadastral Database Editor</p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            ➕ Register New Parcel
          </button>
        </div>
      </div>

      {/* ── Tablet 2-panel layout ── */}
      <div className="flex-1 flex flex-row min-h-0 max-w-[1400px] mx-auto w-full">

        {/* ── LEFT SIDEBAR (tablet+) ── */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="flex flex-col gap-5 p-4">

            {/* Sidebar: Filters */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Filters</p>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID / village…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-slate-50 focus:outline-none focus:border-emerald-500"
              />
              <select
                value={villageFilter}
                onChange={(e) => setVillageFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-slate-50"
              >
                <option value="all">All Villages</option>
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Sidebar: Quick Stats */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Quick Stats</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Total</p>
                  <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-[9px] font-bold text-red-400 uppercase">Disputes</p>
                  <p className="text-2xl font-black text-red-600">{stats.activeDisputes}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-[9px] font-bold text-emerald-500 uppercase">Clean</p>
                  <p className="text-2xl font-black text-emerald-700">{stats.resolvedCases}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-[9px] font-bold text-amber-500 uppercase">Pending</p>
                  <p className="text-2xl font-black text-amber-700">{stats.pendingCount}</p>
                </div>
              </div>
            </div>

            {/* Sidebar: Zone breakdown */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">By Zone</p>
              {(['forest', 'agricultural', 'residential', 'disputed'] as const).map((zone) => {
                const colors = ZONE_COLORS[zone]
                const Icon = ZONE_ICONS[zone]
                const pct = stats.total > 0 ? Math.round((stats.zoningCounts[zone] / stats.total) * 100) : 0
                return (
                  <div key={zone} className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: colors.ring }} />
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                        <span className="capitalize">{zone}</span>
                        <span>{stats.zoningCounts[zone]}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: colors.ring }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Sidebar: Audit Log */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Audit Log</p>
              <div className="h-52 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50 font-mono text-[10px] text-slate-600 flex flex-col gap-1">
                {syncLogs.length === 0 && <span className="text-slate-300">No log entries yet.</span>}
                {syncLogs.map((log, idx) => (
                  <div key={idx} className="border-b border-slate-100/70 pb-1 flex items-start gap-1">
                    <span className="text-emerald-600 font-black shrink-0">►</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </aside>

        {/* ── MAIN PANEL ── */}
        <main className="flex-1 flex flex-col gap-5 p-4 md:p-6 overflow-y-auto">

          {/* Stats grid — mobile only (sidebar handles tablet) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:hidden">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Parcels</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{stats.total}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <p className="text-[10px] font-bold text-red-500 uppercase">Active Disputes</p>
              <p className="text-3xl font-black text-red-600 mt-1">{stats.activeDisputes}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <p className="text-[10px] font-bold text-emerald-500 uppercase">Registered Clean</p>
              <p className="text-3xl font-black text-emerald-700 mt-1">{stats.resolvedCases}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <p className="text-[10px] font-bold text-amber-500 uppercase">Pending Review</p>
              <p className="text-3xl font-black text-amber-700 mt-1">{stats.pendingCount}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Donut Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col items-center gap-3">
              <h3 className="text-sm font-bold text-slate-700 self-start">Zoning Classification Share</h3>
              <div className="flex items-center justify-center gap-6 w-full py-2">
                <svg className="w-32 h-32 transform -rotate-90 shrink-0">
                  {(() => {
                    const data = [
                      { zone: 'forest', value: stats.zoningCounts.forest, color: '#059669' },
                      { zone: 'agricultural', value: stats.zoningCounts.agricultural, color: '#d97706' },
                      { zone: 'residential', value: stats.zoningCounts.residential, color: '#2563eb' },
                      { zone: 'disputed', value: stats.zoningCounts.disputed, color: '#dc2626' }
                    ].filter(d => d.value > 0)
                    const total = data.reduce((sum, d) => sum + d.value, 0)
                    let cumulativePercent = 0
                    return data.map((d, i) => {
                      const percent = d.value / total
                      const strokeDasharray = `${percent * 2 * Math.PI * 40} ${2 * Math.PI * 40}`
                      const strokeDashoffset = `-${cumulativePercent * 2 * Math.PI * 40}`
                      cumulativePercent += percent
                      return (
                        <circle key={i} cx="56" cy="56" r="40" className="fill-none stroke-current"
                          style={{ color: d.color }} strokeWidth="16"
                          strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
                      )
                    })
                  })()}
                  <circle cx="56" cy="56" r="28" fill="#ffffff" />
                </svg>
                <div className="flex flex-col gap-1.5 text-xs text-slate-700 w-full">
                  <div className="flex items-center justify-between font-semibold"><span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-600 block shrink-0" />Forest</span><span>{stats.zoningCounts.forest} plots</span></div>
                  <div className="flex items-center justify-between font-semibold"><span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 block shrink-0" />Farmland</span><span>{stats.zoningCounts.agricultural} plots</span></div>
                  <div className="flex items-center justify-between font-semibold"><span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 block shrink-0" />Homes</span><span>{stats.zoningCounts.residential} plots</span></div>
                  <div className="flex items-center justify-between font-semibold"><span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-600 block shrink-0" />Disputed</span><span>{stats.zoningCounts.disputed} plots</span></div>
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
              <h3 className="text-sm font-bold text-slate-700">Dispute Status Distribution</h3>
              <div className="flex-1 flex items-end justify-between gap-6 h-36 px-4 border-b border-slate-100 pb-2">
                {(() => {
                  const data = [
                    { label: 'Submitted', count: stats.pendingCount + stats.activeDisputes / 2, color: 'bg-blue-500' },
                    { label: 'In Review', count: stats.activeDisputes / 2, color: 'bg-amber-500' },
                    { label: 'Resolved', count: stats.resolvedCases, color: 'bg-emerald-500' }
                  ]
                  const max = Math.max(...data.map(d => d.count)) || 1
                  return data.map((d, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-xs font-black text-slate-700">{Math.round(d.count)}</span>
                      <div className={`w-full rounded-t-lg ${d.color} transition-all duration-500`} style={{ height: `${(d.count / max) * 100}%` }} />
                      <span className="text-[10px] text-slate-500 truncate font-semibold">{d.label}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          </div>

          {/* Parcel Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-800">Parcels Database Manager
                <span className="ml-2 text-xs font-semibold text-slate-400">({filteredParcels.length} records)</span>
              </h3>
              {/* Mobile-only filters (sidebar covers tablet+) */}
              <div className="flex gap-2 w-full sm:w-auto shrink-0 md:hidden">
                <div className="relative flex-1 sm:w-48 bg-white border-2 border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus-within:border-emerald-500">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID/village..." className="w-full focus:outline-none bg-transparent" />
                </div>
                <select value={villageFilter} onChange={(e) => setVillageFilter(e.target.value)}
                  className="bg-white border-2 border-slate-300 rounded-xl px-2 py-1.5 text-xs font-bold">
                  <option value="all">All Villages</option>
                  {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="p-3 font-extrabold">Parcel ID</th>
                    <th className="p-3 font-extrabold">Village</th>
                    <th className="p-3 font-extrabold">Zoning</th>
                    <th className="p-3 font-extrabold">Status</th>
                    <th className="p-3 font-extrabold hidden md:table-cell">Location</th>
                    <th className="p-3 font-extrabold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading && (
                    <tr><td colSpan={6} className="text-center text-slate-400 py-10 font-bold">Loading parcel registry...</td></tr>
                  )}
                  {!isLoading && filteredParcels.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-slate-400 py-10 font-bold">No parcels match search criteria.</td></tr>
                  )}
                  {filteredParcels.map((parcel) => {
                    const style = ZONE_COLORS[parcel.zone_type]
                    const status = STATUS_COLORS[parcel.status]
                    const ZoneIcon = ZONE_ICONS[parcel.zone_type]
                    return (
                      <tr key={parcel.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-slate-800">{parcel.id}</td>
                        <td className="p-3 font-semibold text-slate-700">{parcel.demo_village_name}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${style.bg} ${style.text} font-bold border border-slate-200/50`}>
                            <ZoneIcon className="w-3.5 h-3.5" />
                            {t(`zone.${parcel.zone_type}`)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${status.bg} ${status.text} font-bold border ${status.border}`}>
                            {t(`status.${parcel.status}`)}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-400 hidden md:table-cell">
                          {parcel.geo_coords.lat.toFixed(4)}, {parcel.geo_coords.lng.toFixed(4)}
                        </td>
                        <td className="p-3 text-right">
                          <button type="button" onClick={() => handleOpenEdit(parcel)}
                            className="bg-slate-100 text-slate-700 font-bold border border-slate-300 rounded-lg px-2.5 py-1 text-xs hover:bg-slate-200 active:scale-95 transition-all cursor-pointer">
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sync Log — mobile only */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-3 md:hidden">
            <h3 className="text-sm font-black text-slate-800">Registry Log Ledger (Audit Trail)</h3>
            <div className="h-44 overflow-y-auto border border-slate-150 rounded-xl p-3 bg-slate-50 font-mono text-[11px] text-slate-650 flex flex-col gap-1.5">
              {syncLogs.map((log, idx) => (
                <div key={idx} className="border-b border-slate-100/50 pb-1 flex items-start gap-1">
                  <span className="text-emerald-700 font-extrabold shrink-0">►</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>

      {/* Add Parcel Drawer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 px-4 pb-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-md md:max-w-2xl rounded-3xl bg-white p-5 md:p-7 flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">Register New Cadastral Parcel</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-600">Parcel ID (Demo Format)</label>
                <input
                  type="text"
                  required
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full rounded-xl border border-slate-350 p-2.5 font-mono text-sm focus:outline-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-600">Select Village Jurisdiction</label>
                <select
                  value={formVillageId}
                  onChange={(e) => setFormVillageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-350 p-2.5 bg-white text-sm"
                >
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Zoning Classification</label>
                  <select
                    value={formZoneType}
                    onChange={(e) => setFormZoneType(e.target.value as ZoneType)}
                    className="w-full rounded-xl border border-slate-350 p-2.5 bg-white text-sm"
                  >
                    <option value="forest">Forest</option>
                    <option value="agricultural">Agricultural</option>
                    <option value="residential">Residential</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Conflict Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ParcelStatus)}
                    className="w-full rounded-xl border border-slate-350 p-2.5 bg-white text-sm"
                  >
                    <option value="registered">Registered (Clean)</option>
                    <option value="pending">Pending Audit</option>
                    <option value="disputed">Active Dispute</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Latitude (Center)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    className="w-full rounded-xl border border-slate-350 p-2.5 text-sm focus:outline-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Longitude (Center)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    className="w-full rounded-xl border border-slate-350 p-2.5 text-sm focus:outline-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
              >
                Create Parcel Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Parcel Drawer Modal */}
      {showEditModal && selectedParcel && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 px-4 pb-4">
          <form
            onSubmit={handleEditSubmit}
            className="w-full max-w-md md:max-w-2xl rounded-3xl bg-white p-5 md:p-7 flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Edit Cadastral Record</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedParcel.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-600">Select Village Jurisdiction</label>
                <select
                  value={formVillageId}
                  onChange={(e) => setFormVillageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-350 p-2.5 bg-white text-sm"
                >
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Zoning Classification</label>
                  <select
                    value={formZoneType}
                    onChange={(e) => setFormZoneType(e.target.value as ZoneType)}
                    className="w-full rounded-xl border border-slate-350 p-2.5 bg-white text-sm"
                  >
                    <option value="forest">Forest</option>
                    <option value="agricultural">Agricultural</option>
                    <option value="residential">Residential</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Conflict Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ParcelStatus)}
                    className="w-full rounded-xl border border-slate-350 p-2.5 bg-white text-sm"
                  >
                    <option value="registered">Registered (Clean)</option>
                    <option value="pending">Pending Audit</option>
                    <option value="disputed">Active Dispute</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Latitude (Center)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    className="w-full rounded-xl border border-slate-350 p-2.5 text-sm focus:outline-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Longitude (Center)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    className="w-full rounded-xl border border-slate-350 p-2.5 text-sm focus:outline-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 border-t border-slate-100 pt-4 mt-2">
              <button
                type="button"
                onClick={() => handleDelete(selectedParcel.id)}
                className="py-3 px-3 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-xl text-xs"
              >
                Delete Plot
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
              >
                Apply Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
