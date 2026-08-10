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

const VIEW_W = 320
const VIEW_H = 340
const PAD = 56

type PlacedParcel = { parcel: Parcel; x: number; y: number; polygonPoints?: string }
type VillageCluster = { villageId: string; villageName: string; x: number; y: number; parcels: PlacedParcel[] }

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

  function project(lat: number, lng: number) {
    const x = PAD + ((lng - minLng) / lngSpan) * (VIEW_W - 2 * PAD)
    const y = PAD + ((maxLat - lat) / latSpan) * (VIEW_H - 2 * PAD)
    return { x, y }
  }

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
    const center = project(avgLat, avgLng)

    const placed = villageParcels.map((parcel) => {
      const center = project(parcel.geo_coords.lat, parcel.geo_coords.lng)
      
      // Support both polygon_coords (our GPS walk) and geo_polygon (their biometric schema)
      const coords = parcel.polygon_coords || parcel.geo_polygon || []
      const points = coords.map((coord) => {
        const pt = project(coord.lat, coord.lng)
        return `${pt.x},${pt.y}`
      }).join(' ')

      return {
        parcel,
        x: center.x,
        y: center.y,
        polygonPoints: points || undefined,
      }
    })

    clusters.push({ villageId, villageName: villageParcels[0].demo_village_name, x: center.x, y: center.y, parcels: placed })
  }

  return clusters
}

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

