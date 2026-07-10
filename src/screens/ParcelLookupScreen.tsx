import { useEffect, useState } from 'react'
import { AlertIcon, CheckCircleIcon, ClockIcon, QrIcon, SearchIcon } from '../components/icons'
import { PlayExplanationButton } from '../components/PlayExplanationButton'
import { fetchDemoScanParcel, fetchParcelsByVillage, fetchVillages, type Parcel, type Village } from '../lib/land'
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
      <PlayExplanationButton />
    </div>
  )
}

export function ParcelLookupScreen() {
  const { t } = useTranslations()
  const [villages, setVillages] = useState<Village[]>([])
  const [selectedVillageId, setSelectedVillageId] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchVillages().then(setVillages)
  }, [])

  async function handleVillageChange(villageId: string) {
    setSelectedVillageId(villageId)
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

  async function handleScan() {
    setSelectedVillageId('')
    setIsLoading(true)
    const parcel = await fetchDemoScanParcel()
    setResult(parcel ? { kind: 'scan', parcel } : null)
    setIsLoading(false)
  }

  return (
    <div className="flex-1 flex flex-col gap-5 px-4 py-5 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3">
        <SearchIcon className="w-8 h-8 text-emerald-700 shrink-0" />
        <h2 className="text-xl font-bold">{t('lookup.title')}</h2>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="village-select" className="font-semibold text-sm">
          {t('lookup.village_label')}
        </label>
        <select
          id="village-select"
          value={selectedVillageId}
          onChange={(e) => handleVillageChange(e.target.value)}
          className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-base bg-white"
        >
          <option value="">{t('lookup.village_placeholder')}</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 text-gray-400 text-sm">
        <div className="flex-1 h-px bg-gray-200" />
        or
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleScan}
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-emerald-700 text-white py-4 text-lg font-bold active:bg-emerald-800"
        >
          <QrIcon className="w-7 h-7" />
          {t('scan.button')}
        </button>
        <p className="text-xs text-gray-400 text-center">{t('lookup.scan_hint')}</p>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading && <p className="text-center text-gray-400">…</p>}

        {!isLoading && result?.kind === 'village' && result.parcels.length === 0 && (
          <p className="text-center text-gray-500">{t('lookup.no_results')}</p>
        )}

        {!isLoading && result?.kind === 'village' && result.parcels.map((p) => <ParcelCard key={p.id} parcel={p} />)}

        {!isLoading && result?.kind === 'scan' && <ParcelCard parcel={result.parcel} />}
      </div>
    </div>
  )
}
