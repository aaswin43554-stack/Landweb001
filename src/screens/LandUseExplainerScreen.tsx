import { useEffect, useMemo, useState } from 'react'
import { AlertIcon, CropIcon, HomeIcon, MapIcon, TreeIcon, XIcon } from '../components/icons'
import { PlayExplanationButton } from '../components/PlayExplanationButton'
import { fetchAllParcels, fetchDisputes, type Parcel, type ZoneType, type Dispute } from '../lib/land'
import { useTranslations } from '../lib/translations'

const ZONE_STYLES: Record<ZoneType, { Icon: typeof TreeIcon; fill: string; ring: string; text: string }> = {
  forest: { Icon: TreeIcon, fill: '#d1fae5', ring: '#059669', text: '#065f46' },
  agricultural: { Icon: CropIcon, fill: '#fef3c7', ring: '#d97706', text: '#92400e' },
  residential: { Icon: HomeIcon, fill: '#dbeafe', ring: '#2563eb', text: '#1e40af' },
  disputed: { Icon: AlertIcon, fill: '#fee2e2', ring: '#dc2626', text: '#991b1b' },
}

const ZONE_ORDER: ZoneType[] = ['forest', 'agricultural', 'residential', 'disputed']

const VIEW_W = 320
const VIEW_H = 340
const PAD = 56

type PlacedParcel = { parcel: Parcel; x: number; y: number; polygonPoints?: string }
type VillageCluster = { villageId: string; villageName: string; x: number; y: number; parcels: PlacedParcel[] }

function projectCoords(lat: number, lng: number, _minLat: number, maxLat: number, minLng: number, _maxLng: number, latSpan: number, lngSpan: number) {
  const x = PAD + ((lng - minLng) / lngSpan) * (VIEW_W - 2 * PAD)
  const y = PAD + ((maxLat - lat) / latSpan) * (VIEW_H - 2 * PAD)
  return { x, y }
}