export function LandUseExplainerScreen() {
  const { t } = useTranslations()
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [selected, setSelected] = useState<Parcel | null>(null)
  
  // Layer and Slider States
  const [showActiveDisputes, setShowActiveDisputes] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  // Navigation Pan & Zoom states
  const [scale, setScale] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    Promise.all([fetchAllParcels(), fetchDisputes()]).then(([p, d]) => {
      setParcels(p)
      setDisputes(d)
    })
  }, [])

  const clusters = useMemo(() => {
    return clusterByVillage(parcels, selectedYear)
  }, [parcels, selectedYear])


  // Mouse pan handlers
  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  function handleMouseUpOrLeave() {
    setIsDragging(false)
  }

  // Touch pan handlers
  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]
    if (!touch) return
    setIsDragging(true)
    setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging) return
    const touch = e.touches[0]
    if (!touch) return
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
        icon: TreeIcon,
        color: 'text-emerald-700'
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
    // 2026 (Current)
    const isDisputed = disputes.some(d => d.parcel_id === selected.id && d.status !== 'resolved')
    return {
      owner: isDisputed ? 'In Arbitration (Somphone S. / Phouvieng S.)' : 'Somphone Sounalath',
      zoning: selected.zone_type.toUpperCase(),
      detail: isDisputed 
        ? 'Active boundary conflict registered. Public transparency drawer active below.' 
        : 'Registered customary land holdings with digital coordinates.',
      icon: isDisputed ? AlertIcon : HomeIcon,
      color: isDisputed ? 'text-red-700' : 'text-slate-800'
    }
  }, [selected, selectedYear, disputes])

  return (
    <div className="flex-1 flex flex-col bg-slate-50 gap-4 px-4 py-5 max-w-md mx-auto w-full pb-16">
      
      {/* Explanation Banner with direct audio toggle */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-5 shadow-lg flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <MapIcon className="w-32 h-32" />
        </div>
        <div className="flex items-start justify-between relative z-10">
          <div>
            <h2 className="text-xl font-black tracking-tight">{t('explainer.title')}</h2>
            <p className="text-xs text-emerald-100 font-semibold mt-1">Village zoning definitions & history log</p>
          </div>
          <PlayExplanationButton text={t('explainer.title')} />
        </div>
        <p className="text-xs leading-relaxed text-emerald-50/90 relative z-10">
          Scroll, pinch to zoom, and pan around the village cluster maps. Turn on <b>Active Disputes</b> to highlight land claims.
        </p>
      </div>

      {/* Layer selector bar */}
      <div className="bg-white border-2 border-gray-200 rounded-3xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-800">Show Active Disputes</span>
          <span className="text-[10px] text-slate-400 font-semibold">Pulse conflicting land claims in red</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showActiveDisputes}
            onChange={() => setShowActiveDisputes(!showActiveDisputes)}
            className="sr-only peer cursor-pointer"
            aria-label="Toggle active disputes view"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* Map visualization Canvas */}
      <div className="w-full h-80 bg-white border-2 border-gray-200 rounded-3xl relative shadow-xs overflow-hidden select-none">
        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={() => setScale(s => Math.min(s + 0.15, 2.5))}
            className="w-8 h-8 rounded-xl bg-slate-800 text-white font-black text-sm flex items-center justify-center hover:bg-slate-900 shadow active:scale-90 transition-all cursor-pointer"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setScale(s => Math.max(s - 0.15, 0.6))}
            className="w-8 h-8 rounded-xl bg-slate-800 text-white font-black text-sm flex items-center justify-center hover:bg-slate-900 shadow active:scale-90 transition-all cursor-pointer"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => { setScale(1.0); setPan({ x: 0, y: 0 }) }}
            className="w-8 h-8 rounded-xl bg-white border border-slate-250 text-slate-700 font-bold text-[9px] flex items-center justify-center hover:bg-slate-100 shadow active:scale-90 transition-all cursor-pointer"
          >
            RESET
          </button>
        </div>

        <svg
          className="w-full h-full cursor-grab active:cursor-grabbing"
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
                
                {cluster.parcels.map(({ parcel, x, y, polygonPoints }) => {
                  const hasDispute = disputes.some(d => d.parcel_id === parcel.id && d.status !== 'resolved')
                  const pulseRedClass = showActiveDisputes && hasDispute ? 'pulse-disputed-active' : ''
                  
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
                      {polygonPoints ? (
                        <polygon
                          points={polygonPoints}
                          fill={pulseRedClass ? undefined : style.fill}
                          stroke={pulseRedClass ? undefined : isSelected ? '#1e293b' : style.ring}
                          strokeWidth={isSelected ? 3.5 : 2}
                          strokeDasharray={parcel.status === 'disputed' ? 'none' : parcel.status === 'pending' ? '4 2' : 'none'}
                          opacity={isSelected ? 1.0 : 0.85}
                          className={`transition-all hover:opacity-100 ${pulseRedClass}`}
                        />
                      ) : (
                        <circle
                          cx={x}
                          cy={y}
                          r={isSelected ? 18 : 15}
                          fill={pulseRedClass ? undefined : style.fill}
                          stroke={pulseRedClass ? undefined : style.ring}
                          strokeWidth={isSelected ? 3 : 2}
                          className={pulseRedClass}
                        />
                      )}
                      
                      <foreignObject x={x - 9} y={y - 9} width="18" height="18" className="pointer-events-none">
                        <style.Icon className="w-4.5 h-4.5" style={{ color: pulseRedClass ? '#991b1b' : style.text }} />
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
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
            {selectedYear}
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
              if (val < 2018) setSelectedYear(2015)
              else if (val >= 2018 && val <= 2023) setSelectedYear(2020)
              else setSelectedYear(2026)
            }}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700 focus:outline-none"
          />
          <div className="flex justify-between text-[11px] font-extrabold text-slate-400 mt-2 select-none px-1">
            <span className={`cursor-pointer transition-all ${selectedYear === 2015 ? 'text-emerald-700 scale-105 font-black' : ''}`} onClick={() => setSelectedYear(2015)}>2015</span>
            <span className={`cursor-pointer transition-all ${selectedYear === 2020 ? 'text-emerald-700 scale-105 font-black' : ''}`} onClick={() => setSelectedYear(2020)}>2020</span>
            <span className={`cursor-pointer transition-all ${selectedYear === 2026 ? 'text-emerald-700 scale-105 font-black' : ''}`} onClick={() => setSelectedYear(2026)}>2026 (Current)</span>
          </div>
        </div>
      </div>

      {/* Selected Parcel Drawer details */}
      {selected && (
        <div className="rounded-3xl border-2 border-slate-350 bg-white p-4 shadow-sm flex flex-col gap-3 relative animate-in slide-in-from-bottom-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100"
          >
            <XIcon className="w-5 h-5 text-slate-500" />
          </button>
          
          <div>
            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wide">{selected.id}</span>
            <h3 className="text-sm font-black text-slate-800">
              {selected.demo_village_name} Plot Registry
            </h3>
          </div>

          <div className="flex gap-2.5 mt-1 border-t border-slate-100 pt-3">
            <div className="flex-1 bg-slate-50/50 border border-slate-200 rounded-2xl p-2.5 flex flex-col gap-1 text-[11px]">
              <p className="font-extrabold text-slate-400 uppercase text-[9px] tracking-wide">Historical Snapshot ({selectedYear})</p>
              <p className="font-bold text-slate-700 mt-1">👤 Owner: <span className="text-slate-800 font-semibold">{selectedParcelLedger?.owner}</span></p>
              <p className="font-bold text-slate-700">🏷️ Zoning: <span className={`${selectedParcelLedger?.color} font-black`}>{selectedParcelLedger?.zoning}</span></p>
              <p className="text-slate-550 italic leading-snug mt-1.5">{selectedParcelLedger?.detail}</p>
            </div>
          </div>

          {/* Active Dispute Public Transparency Notice Drawer */}
          {activeDisputeForSelected && (
            <div className="border-2 border-red-300 rounded-2xl bg-red-50/40 p-3 mt-1 flex flex-col gap-2 animate-pulse">
              <div className="flex items-center gap-1.5 text-xs text-red-800 font-black">
                <AlertIcon className="w-4.5 h-4.5 text-red-600 shrink-0" />
                <span>⚠️ Public Dispute Transparency Disclosure Notice</span>
              </div>
              <div className="text-[10px] text-red-950 font-semibold leading-relaxed flex flex-col gap-1">
                <p><span className="font-bold">Case Reference:</span> {activeDisputeForSelected.fake_reference_number}</p>
                <p><span className="font-bold">Conflict Stage:</span> {activeDisputeForSelected.status.toUpperCase()}</p>
                <p><span className="font-bold">Citizen Claim Note:</span> "{splitDescription(activeDisputeForSelected.description).note}"</p>
                <p className="italic text-slate-500 font-medium">Public access provided in compliance with customary registry transparency laws.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
