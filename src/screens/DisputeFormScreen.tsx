import { useEffect, useState } from 'react'
import {
  AlertIcon,
  ArrowLeftIcon,
  BoundaryIcon,
  CheckCircleIcon,
  ClockIcon,
  CropIcon,
  DotsIcon,
  FlagIcon,
  HomeIcon,
  InfoIcon,
  PersonIcon,
  TreeIcon,
} from '../components/icons'
import {
  createDispute,
  fetchParcelsByVillage,
  fetchVillages,
  type DisputeCategory,
  type Parcel,
  type Village,
  type ZoneType,
} from '../lib/land'
import { useTranslations } from '../lib/translations'

const ZONE_ICONS: Record<ZoneType, typeof TreeIcon> = {
  forest: TreeIcon,
  agricultural: CropIcon,
  residential: HomeIcon,
  disputed: AlertIcon,
}

const STATUS_ICONS = {
  registered: CheckCircleIcon,
  pending: ClockIcon,
  disputed: AlertIcon,
} as const

const CATEGORIES: { id: DisputeCategory; Icon: typeof BoundaryIcon }[] = [
  { id: 'boundary', Icon: BoundaryIcon },
  { id: 'wrong_info', Icon: InfoIcon },
  { id: 'ownership', Icon: PersonIcon },
  { id: 'other', Icon: DotsIcon },
]

