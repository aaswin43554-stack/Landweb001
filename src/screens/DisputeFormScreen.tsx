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
import { QrCode } from '../components/QrCode'
import { buildSyncPayload, encodeSyncPayload } from '../lib/syncPayload'

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
    photos: [] as string[],
    audio: null as string | null,
  }
}

type DisputeFormScreenProps = {
  onTriggerP2PSync?: () => void
}

export function DisputeFormScreen({ onTriggerP2PSync }: DisputeFormScreenProps = {}) {
  const { t, language } = useTranslations()
  const [villages, setVillages] = useState<Village[]>([])
  const [state, setState] = useState(initialState)
  const { step, selectedVillageId, parcels, selectedParcelId, category, note, isSubmitting, submitError, referenceNumber, wasQueued, photos, audio } = state

  // Media Capture states
  const [isListening, setIsListening] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    fetchVillages().then(setVillages)

    // Cleanups
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
      stopCamera()
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
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
    const result = await createDispute({ 
      parcelId: selectedParcelId, 
      category, 
      note,
      photos,
      audio 
    })
    if (!result) {
      setState((s) => ({ ...s, isSubmitting: false, submitError: true }))
      return
    }
    setState((s) => ({ ...s, isSubmitting: false, referenceNumber: result.fakeReferenceNumber, wasQueued: result.queued }))
  }

  // Speech to Text Notes
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

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onerror = () => setIsListening(false)

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

  // Camera capture methods
  async function startCamera() {
    setCameraActive(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err) {
      console.warn('Camera stream failed, using file picker fallback:', err)
      setCameraActive(false)
      document.getElementById('photo-fallback-input')?.click()
    }
  }

  function capturePhoto() {
    if (videoRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth || 640
      canvas.height = videoRef.current.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        setState((s) => ({ ...s, photos: [...s.photos, dataUrl] }))
      }
      stopCamera()
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setState((s) => ({ ...s, photos: [...s.photos, reader.result as string] }))
        }
      }
      reader.readAsDataURL(files[i])
    }
  }

  function deletePhoto(idx: number) {
    setState((s) => ({ ...s, photos: s.photos.filter((_, i) => i !== idx) }))
  }

  // Microphone recording methods
  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data)
          }
        }

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setState((s) => ({ ...s, audio: reader.result as string }))
            }
          }
          reader.readAsDataURL(audioBlob)
          stream.getTracks().forEach((track) => track.stop())
        }

        mediaRecorder.start()
        setIsRecording(true)
        setRecordDuration(0)
        recordingTimerRef.current = window.setInterval(() => {
          setRecordDuration((d) => d + 1)
        }, 1000)
      })
      .catch((err) => {
        console.error(err)
        alert('Could not access microphone.')
      })
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }

  function clearAudio() {
    setState((s) => ({ ...s, audio: null }))
  }

  function buildCurrentSyncCode() {
    return encodeSyncPayload(
      buildSyncPayload({
        referenceNumber: referenceNumber ?? '',
        parcelId: selectedParcelId,
        category: category ?? 'other',
        note,
        photos,
        audio,
      }),
    )
  }

  function copyP2PCode() {
    navigator.clipboard.writeText(buildCurrentSyncCode())
    alert('Offline Sync Code copied! Paste it in the Field Officer dashboard to import.')
  }

  if (referenceNumber) {
    return (
      <div className="flex-1 flex flex-col items-center justify-start gap-4 px-5 py-6 text-center max-w-md mx-auto w-full overflow-y-auto">
        <CheckCircleIcon className="w-14 h-14 text-emerald-600 shrink-0" />
        <h2 className="text-xl font-bold text-gray-800">{t('dispute.confirmation_title')}</h2>
        <p className="text-sm text-gray-600">{t('dispute.confirmation_body')}</p>

        <div className="w-full rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3.5 shadow-sm">
          <p className="text-xs font-semibold text-emerald-800">{t('dispute.reference_label')}</p>
          <p className="text-xl font-bold text-emerald-900 tracking-wide mt-0.5">{referenceNumber}</p>
          <p className="text-xs text-emerald-800 mt-2">{t('dispute.keep_reference')}</p>
        </div>

        {/* Offline Queued Warning */}
        {wasQueued && (
          <div className="w-full rounded-xl bg-blue-50 border-2 border-blue-300 px-4 py-3 shadow-sm text-left">
            <p className="text-xs font-bold text-blue-900">📱 Saved Offline</p>
            <p className="text-xs text-blue-800 mt-0.5">
              This dispute is stored locally and will sync when a network connection is established.
            </p>
          </div>
        )}

        {/* P2P Local QR Sharing Section */}
        <div className="w-full rounded-2xl border-2 border-gray-200 bg-white p-4 flex flex-col items-center gap-3 shadow-sm">
          <p className="text-sm font-bold text-gray-800">Local P2P Sharing (Offline Sync)</p>
          <p className="text-xs text-gray-500">
            Let a field officer scan this code with their device camera to import this dispute instantly.
          </p>

          <div className="relative border-4 border-gray-100 p-2 rounded-xl bg-white">
            <QrCode value={buildCurrentSyncCode()} size={176} className="w-44 h-44" />
          </div>

          {(photos.length > 0 || audio) && (
            <p className="text-[11px] text-gray-500 text-center bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              Your {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
              {photos.length > 0 && audio ? ' and ' : ''}
              {audio ? 'voice note' : ''} stay on this phone — the code carries the case details, and
              the evidence uploads once you have a connection.
            </p>
          )}

          <button
            type="button"
            onClick={copyP2PCode}
            className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg active:bg-emerald-100"
          >
            Copy Sync Code (Clipboard)
          </button>
        </div>

        {/* P2P Bluetooth Direct Send Button */}
        <button
          type="button"
          onClick={() => {
            if (onTriggerP2PSync) {
              onTriggerP2PSync()
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer border border-blue-500"
        >
          <span>📶</span> Send to Officer via P2P Bluetooth
        </button>

        <button
          type="button"
          onClick={() => setState(initialState())}
          className="w-full rounded-xl bg-emerald-700 text-white py-4 text-base font-bold hover:bg-emerald-800 active:scale-98 transition-all shadow shrink-0"
        >
          {t('dispute.confirmation_new')}
        </button>
      </div>
    )
  }

  const canGoNext = (step === 0 && Boolean(selectedParcelId)) || (step === 1 && Boolean(category)) || step === 2

  return (
    <div className="flex-1 flex flex-col gap-4 px-4 py-5 max-w-lg mx-auto w-full overflow-y-auto">
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
          
          {/* Notes area */}
          <div className="flex flex-col gap-2 relative">
            <div className="flex items-center justify-between">
              <label htmlFor="dispute-note" className="font-semibold text-sm">
                {t('dispute.note_label')}
              </label>
              
              <button
                type="button"
                onClick={toggleSpeechToText}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all ${
                  isListening
                    ? 'border-red-500 bg-red-600 text-white animate-pulse'
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
                <span>{isListening ? '🛑 Stop Recording Notes' : '🎙️ Speak Notes'}</span>
              </button>
            </div>
            
            <textarea
              id="dispute-note"
              value={note}
              onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
              placeholder={t('dispute.step3_placeholder')}
              rows={3}
              className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-base bg-white resize-none focus:border-emerald-600 focus:outline-none animate-in"
            />

            {/* Active Speech-to-Text Recording Indicator */}
            {isListening && (
              <div className="bg-red-50 border-2 border-red-300 text-red-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2.5 animate-pulse shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 block shrink-0"></span>
                <span className="font-semibold">Speech Recognition Active: Speak now. Tap the red button to Stop.</span>
              </div>
            )}
          </div>

          {/* Multimodal Attachments Panel */}
          <div className="flex flex-col gap-3 border-2 border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50/50 shadow-inner">
            <p className="text-sm font-bold text-gray-700">Add Evidence (Photos / Voice Note)</p>
            
            <div className="flex flex-wrap gap-2">
              {/* Photo Capture trigger */}
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                📸 Take Photo
              </button>

              {/* Local File Selector Trigger */}
              <button
                type="button"
                onClick={() => document.getElementById('photo-fallback-input')?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                📁 Select Photo File
              </button>
              <input
                id="photo-fallback-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />

              {/* Voice recording trigger */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center gap-1.5 px-3 py-2 border-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  isRecording
                    ? 'bg-red-600 border-red-600 text-white animate-pulse'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                🎙️ {isRecording ? `🛑 Stop Recording Voice (${recordDuration}s)` : '🎙️ Record Voice'}
              </button>
            </div>

            {/* Pulsing Voice Recording Indicator banner */}
            {isRecording && (
              <div className="bg-red-50 border-2 border-red-300 text-red-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2.5 animate-pulse shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 block shrink-0"></span>
                <span className="font-semibold">Voice Recorder Active: Recording audio evidence... ({recordDuration}s). Tap Stop to save.</span>
              </div>
            )}

            {/* Video stream panel when camera is active */}
            {cameraActive && (
              <div className="w-full flex flex-col gap-2 border border-gray-300 rounded-xl overflow-hidden bg-black p-1">
                <video ref={videoRef} className="w-full h-48 object-cover rounded-lg" playsInline muted />
                <div className="flex gap-2 p-1">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs"
                  >
                    Capture Frame
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg font-bold text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Photo Previews */}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {photos.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 border-2 border-gray-300 rounded-xl overflow-hidden shadow-sm shrink-0">
                    <img src={url} className="w-full h-full object-cover" alt="attachment" />
                    <button
                      type="button"
                      onClick={() => deletePhoto(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center text-[10px] font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Audio note player */}
            {audio && (
              <div className="w-full bg-white border-2 border-gray-200 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-xs">
                <audio src={audio} controls className="h-8 max-w-full shrink-1" />
                <button
                  type="button"
                  onClick={clearAudio}
                  className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            )}
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
            
            {/* Review Attachments summary */}
            {(photos.length > 0 || audio) && (
              <div className="border-t border-gray-150 pt-2.5 mt-1 flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase">Attached Evidence</p>
                <div className="flex items-center gap-3">
                  {photos.length > 0 && <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md">📸 {photos.length} Photos</span>}
                  {audio && <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md">🎙️ 1 Audio Clip</span>}
                </div>
              </div>
            )}
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
