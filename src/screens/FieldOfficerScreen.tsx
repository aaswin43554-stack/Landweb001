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
} from '../components/icons'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { fetchDisputes, fetchVillages, type Dispute, type DisputeStatus, type Village, type ZoneType } from '../lib/land'
import { useTranslations } from '../lib/translations'

const ZONE_ICONS: Record<ZoneType, typeof TreeIcon> = {
  forest: TreeIcon,
  agricultural: CropIcon,
  residential: HomeIcon,
  disputed: AlertIcon,
}

// Field-officer screens may use more technical language than the
// citizen-facing ones (module_prompts.txt, M6), so these labels are
// plain English rather than sourced from the `translations` table.
const STATUS_META: Record<DisputeStatus, { label: string; Icon: typeof ClockIcon; text: string; bg: string; border: string }> = {
  submitted: { label: 'Submitted', Icon: ClockIcon, text: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-400' },
  in_review: { label: 'In review', Icon: SearchIcon, text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-400' },
  resolved: { label: 'Resolved', Icon: CheckCircleIcon, text: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-400' },
}

const STATUS_FILTERS: (DisputeStatus | 'all')[] = ['all', 'submitted', 'in_review', 'resolved']

// M5 writes description as "<category label> — <note>" (see
// DISPUTE_CATEGORY_LABELS in lib/land.ts); split it back apart for display.
function splitDescription(description: string | null): { category: string; note: string } {
  if (!description) return { category: 'Uncategorized', note: '' }
  const [category, ...rest] = description.split(' — ')
  return { category, note: rest.join(' — ') }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function FieldOfficerScreen() {
  const { t } = useTranslations()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [villages, setVillages] = useState<Village[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [villageFilter, setVillageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'all'>('all')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    Promise.all([fetchDisputes(), fetchVillages()]).then(([d, v]) => {
      setDisputes(d)
      setVillages(v)
      setIsLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    let rows = disputes
    if (villageFilter !== 'all') rows = rows.filter((d) => d.parcel?.village_id === villageFilter)
    if (statusFilter !== 'all') rows = rows.filter((d) => d.status === statusFilter)
    return [...rows].sort((a, b) =>
      sortAsc ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at),
    )
  }, [disputes, villageFilter, statusFilter, sortAsc])

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <div className="bg-slate-800 text-white px-4 py-5">
        <div className="flex items-center gap-3 max-w-2xl mx-auto w-full">
          <BriefcaseIcon className="w-7 h-7 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">{t('nav.field_officer')}</h2>
            <p className="text-sm text-slate-300">Dispute queue — demo data only, not a real case system</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 py-5 max-w-2xl mx-auto w-full">
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
            className="rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 active:bg-slate-100"
          >
            {sortAsc ? 'Oldest first' : 'Newest first'}
          </button>
        </div>

        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Showing {filtered.length} of {disputes.length} disputes
        </p>

        {isLoading && <p className="text-center text-slate-400 py-8">Loading…</p>}

        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8">No disputes match these filters.</p>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((d) => {
            const meta = STATUS_META[d.status]
            const { category, note } = splitDescription(d.description)
            const ZoneIcon = d.parcel ? ZONE_ICONS[d.parcel.zone_type] : AlertIcon
            return (
              <div key={d.id} className={`rounded-xl border-2 ${meta.border} bg-white p-4 flex flex-col gap-2`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-700">{d.fake_reference_number}</span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full ${meta.bg} ${meta.text} px-2.5 py-1 text-xs font-bold`}
                  >
                    <meta.Icon className="w-4 h-4" />
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <ZoneIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold">{d.parcel?.demo_village_name ?? 'Unknown village'}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-xs">{d.parcel_id}</span>
                </div>

                <p className="text-sm font-semibold text-slate-800">{category}</p>
                {note && <p className="text-sm text-slate-600">{note}</p>}

                <p className="text-xs text-slate-400">
                  Submitted {formatDate(d.created_at)} · {d.submitted_by}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-4">
          <ConnectionStatus />
        </div>
      </div>
    </div>
  )
}