const STEP_COUNT = 4

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {Array.from({ length: STEP_COUNT }).map((_, i) => (
        <span
          key={i}
          className={`h-2.5 rounded-full transition-all ${
            i === step ? 'w-7 bg-emerald-700' : i < step ? 'w-2.5 bg-emerald-400' : 'w-2.5 bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

function initialState() {
  return {
    step: 0,
    selectedVillageId: '',
    parcels: [] as Parcel[],
    selectedParcelId: '',
    category: null as DisputeCategory | null,
    note: '',
    isSubmitting: false,
    submitError: false,
    referenceNumber: null as string | null,
  }
}

export function DisputeFormScreen() {
  const { t } = useTranslations()
  const [villages, setVillages] = useState<Village[]>([])
  const [state, setState] = useState(initialState)
  const { step, selectedVillageId, parcels, selectedParcelId, category, note, isSubmitting, submitError, referenceNumber } = state

  useEffect(() => {
    fetchVillages().then(setVillages)
  }, [])

  async function handleVillageChange(villageId: string) {
    setState((s) => ({ ...s, selectedVillageId: villageId, selectedParcelId: '', parcels: [] }))
    if (!villageId) return
    const fetched = await fetchParcelsByVillage(villageId)
    setState((s) => ({ ...s, parcels: fetched }))
  }

  function goNext() {
    setState((s) => ({ ...s, step: Math.min(s.step + 1, STEP_COUNT - 1) }))
  }

  function goBack() {
    setState((s) => ({ ...s, step: Math.max(s.step - 1, 0) }))
  }

  async function handleSubmit() {
    if (!selectedParcelId || !category) return
    setState((s) => ({ ...s, isSubmitting: true, submitError: false }))
    const result = await createDispute({ parcelId: selectedParcelId, category, note })
    if (!result) {
      setState((s) => ({ ...s, isSubmitting: false, submitError: true }))
      return
    }
    setState((s) => ({ ...s, isSubmitting: false, referenceNumber: result.fakeReferenceNumber }))
  }

  if (referenceNumber) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center max-w-md mx-auto w-full">
        <CheckCircleIcon className="w-16 h-16 text-emerald-600" />
        <h2 className="text-xl font-bold">{t('dispute.confirmation_title')}</h2>
        <p className="text-gray-700">{t('dispute.confirmation_body')}</p>

        <div className="w-full rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-4 py-4">
          <p className="text-sm font-semibold text-emerald-800">{t('dispute.reference_label')}</p>
          <p className="text-2xl font-bold text-emerald-900 tracking-wide mt-1">{referenceNumber}</p>
        </div>

        <div className="w-full rounded-xl bg-amber-50 border-2 border-amber-300 px-4 py-3">
          <p className="text-sm text-amber-900">{t('dispute.confirmation_disclaimer')}</p>
        </div>

        <button
          type="button"
          onClick={() => setState(initialState())}
          className="w-full rounded-xl bg-emerald-700 text-white py-4 text-lg font-bold active:bg-emerald-800"
        >
          {t('dispute.confirmation_new')}
        </button>
      </div>
    )
  }

  const canGoNext = (step === 0 && Boolean(selectedParcelId)) || (step === 1 && Boolean(category)) || step === 2

  return (
    <div className="flex-1 flex flex-col gap-5 px-4 py-5 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3">
        <FlagIcon className="w-8 h-8 text-emerald-700 shrink-0" />
        <h2 className="text-xl font-bold">{t('nav.dispute_form')}</h2>
      </div>

      <StepDots step={step} />

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold">{t('dispute.step_parcel')}</h3>

          <div className="flex flex-col gap-2">
            <label htmlFor="dispute-village-select" className="font-semibold text-sm">
              {t('lookup.village_label')}
            </label>
            <select
              id="dispute-village-select"
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

          {selectedVillageId && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-sm">{t('dispute.parcel_label')}</p>
              {parcels.length === 0 && <p className="text-gray-500 text-sm">{t('dispute.no_parcels')}</p>}
              <div className="flex flex-col gap-2">
                {parcels.map((p) => {
                  const ZoneIcon = ZONE_ICONS[p.zone_type]
                  const StatusIcon = STATUS_ICONS[p.status]
                  const isSelected = p.id === selectedParcelId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setState((s) => ({ ...s, selectedParcelId: p.id }))}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left ${
                        isSelected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <ZoneIcon className={`w-7 h-7 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{t(`zone.${p.zone_type}`)}</p>
                        <p className="text-xs text-gray-400">{p.id}</p>
                      </div>
                      <StatusIcon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-gray-400'}`} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold">{t('dispute.step_category')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(({ id, Icon }) => {
              const isSelected = category === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, category: id }))}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 text-center ${
                    isSelected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <Icon className={`w-9 h-9 ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`} />
                  <span className="text-sm font-semibold text-gray-800">{t(`dispute.category.${id}`)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold">{t('dispute.step3_title')}</h3>
          <div className="flex flex-col gap-2">
            <label htmlFor="dispute-note" className="font-semibold text-sm">
              {t('dispute.note_label')}
            </label>
            <textarea
              id="dispute-note"
              value={note}
              onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
              placeholder={t('dispute.step3_placeholder')}
              rows={4}
              className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-base bg-white resize-none"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold">{t('dispute.step4_title')}</h3>
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 bg-white p-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase">{t('dispute.review_village')}</p>
              <p className="text-base font-semibold text-gray-800">
                {villages.find((v) => v.id === selectedVillageId)?.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase">{t('dispute.review_parcel')}</p>
              <p className="text-base font-semibold text-gray-800">{selectedParcelId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase">{t('dispute.review_category')}</p>
              <p className="text-base font-semibold text-gray-800">{category && t(`dispute.category.${category}`)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase">{t('dispute.review_note')}</p>
              <p className="text-base text-gray-700">{note.trim() || t('dispute.review_note_empty')}</p>
            </div>
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 border-2 border-red-300 px-4 py-3">
              <p className="text-sm text-red-800">{t('dispute.submit_error')}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-3 pt-2">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 px-5 py-4 text-base font-bold text-gray-700 active:bg-gray-100"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            {t('dispute.back')}
          </button>
        )}

        {step < STEP_COUNT - 1 && (
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="flex-1 rounded-xl bg-emerald-700 text-white py-4 text-lg font-bold active:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {t('dispute.next')}
          </button>
        )}

        {step === STEP_COUNT - 1 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-emerald-700 text-white py-4 text-lg font-bold active:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-500"
          >
            {t('dispute.submit')}
          </button>
        )}
      </div>
    </div>
  )
}
