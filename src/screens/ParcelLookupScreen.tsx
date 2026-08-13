import { useEffect, useState } from 'react'
import { AlertIcon, CheckCircleIcon, ClockIcon, QrIcon, SearchIcon } from '../components/icons'
import { PlayExplanationButton } from '../components/PlayExplanationButton'
import { QrScanner } from '../components/QrScanner'
import { QrCode } from '../components/QrCode'
import { fetchParcelById, fetchParcelsByVillage, fetchVillages, type Parcel, type Village } from '../lib/land'
import { useTranslations } from '../lib/translations'

type LookupResult = { kind: 'village'; villageName: string; parcels: Parcel[] } | { kind: 'scan'; parcel: Parcel }

const STATUS_STYLES = {
  registered: { Icon: CheckCircleIcon, bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-800' },
  pending: { Icon: ClockIcon, bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-800' },
  disputed: { Icon: AlertIcon, bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-800' },
} as const

function ParcelCard({ parcel }: { parcel: Parcel }) {
  const { t } = useTranslations()
  const { Icon, bg, border, text } = STATUS_STYLES[parcel.status]
  const [showCode, setShowCode] = useState(false)

  return (
    <div className={`rounded-2xl border-2 ${border} ${bg} p-4 flex flex-col gap-3`}>
      <div className="flex items-center gap-4">
        <Icon className={`w-12 h-12 shrink-0 ${text}`} />
        <div className="min-w-0">
          <p className={`text-lg font-bold ${text}`}>{t(`status.${parcel.status}`)}</p>
          <p className="text-sm text-gray-600">{t(`zone.${parcel.zone_type}`)}</p>
          <p className="text-xs text-gray-400 mt-1">{parcel.id}</p>
        </div>
      </div>
      <PlayExplanationButton text={`${t(`status.${parcel.status}`)}. ${t(`zone.${parcel.zone_type}`)}. ID: ${parcel.id}`} />

      <button
        type="button"
        onClick={() => setShowCode((s) => !s)}
        className="text-xs font-semibold text-gray-600 underline self-start"
      >
        {showCode ? t('lookup.hide_code') : t('lookup.show_code')}
      </button>

      {showCode && (
        <div className="flex flex-col items-center gap-2 bg-white rounded-xl border border-gray-200 p-3">
          <QrCode value={parcel.id} size={132} className="w-33 h-33" />
          <p className="text-[11px] text-gray-500 text-center">{t('lookup.show_code_hint')}</p>
        </div>
      )}
    </div>
  )
}

/**
 * A scanned code may hold a bare parcel ID, a URL containing one, or a JSON
 * blob. Pull the DEMO-PARCEL-#### out of whatever form it arrives in.
 */
function extractParcelId(raw: string): string {
  const match = raw.match(/DEMO-PARCEL-\d+/i)
  return match ? match[0].toUpperCase() : raw.trim()
}

export function ParcelLookupScreen() {
  const { t } = useTranslations()
  const [villages, setVillages] = useState<Village[]>([])
  const [selectedVillageId, setSelectedVillageId] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  useEffect(() => {
    fetchVillages().then(setVillages)
  }, [])

  async function handleVillageChange(villageId: string) {
    setSelectedVillageId(villageId)
    setScanError(null)
    if (!villageId) {
      setResult(null)
      return
    }
    setIsLoading(true)
    const village = villages.find((v) => v.id === villageId)
    const parcels = await fetchParcelsByVillage(villageId)
    setResult({ kind: 'village', villageName: village?.name ?? '', parcels })
    setIsLoading(false)
  }

  async function handleScanResult(value: string) {
    setShowScanner(false)
    setSelectedVillageId('')
    setScanError(null)
    setIsLoading(true)

    const parcel = await fetchParcelById(extractParcelId(value))
    if (parcel) {
      setResult({ kind: 'scan', parcel })
    } else {
      setResult(null)
      setScanError(t('lookup.scan_not_found'))
    }
    setIsLoading(false)
  }

  return (
    <div className="flex-1 flex flex-col gap-5 px-3.5 sm:px-6 py-4 sm:py-6 max-w-lg sm:max-w-xl md:max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <SearchIcon className="w-8 h-8 text-emerald-700 shrink-0" />
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-800">{t('lookup.title')}</h2>
      </div>

      {/* Tactile Visual Village Cards Grid */}
      <div className="flex flex-col gap-2">
        <label className="font-extrabold text-sm text-slate-700 flex items-center justify-between">
          <span>{t('lookup.village_label')}</span>
          <span className="text-[11px] sm:text-xs font-semibold text-emerald-700">Tap a village below:</span>
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
          {villages.map((v) => {
            const isSelected = v.id === selectedVillageId
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleVillageChange(v.id)}
                className={`tactile-card p-3 flex items-center gap-2 text-left border-2 rounded-2xl transition-all cursor-pointer ${
                  isSelected
                    ? 'tactile-card-active border-emerald-700 bg-emerald-50 text-emerald-900 shadow-md scale-102'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                }`}
              >
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm shrink-0 font-bold ${isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  📍
                </span>
                <span className="text-xs sm:text-sm font-extrabold truncate">{v.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 text-slate-400 text-xs font-bold my-1">
        <div className="flex-1 h-0.5 bg-slate-200" />
        OR SCAN WITH CAMERA
        <div className="flex-1 h-0.5 bg-slate-200" />
      </div>

      {/* Chunky QR Scanner Trigger Button */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="tactile-btn w-full flex items-center justify-center gap-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white py-4 text-base font-black active:scale-98 shadow-md transition-all cursor-pointer"
        >
          <QrIcon className="w-6 h-6" />
          {t('scan.button')}
        </button>
        <p className="text-[11px] text-slate-500 font-semibold text-center mt-1">{t('lookup.scan_hint')}</p>
      </div>

      {showScanner && (
        <QrScanner
          title={t('scan.button')}
          hint={t('lookup.scan_hint')}
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Results Container */}
      <div className="flex flex-col gap-3">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-emerald-800">Loading land records...</p>
          </div>
        )}

        {!isLoading && scanError && (
          <p className="text-center text-red-700 bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3 text-sm font-extrabold shadow-sm">
            {scanError}
          </p>
        )}

        {!isLoading && result?.kind === 'village' && result.parcels.length === 0 && (
          <p className="text-center text-slate-500 font-semibold py-4">{t('lookup.no_results')}</p>
        )}

        {!isLoading && result?.kind === 'village' && result.parcels.map((p) => <ParcelCard key={p.id} parcel={p} />)}

        {!isLoading && result?.kind === 'scan' && <ParcelCard parcel={result.parcel} />}
      </div>
    </div>
  )
}
