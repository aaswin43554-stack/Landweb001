import { useEffect, useMemo, useState } from 'react'
import { AlertIcon, CropIcon, HomeIcon, MapIcon, TreeIcon, XIcon } from '../components/icons'
import { PlayExplanationButton } from '../components/PlayExplanationButton'
import { fetchAllParcels, type Parcel, type ZoneType } from '../lib/land'
import { useTranslations } from '../lib/translations'

const ZONE_STYLES: Record<ZoneType, { Icon: typeof TreeIcon; fill: string; ring: string; text: string }> = {
  forest: { Icon: TreeIcon, fill: '#d1fae5', ring: '#059669', text: '#065f46' },
  agricultural: { Icon: CropIcon, fill: '#fef3c7', ring: '#d97706', text: '#92400e' },
  residential: { Icon: HomeIcon, fill: '#dbeafe', ring: '#2563eb', text: '#1e40af' },
  disputed: { Icon: AlertIcon, fill: '#fee2e2', ring: '#dc2626', text: '#991b1b' },
}

const ZONE_ORDER: ZoneType[] = ['forest', 'agricultural', 'residential', 'disputed']

const VIEW_W = 320
const VIEW_H = 400
const PAD = 56

type PlacedParcel = { parcel: Parcel; x: number; y: number; polygonPoints?: string }
type VillageCluster = { villageId: string; villageName: string; x: number; y: number; parcels: PlacedParcel[] }

function clusterByVillage(parcels: Parcel[]): VillageCluster[] {
  if (parcels.length === 0) return []

  const lats = parcels.map((p) => p.geo_coords.lat)
  const lngs = parcels.map((p) => p.geo_coords.lng)
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
  for (const parcel of parcels) {
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
  const [selected, setSelected] = useState<Parcel | null>(null)

  // Zoom and Pan States
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    fetchAllParcels().then(setParcels)
  }, [])

  const clusters = useMemo(() => clusterByVillage(parcels), [parcels])

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

  function handleZoomIn() {
    setScale((prev) => Math.min(prev + 0.25, 3))
  }

  function handleZoomOut() {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  function handleReset() {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div className="flex-1 flex flex-col gap-4 px-4 py-5 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3">
        <MapIcon className="w-8 h-8 text-emerald-700 shrink-0" />
        <div>
          <h2 className="text-xl font-bold">{t('nav.land_use_explainer')}</h2>
          <p className="text-sm text-gray-500">{t('explainer.hint')}</p>
        </div>
      </div>

      {/* SVG Canvas Map Container */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden relative">
        {/* Zoom & Pan Controls Overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-10 h-10 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center font-bold text-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all shadow-sm cursor-pointer select-none"
            aria-label="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-10 h-10 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center font-bold text-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all shadow-sm cursor-pointer select-none"
            aria-label="Zoom Out"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center font-bold text-xs text-gray-600 hover:bg-gray-100 active:scale-95 transition-all shadow-sm cursor-pointer select-none"
            aria-label="Reset Map"
          >
            Reset
          </button>
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
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#f0fdf4" />
          
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {clusters.map((cluster) => (
              <g key={cluster.villageId}>
                <text
                  x={cluster.x}
                  y={cluster.y - 46}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#374151"
                >
                  {cluster.villageName}
                </text>
                {cluster.parcels.map(({ parcel, x, y, polygonPoints }) => {
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
                      </foreignObject>
                    </g>
                  )
                })}
              </g>
            ))}
          </g>
        </svg>
        <p className="text-center text-xs text-gray-400 py-2 px-3 border-t border-gray-100">
          {t('explainer.map_caption')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-gray-700">{t('explainer.legend_title')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {ZONE_ORDER.map((zone) => {
            const style = ZONE_STYLES[zone]
            return (
              <div key={zone} className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-3 py-2">
                <span
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: style.fill, border: `2px solid ${style.ring}` }}
                >
                  <style.Icon className="w-4.5 h-4.5" style={{ color: style.text }} />
                </span>
                <span className="text-sm font-semibold text-gray-700">{t(`zone.${zone}`)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: ZONE_STYLES[selected.zone_type].fill,
                    border: `2px solid ${ZONE_STYLES[selected.zone_type].ring}`,
                  }}
                >
                  {(() => {
                    const Icon = ZONE_STYLES[selected.zone_type].Icon
                    return <Icon className="w-6 h-6" style={{ color: ZONE_STYLES[selected.zone_type].text }} />
                  })()}
                </span>
                <p className="text-lg font-bold">{t(`zone.${selected.zone_type}`)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={t('explainer.panel.close')}
                className="shrink-0 p-2 -mr-1 -mt-1 rounded-full active:bg-gray-100"
              >
                <XIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <p className="text-base text-gray-800">{t(`zone_explain.${selected.zone_type}`)}</p>
            <PlayExplanationButton text={t(`zone_explain.${selected.zone_type}`)} />

            <div className="text-sm text-gray-500 border-t border-gray-100 pt-3">
              <p>
                {t('explainer.panel.village_label')}: <span className="font-semibold text-gray-700">{selected.demo_village_name}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{selected.id}</p>
            </div>

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-1 w-full rounded-xl bg-emerald-700 text-white py-3 text-base font-bold active:bg-emerald-800"
            >
              {t('explainer.panel.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
