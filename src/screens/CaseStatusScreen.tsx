import { useState } from 'react'
import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  QrIcon,
  SearchIcon,
} from '../components/icons'
import { PlayExplanationButton } from '../components/PlayExplanationButton'
import { QrScanner } from '../components/QrScanner'
import { fetchDisputeByReference, type Dispute, type DisputeStatus } from '../lib/land'
import { useTranslations } from '../lib/translations'

const STATUS_STEPS: DisputeStatus[] = ['submitted', 'in_review', 'resolved']

const STATUS_META: Record<DisputeStatus, { Icon: typeof ClockIcon; ring: string; fill: string; text: string }> = {
  submitted: { Icon: ClockIcon, ring: 'border-blue-500', fill: 'bg-blue-50', text: 'text-blue-800' },
  in_review: { Icon: SearchIcon, ring: 'border-amber-500', fill: 'bg-amber-50', text: 'text-amber-800' },
  resolved: { Icon: CheckCircleIcon, ring: 'border-emerald-600', fill: 'bg-emerald-50', text: 'text-emerald-800' },
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/**
 * Reference codes are printed uppercase on the confirmation screen, but
 * villagers may type them in any case or omit the DEMO- prefix entirely.
 */
function normalizeReference(raw: string): string {
  const trimmed = raw.trim().toUpperCase()
  const match = trimmed.match(/DEMO-DSP-[A-Z0-9-]+/)
  if (match) return match[0]
  if (/^\d+$/.test(trimmed)) return `DEMO-DSP-${trimmed.padStart(4, '0')}`
  return trimmed
}

function Timeline({ dispute }: { dispute: Dispute }) {
  const { t } = useTranslations()
  const events = dispute.events ?? []
  const reachedIndex = STATUS_STEPS.indexOf(dispute.status)

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-gray-700">{t('case.timeline_title')}</h3>

      <ol className="flex flex-col">
        {STATUS_STEPS.map((step, i) => {
          const meta = STATUS_META[step]
          const reached = i <= reachedIndex
          const event = events.find((e) => e.to_status === step)
          const isLast = i === STATUS_STEPS.length - 1

          return (
            <li key={step} className="flex gap-3">
              <div className="flex flex-col items-center shrink-0">
                <span
                  className={`w-11 h-11 rounded-full border-2 flex items-center justify-center ${
                    reached ? `${meta.ring} ${meta.fill}` : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <meta.Icon className={`w-6 h-6 ${reached ? meta.text : 'text-gray-300'}`} />
                </span>
                {!isLast && (
                  <span className={`w-1 flex-1 min-h-8 ${i < reachedIndex ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>

              <div className={`pb-6 min-w-0 flex-1 ${reached ? '' : 'opacity-50'}`}>
                <p className={`text-base font-bold ${reached ? meta.text : 'text-gray-400'}`}>
                  {t(`officer.status.${step}`)}
                </p>

                {event && <p className="text-xs text-gray-400 mt-0.5">{formatDate(event.created_at)}</p>}

                {event?.note && (
                  <div className="mt-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-bold uppercase text-emerald-700">{t('case.officer_remark')}</p>
                    <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap break-words">{event.note}</p>
                    <PlayExplanationButton text={event.note} />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {reachedIndex === 0 && <p className="text-sm text-gray-500">{t('case.awaiting')}</p>}
    </div>
  )
}

export function CaseStatusScreen() {
  const { t } = useTranslations()
  const [reference, setReference] = useState('')
  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  async function lookup(raw: string) {
    const normalized = normalizeReference(raw)
    if (!normalized) return

    setIsLoading(true)
    setNotFound(false)
    setDispute(null)

    const found = await fetchDisputeByReference(normalized)
    if (found) {
      setDispute(found)
    } else {
      setNotFound(true)
    }
    setIsLoading(false)
  }

  function handleScanResult(value: string) {
    setShowScanner(false)
    // A scanned sync code is JSON; a printed slip may just be the bare code.
    let scanned = value
    try {
      const parsed = JSON.parse(value)
      if (parsed?.id) scanned = String(parsed.id)
    } catch {
      // Not JSON — use the raw value.
    }
    setReference(scanned)
    lookup(scanned)
  }

  const isOfflineCase = dispute?.fake_reference_number.includes('OFFLINE')

  return (
    <div className="flex-1 flex flex-col gap-5 px-4 py-5 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3">
        <SearchIcon className="w-8 h-8 text-emerald-700 shrink-0" />
        <h2 className="text-xl font-bold">{t('case.title')}</h2>
      </div>

      <p className="text-sm text-gray-600">{t('case.intro')}</p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          lookup(reference)
        }}
      >
        <label htmlFor="case-reference" className="font-semibold text-sm">
          {t('case.input_label')}
        </label>
        <input
          id="case-reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="DEMO-DSP-0001"
          autoComplete="off"
          className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-base bg-white font-mono tracking-wide focus:border-emerald-600 focus:outline-none"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!reference.trim() || isLoading}
            className="flex-1 rounded-xl bg-emerald-700 text-white py-4 text-base font-bold active:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {t('case.search')}
          </button>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            aria-label={t('case.scan')}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 px-4 py-4 text-sm font-bold text-gray-700 active:bg-gray-50"
          >
            <QrIcon className="w-6 h-6" />
          </button>
        </div>
      </form>

      {showScanner && (
        <QrScanner
          title={t('case.scan')}
          hint={t('case.intro')}
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {isLoading && <p className="text-center text-gray-400">…</p>}

      {notFound && !isLoading && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3">
          <AlertIcon className="w-6 h-6 text-red-600 shrink-0" />
          <p className="text-sm font-semibold text-red-800">{t('case.not_found')}</p>
        </div>
      )}

      {dispute && !isLoading && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 flex flex-col gap-1">
            <p className="font-mono text-base font-bold text-gray-800">{dispute.fake_reference_number}</p>
            <p className="text-sm text-gray-600">
              {dispute.parcel?.demo_village_name ?? '—'} · <span className="font-mono text-xs">{dispute.parcel_id}</span>
            </p>
            <p className="text-xs text-gray-400">{formatDate(dispute.created_at)}</p>
          </div>

          {isOfflineCase && (
            <p className="rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {t('case.offline_notice')}
            </p>
          )}

          <Timeline dispute={dispute} />

          {dispute.description && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-bold text-gray-700">{t('case.your_report')}</h3>
              <p className="rounded-xl border-2 border-gray-200 bg-white p-3 text-sm text-gray-800 whitespace-pre-wrap break-words">
                {dispute.description}
              </p>
            </div>
          )}

          {((dispute.photos?.length ?? 0) > 0 || dispute.audio) && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-gray-700">{t('case.your_evidence')}</h3>

              {(dispute.photos?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dispute.photos?.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden shrink-0"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {dispute.audio && <audio src={dispute.audio} controls className="w-full h-10" />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
