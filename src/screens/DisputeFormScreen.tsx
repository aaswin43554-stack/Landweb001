import { useEffect, useState, useRef } from 'react'
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  CropIcon,
  FlagIcon,
  HomeIcon,
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

const CATEGORIES: DisputeCategory[] = ['boundary', 'wrong_info', 'ownership', 'other']

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

function CategoryIllustration({ id, active }: { id: DisputeCategory; active: boolean }) {
  const strokeColor = active ? '#047857' : '#6b7280'
  const fillColor = active ? '#d1fae5' : '#f3f4f6'
  
  if (id === 'boundary') {
    return (
      <svg
        viewBox="0 0 100 80"
        className="w-full h-24 mb-2 shrink-0"
        stroke={strokeColor}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 20 L45 15 L45 65 L10 60 Z" fill={fillColor} />
        <path d="M55 15 L90 20 L90 60 L55 65 Z" fill={fillColor} />
        <path d="M45 15 L55 15" stroke="#ef4444" strokeWidth="3" strokeDasharray="3,3" />
        <path d="M45 65 L55 65" stroke="#ef4444" strokeWidth="3" strokeDasharray="3,3" />
        <path d="M47 30 L53 50" stroke="#ef4444" strokeWidth="4" />
        <circle cx="50" cy="40" r="10" stroke="#ef4444" strokeWidth="2.5" />
        <line x1="50" y1="36" x2="50" y2="41" stroke="#ef4444" strokeWidth="3" />
        <circle cx="50" cy="45" r="1" fill="#ef4444" stroke="none" />
      </svg>
    )
  }
  
  if (id === 'wrong_info') {
    return (
      <svg
        viewBox="0 0 100 80"
        className="w-full h-24 mb-2 shrink-0"
        stroke={strokeColor}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="25" y="10" width="50" height="60" rx="4" fill={fillColor} />
        <line x1="35" y1="24" x2="65" y2="24" />
        <line x1="35" y1="36" x2="65" y2="36" />
        <line x1="35" y1="48" x2="55" y2="48" />
        <circle cx="65" cy="52" r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
        <path d="M61 48 L69 56" stroke="#ffffff" strokeWidth="2.5" />
        <path d="M69 48 L61 56" stroke="#ffffff" strokeWidth="2.5" />
      </svg>
    )
  }
  
  if (id === 'ownership') {
    return (
      <svg
        viewBox="0 0 100 80"
        className="w-full h-24 mb-2 shrink-0"
        stroke={strokeColor}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="25,55 50,40 75,55 50,70" fill={fillColor} />
        <circle cx="20" cy="25" r="7" />
        <path d="M10 45 C10 35 30 35 30 45" />
        <line x1="28" y1="35" x2="42" y2="42" strokeWidth="3" />
        
        <circle cx="80" cy="25" r="7" />
        <path d="M70 45 C70 35 90 35 90 45" />
        <line x1="72" y1="35" x2="58" y2="42" strokeWidth="3" />
        
        <circle cx="50" cy="25" r="10" stroke="#ef4444" strokeWidth="2.5" />
        <text x="50" y="29" textAnchor="middle" fill="#ef4444" stroke="none" fontSize="13" fontWeight="900">?</text>
      </svg>
    )
  }
  
  return (
    <svg
      viewBox="0 0 100 80"
      className="w-full h-24 mb-2 shrink-0"
      stroke={strokeColor}
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="20" y="20" width="60" height="45" rx="6" fill={fillColor} />
      <circle cx="50" cy="42" r="16" fill="#ffffff" stroke={strokeColor} strokeWidth="2.5" />
      <text x="50" y="48" textAnchor="middle" fill={strokeColor} stroke="none" fontSize="20" fontWeight="900">?</text>
    </svg>
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
    wasQueued: false,
  }
}

