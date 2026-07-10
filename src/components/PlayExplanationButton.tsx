import { SpeakerIcon } from './icons'
import { useTranslations } from '../lib/translations'

// M8 polish pass: a static, non-functional concept button. It must never
// play real audio — this is a "phase 2 idea" placeholder to show GIZ the
// shape of a future accessibility feature for low-literacy users, not a
// working feature (see module_prompts.txt, M8).
export function PlayExplanationButton({ className = '' }: { className?: string }) {
  const { t } = useTranslations()

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={t('audio.coming_soon_badge')}
        className="flex items-center gap-2 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
      >
        <SpeakerIcon className="w-5 h-5" />
        {t('audio.play_button')}
      </button>
      <span className="text-xs text-gray-400 italic">{t('audio.coming_soon_badge')}</span>
    </div>
  )
}