function clusterByVillage(parcels: Parcel[], selectedYear: number): VillageCluster[] {
  if (parcels.length === 0) return []

  // Map parcels based on history
  const mappedParcels = parcels.map(p => {
    if (selectedYear === 2026) return p
    if (selectedYear === 2020) {
      const isAgri = ['DEMO-PARCEL-0001', 'DEMO-PARCEL-0005', 'DEMO-PARCEL-0009', 'DEMO-PARCEL-0012', 'DEMO-PARCEL-0025'].includes(p.id)
      return {
        ...p,
        status: isAgri ? 'registered' : p.status === 'disputed' ? 'pending' : (p.status as any),
        zone_type: isAgri ? 'agricultural' : 'forest',
        geo_coords: { lat: p.geo_coords.lat - 0.0012, lng: p.geo_coords.lng - 0.0008 }
      } as Parcel
    }
    // 2015: Entire Ban Namdeng and Silimone is forest
    const isForest = p.village_id === 'DEMO-VLG-001' || p.village_id === 'DEMO-VLG-002'
    return {
      ...p,
      status: 'registered',
      zone_type: isForest ? 'forest' : 'agricultural',
      geo_coords: { lat: p.geo_coords.lat - 0.0028, lng: p.geo_coords.lng - 0.0022 }
    } as Parcel
  })

  const lats = mappedParcels.map((p) => p.geo_coords.lat)
  const lngs = mappedParcels.map((p) => p.geo_coords.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latSpan = maxLat - minLat || 1
  const lngSpan = maxLng - minLng || 1

  const byVillage = new Map<string, Parcel[]>()
  for (const parcel of mappedParcels) {
    const list = byVillage.get(parcel.village_id) ?? []
    list.push(parcel)
    byVillage.set(parcel.village_id, list)
  }

  const clusters: VillageCluster[] = []
  for (const [villageId, villageParcels] of byVillage) {
    const avgLat = villageParcels.reduce((sum, p) => sum + p.geo_coords.lat, 0) / villageParcels.length
    const avgLng = villageParcels.reduce((sum, p) => sum + p.geo_coords.lng, 0) / villageParcels.length
<<<<<<< HEAD
    const center = projectCoords(avgLat, avgLng, minLat, maxLat, minLng, maxLng, latSpan, lngSpan)
    const radius = villageParcels.length <= 1 ? 0 : villageParcels.length <= 4 ? 26 : 38
=======
    const center = project(avgLat, avgLng)
>>>>>>> f49bd50c6356d5c7f353daf8fbede4347e757aa0

    const placed = villageParcels.map((parcel) => {
      const center = project(parcel.geo_coords.lat, parcel.geo_coords.lng)
      const points = (parcel.geo_polygon || []).map((coord) => {
        const pt = project(coord.lat, coord.lng)
        return `${pt.x},${pt.y}`
      }).join(' ')

      return {
        parcel,
        x: center.x,
        y: center.y,
        polygonPoints: points,
      }
    })

    clusters.push({ villageId, villageName: villageParcels[0].demo_village_name, x: center.x, y: center.y, parcels: placed })
  }

  return clusters
}

export function LandUseExplainerScreen() {
  const { t } = useTranslations()
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [selected, setSelected] = useState<Parcel | null>(null)
  
  // Layer and Slider States
  const [showActiveDisputes, setShowActiveDisputes] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  // Zoom and Pan States
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    Promise.all([fetchAllParcels(), fetchDisputes()]).then(([p, d]) => {
      setParcels(p)
      setDisputes(d)
    })
  }, [])

  const clusters = useMemo(() => clusterByVillage(parcels, selectedYear), [parcels, selectedYear])

  // Mouse pan handlers
  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  function handleMouseUpOrLeave() {
    setIsDragging(false)
  }

  // Touch pan handlers
  function handleTouchStart(e: React.TouchEvent<SVGSVGElement>) {
    if (e.touches.length === 1) {
      setIsDragging(true)
      const touch = e.touches[0]
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
    }
  }

  function handleTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    setPan({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y })
  }

  // Find dispute details associated with parcel
  const activeDisputeForSelected = useMemo(() => {
    if (!selected) return null
    return disputes.find(d => d.parcel_id === selected.id && d.status !== 'resolved') || null
  }, [selected, disputes])

  // Year registry info card description helper
  const selectedParcelLedger = useMemo(() => {
    if (!selected) return null
    if (selectedYear === 2015) {
      const isForest = selected.village_id === 'DEMO-VLG-001' || selected.village_id === 'DEMO-VLG-002'
      return {
        owner: 'Laotian State Registry',
        zoning: isForest ? 'State Protected Forest' : 'Customary Farmland',
        detail: isForest 
          ? 'Protected woodland zone. No private agricultural permits or boundary claims registered.' 
          : 'Customary communal farmland registry.',
        icon: isForest ? TreeIcon : CropIcon,
        color: isForest ? 'text-emerald-700' : 'text-amber-700'
      }
    }
    if (selectedYear === 2020) {
      const isAgri = ['DEMO-PARCEL-0001', 'DEMO-PARCEL-0005', 'DEMO-PARCEL-0009'].includes(selected.id)
      return {
        owner: isAgri ? 'Somphone Sounalath' : 'Traditional Family Occupant',
        zoning: isAgri ? 'Agricultural Permit Land' : 'Traditional Forest Allocation',
        detail: isAgri ? 'Customary farming permit granted for rice cultivation. Boundary coordinates established by community census.' : 'Allocated forest buffer zone.',
        icon: CropIcon,
        color: 'text-amber-700'
      }
    }
    // 2026
    const disp = disputes.find(d => d.parcel_id === selected.id)
    return {
      owner: disp ? 'Disputed Claimant' : 'Registered Landlord',
      zoning: selected.zone_type.toUpperCase() + ' Zone',
      detail: disp ? `Under arbitration review. Case Ref: ${disp.fake_reference_number}. Detail: ${disp.description}` : 'Registered cadastral parcel. Verified clean boundary outlines.',
      icon: disp ? AlertIcon : HomeIcon,
      color: disp ? 'text-red-700' : 'text-blue-700'
    }
  }, [selected, selectedYear, disputes])

  return (
    <div className="flex-1 flex flex-col gap-4 px-4 py-5 max-w-lg mx-auto w-full">
      
      {/* Custom CSS Style tag for pulsing red disputed class */}
      <style>{`
        @keyframes pulseRed {
          0%, 100% { fill: #fee2e2; stroke: #dc2626; stroke-width: 2px; }
          50% { fill: #fecaca; stroke: #b91c1c; stroke-width: 4px; filter: drop-shadow(0 0 5px rgba(220, 38, 38, 0.6)); }
        }
        .pulse-disputed-active {
          animation: pulseRed 1.4s infinite ease-in-out;
        }
      `}</style>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <MapIcon className="w-8 h-8 text-emerald-700 shrink-0" />
          <div>
            <h2 className="text-xl font-bold">{t('nav.land_use_explainer')}</h2>
            <p className="text-xs text-gray-500">Interactive Cadastral Evolution Explorer</p>
          </div>
        </div>

        {/* Show active disputes switch */}
        <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 border-2 border-slate-250 px-3 py-1.5 rounded-full select-none">
          <span className="text-xs font-extrabold text-slate-700">⚠️ Active Disputes</span>
          <input
            type="checkbox"
            checked={showActiveDisputes}
            onChange={() => setShowActiveDisputes(!showActiveDisputes)}
            className="w-4 h-4 text-red-600 border-slate-350 focus:ring-red-500 rounded cursor-pointer"
          />
        </label>
      </div>

      {/* SVG Canvas Map Container */}
      <div className="rounded-3xl border-2 border-gray-200 bg-white overflow-hidden relative shadow-sm">
        {/* Zoom & Pan Controls Overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            type="button"
            onClick={() => setScale((prev) => Math.min(prev + 0.25, 3))}
            className="w-8 h-8 rounded-lg bg-white border-2 border-gray-200 flex items-center justify-center font-black text-sm text-gray-700 hover:bg-gray-100 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
            aria-label="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setScale((prev) => Math.max(prev - 0.25, 0.5))}
            className="w-8 h-8 rounded-lg bg-white border-2 border-gray-200 flex items-center justify-center font-black text-sm text-gray-700 hover:bg-gray-100 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
            aria-label="Zoom Out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }}
            className="px-2 py-1 rounded-lg bg-white border-2 border-gray-200 flex items-center justify-center font-extrabold text-[10px] text-gray-600 hover:bg-gray-100 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
            aria-label="Reset Map"
          >
            Reset
          </button>
        </div>

        {/* Current Year Badge Overlay */}
        <div className="absolute top-3 left-3 bg-slate-900 text-white font-extrabold text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg shadow-sm z-10 animate-pulse">
          Ledger Year: {selectedYear}
        </div>

        {/* Map Viewport */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-auto cursor-grab active:cursor-grabbing select-none"
          role="img"
          aria-label={t('nav.land_use_explainer')}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUpOrLeave}
        >
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#f8fafc" />
          
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {clusters.map((cluster) => (
              <g key={cluster.villageId}>
                <text
                  x={cluster.x}
                  y={cluster.y - 42}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="850"
                  fill="#475569"
                >
                  {cluster.villageName}
                </text>
<<<<<<< HEAD
                {cluster.parcels.map(({ parcel, x, y }) => {
                  const hasDispute = disputes.some(d => d.parcel_id === parcel.id && d.status !== 'resolved')
                  const pulseRedClass = showActiveDisputes && hasDispute ? 'pulse-disputed-active' : ''
                  
=======
                {cluster.parcels.map(({ parcel, x, y, polygonPoints }) => {
>>>>>>> f49bd50c6356d5c7f353daf8fbede4347e757aa0
                  const style = ZONE_STYLES[parcel.zone_type]
                  const isSelected = selected?.id === parcel.id
                  
                  return (
                    <g
                      key={parcel.id}
                      onClick={() => setSelected(parcel)}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={t(`zone.${parcel.zone_type}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelected(parcel)
                      }}
                    >
<<<<<<< HEAD
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 18 : 15}
                        fill={pulseRedClass ? undefined : style.fill}
                        stroke={pulseRedClass ? undefined : style.ring}
                        strokeWidth={isSelected ? 3 : 2}
                        className={pulseRedClass}
                      />
                      <foreignObject x={x - 9} y={y - 9} width="18" height="18" className="pointer-events-none">
                        <style.Icon className="w-4.5 h-4.5" style={{ color: pulseRedClass ? '#991b1b' : style.text }} />
=======
                      {polygonPoints ? (
                        <polygon
                          points={polygonPoints}
                          fill={style.fill}
                          stroke={isSelected ? '#1e293b' : style.ring}
                          strokeWidth={isSelected ? 3.5 : 2}
                          strokeDasharray={parcel.status === 'disputed' ? 'none' : parcel.status === 'pending' ? '4 2' : 'none'}
                          opacity={isSelected ? 1.0 : 0.85}
                          className="transition-all hover:opacity-100"
                        />
                      ) : (
                        <circle
                          cx={x}
                          cy={y}
                          r={isSelected ? 19 : 16}
                          fill={style.fill}
                          stroke={style.ring}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                      )}
                      <foreignObject x={x - 9} y={y - 9} width="18" height="18" className="pointer-events-none">
                        <style.Icon className="w-4.5 h-4.5" style={{ color: style.text }} />
>>>>>>> f49bd50c6356d5c7f353daf8fbede4347e757aa0
                      </foreignObject>
                    </g>
                  )
                })}
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Time-Travel Timeline Slider */}
      <div className="bg-white border-2 border-gray-200 rounded-3xl p-4 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between text-xs font-black text-slate-700">
          <span>📅 Chronological Time Travel Ledger</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            Slide to travel years
          </span>
        </div>
        
        <div className="relative px-2 py-1">
          <input
            type="range"
            min="2015"
            max="2026"
            step="1"
            value={selectedYear}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              // Snap to nearest landmark: 2015, 2020, 2026
              if (val < 2018) setSelectedYear(2015)
              else if (val >= 2018 && val <= 2023) setSelectedYear(2020)
              else setSelectedYear(2026)
            }}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700 focus:outline-none"
          />
          <div className="flex justify-between text-[11px] font-extrabold text-slate-400 mt-2 select-none px-1">
            <span className={`cursor-pointer ${selectedYear === 2015 ? 'text-emerald-700 scale-110' : ''}`} onClick={() => setSelectedYear(2015)}>2015 (Forest Ledger)</span>
            <span className={`cursor-pointer ${selectedYear === 2020 ? 'text-emerald-700 scale-110' : ''}`} onClick={() => setSelectedYear(2020)}>2020 (Agri Permits)</span>
            <span className={`cursor-pointer ${selectedYear === 2026 ? 'text-emerald-700 scale-110' : ''}`} onClick={() => setSelectedYear(2026)}>2026 (Current)</span>
          </div>
        </div>
      </div>

      {/* Year-Specific Ledger Info display */}
      {selected && selectedParcelLedger && (
        <div className="bg-slate-100/70 border border-slate-200 rounded-3xl p-4 flex flex-col gap-2 shadow-inner">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-500 font-mono">{selected.id} Audit trail</h4>
            <span className="text-[10px] font-black text-slate-450 uppercase">{selected.demo_village_name}</span>
          </div>
          <div className="flex items-start gap-3 mt-1 text-xs">
            <span className={`w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-200 ${selectedParcelLedger.color} shrink-0`}>
              <selectedParcelLedger.icon className="w-5 h-5" />
            </span>
            <div className="flex flex-col gap-1 w-full text-slate-700">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="font-extrabold text-slate-800">{selectedParcelLedger.owner}</span>
                <span className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded-md text-slate-500">{selectedParcelLedger.zoning}</span>
              </div>
              <p className="text-slate-650 leading-relaxed mt-0.5 font-medium">{selectedParcelLedger.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Legend Block */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">{t('explainer.legend_title')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {ZONE_ORDER.map((zone) => {
            const style = ZONE_STYLES[zone]
            return (
              <div key={zone} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-xs">
                <span
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: style.fill, border: `2.5px solid ${style.ring}` }}
                >
                  <style.Icon className="w-4 h-4" style={{ color: style.text }} />
                </span>
                <span className="text-xs font-bold text-gray-700">{t(`zone.${zone}`)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Drawer Overlay for Parcel Detail or Transparency Notice */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 flex flex-col gap-4 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Context-aware display: if showing active disputes is ON and parcel is disputed, we show transparency notice */}
            {showActiveDisputes && activeDisputeForSelected ? (
              // transparency Notice Modal
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between border-b border-red-100 pb-2.5">
                  <div className="flex items-center gap-2 text-red-650">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-red-800">Public Transparency Notice</h3>
                      <p className="text-[10px] text-red-600 font-bold">Land Use Dispute Registration Ledger</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-full hover:bg-slate-100"
                  >
                    <XIcon className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="text-xs text-slate-700 flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 font-semibold">
                    <div>
                      <p className="text-[9px] uppercase text-slate-400">Parcel ID</p>
                      <p className="font-mono text-slate-800 truncate">{selected.id}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-slate-400">Filing Date</p>
                      <p className="text-slate-800">
                        {new Date(activeDisputeForSelected.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-slate-400">Reference Number</p>
                      <p className="font-mono text-slate-800 truncate text-red-700">{activeDisputeForSelected.fake_reference_number}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-slate-400">Resolution Status</p>
                      <p className="capitalize text-amber-700 font-extrabold">{activeDisputeForSelected.status.replace('_', ' ')}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h4 className="font-extrabold text-slate-600">Disputed Boundary Claims</h4>
                    <div className="bg-red-50/50 border border-red-200 rounded-2xl p-3 flex flex-col gap-2">
                      <div>
                        <p className="font-bold text-[10px] text-slate-500 uppercase">Claimant Submitter</p>
                        <p className="font-bold text-slate-800 text-sm">{activeDisputeForSelected.submitted_by}</p>
                      </div>
                      <div>
                        <p className="font-bold text-[10px] text-slate-500 uppercase">Claimant Statement of Conflict</p>
                        <p className="text-slate-700 mt-0.5 leading-relaxed font-semibold">{activeDisputeForSelected.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Public audio attachment if available */}
                  {activeDisputeForSelected.audio && (
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="font-bold text-[10px] text-slate-500 uppercase">Public Voice Statement Testimony</p>
                      <audio src={activeDisputeForSelected.audio} controls className="w-full h-8 mt-1" />
                    </div>
                  )}

                  <div className="w-full border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-400 text-center">
                    📢 Published in accordance with the Village Land Information Transparency Code.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-2 w-full rounded-2xl bg-red-700 hover:bg-red-800 text-white py-3 text-sm font-bold shadow-md"
                >
                  Acknowledge Notice
                </button>
              </div>
            ) : (
              // Standard Zoning Explainer Modal
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center shadow-xs"
                      style={{
                        backgroundColor: ZONE_STYLES[selected.zone_type].fill,
                        border: `2px solid ${ZONE_STYLES[selected.zone_type].ring}`,
                      }}
                    >
                      {(() => {
                        const Icon = ZONE_STYLES[selected.zone_type].Icon
                        return <Icon className="w-5 h-5" style={{ color: ZONE_STYLES[selected.zone_type].text }} />
                      })()}
                    </span>
                    <div>
                      <p className="text-base font-extrabold text-slate-800">{t(`zone.${selected.zone_type}`)}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{selected.id}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label={t('explainer.panel.close')}
                    className="shrink-0 p-1 rounded-full hover:bg-gray-100"
                  >
                    <XIcon className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed font-semibold mt-1">
                  {t(`zone_explain.${selected.zone_type}`)}
                </p>
                
                <div className="mt-1">
                  <PlayExplanationButton text={t(`zone_explain.${selected.zone_type}`)} />
                </div>

                <div className="text-xs text-gray-500 border-t border-gray-100 pt-3 flex flex-col gap-1.5 font-semibold">
                  <p className="flex justify-between">
                    <span>{t('explainer.panel.village_label')}:</span>
                    <span className="text-gray-700">{selected.demo_village_name}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Zoning Code:</span>
                    <span className="text-gray-700 uppercase font-mono">{selected.zone_type}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-1 w-full rounded-2xl bg-emerald-700 text-white py-3 text-sm font-bold hover:bg-emerald-800 shadow"
                >
                  {t('explainer.panel.close')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