export function DisputeFormScreen() {
  const { t, language } = useTranslations()
  const [villages, setVillages] = useState<Village[]>([])
  const [state, setState] = useState(initialState)
  const { step, selectedVillageId, parcels, selectedParcelId, category, note, isSubmitting, submitError, referenceNumber, wasQueued } = state

  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    fetchVillages().then(setVillages)
    
    // Cleanup speech recognition on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
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
    setState((s) => ({ ...s, isSubmitting: false, referenceNumber: result.fakeReferenceNumber, wasQueued: result.queued }))
  }

  function toggleSpeechToText() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = {
        lo: 'lo-LA',
        en: 'en-US',
        hm: 'hmn-CN',
        km: 'khm-KH',
      }[language] || 'en-US'
      
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.onerror = (e: any) => {
        console.error('Speech recognition error:', e)
        setIsListening(false)
      }

      recognition.onresult = (event: any) => {
        const transcriptText = event.results[0][0].transcript
        if (transcriptText) {
          setState((s) => ({
            ...s,
            note: (s.note + ' ' + transcriptText).trim(),
          }))
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setIsListening(false)
    }
  }

  if (referenceNumber) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center max-w-md mx-auto w-full">
        <CheckCircleIcon className="w-16 h-16 text-emerald-600 animate-bounce" />
        <h2 className="text-xl font-bold text-gray-800">{t('dispute.confirmation_title')}</h2>
        <p className="text-gray-700">{t('dispute.confirmation_body')}</p>

        <div className="w-full rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-4 py-4 shadow-sm">
          <p className="text-sm font-semibold text-emerald-850">{t('dispute.reference_label')}</p>
          <p className="text-2xl font-bold text-emerald-900 tracking-wide mt-1">{referenceNumber}</p>
        </div>

        {wasQueued && (
          <div className="w-full rounded-xl bg-blue-50 border-2 border-blue-300 px-4 py-3 shadow-sm">
            <p className="text-sm text-blue-900 font-semibold">
              📱 Saved offline — will sync when connection is restored
            </p>
          </div>
        )}

        <div className="w-full rounded-xl bg-amber-50 border-2 border-amber-300 px-4 py-3">
          <p className="text-sm text-amber-900">{t('dispute.confirmation_disclaimer')}</p>
        </div>

        <button
          type="button"
          onClick={() => setState(initialState())}
          className="w-full rounded-xl bg-emerald-700 text-white py-4 text-lg font-bold hover:bg-emerald-800 active:scale-98 transition-all shadow"
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
              className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-base bg-white focus:border-emerald-600 focus:outline-none"
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
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {parcels.map((p) => {
                  const ZoneIcon = ZONE_ICONS[p.zone_type]
                  const StatusIcon = STATUS_ICONS[p.status]
                  const isSelected = p.id === selectedParcelId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setState((s) => ({ ...s, selectedParcelId: p.id }))}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                        isSelected ? 'border-emerald-600 bg-emerald-50 scale-101' : 'border-gray-200 bg-white hover:bg-gray-50'
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
            {CATEGORIES.map((id) => {
              const isSelected = category === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, category: id }))}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-center transition-all hover:bg-gray-50 active:scale-97 ${
                    isSelected ? 'border-emerald-600 bg-emerald-50 font-bold scale-102 shadow-sm' : 'border-gray-200 bg-white'
                  }`}
                >
                  <CategoryIllustration id={id} active={isSelected} />
                  <span className="text-sm font-semibold text-gray-800 leading-tight">{t(`dispute.category.${id}`)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold">{t('dispute.step3_title')}</h3>
          <div className="flex flex-col gap-2 relative">
            <div className="flex items-center justify-between">
              <label htmlFor="dispute-note" className="font-semibold text-sm">
                {t('dispute.note_label')}
              </label>
              
              {/* Voice-to-Text Button */}
              <button
                type="button"
                onClick={toggleSpeechToText}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all ${
                  isListening
                    ? 'border-red-500 bg-red-50 text-red-800 animate-pulse'
                    : 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
                title={isListening ? 'Stop listening' : 'Start speaking'}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 shrink-0"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                <span>{isListening ? 'Listening...' : 'Speak Notes'}</span>
              </button>
            </div>
            
            <textarea
              id="dispute-note"
              value={note}
              onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
              placeholder={t('dispute.step3_placeholder')}
              rows={4}
              className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-base bg-white resize-none focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold">{t('dispute.step4_title')}</h3>
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm">
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
              <p className="text-base text-gray-700 break-words whitespace-pre-wrap">{note.trim() || t('dispute.review_note_empty')}</p>
            </div>
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 border-2 border-red-300 px-4 py-3 shadow-sm">
              <p className="text-sm text-red-800 font-semibold">{t('dispute.submit_error')}</p>
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
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 px-5 py-4 text-base font-bold text-gray-700 hover:bg-gray-50 active:scale-97 transition-all"
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
            className="flex-1 rounded-xl bg-emerald-700 text-white py-4 text-lg font-bold hover:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-500 active:scale-98 transition-all shadow"
          >
            {t('dispute.next')}
          </button>
        )}

        {step === STEP_COUNT - 1 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-emerald-700 text-white py-4 text-lg font-bold hover:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-500 active:scale-98 transition-all shadow"
          >
            {t('dispute.submit')}
          </button>
        )}
      </div>
    </div>
  )
}
