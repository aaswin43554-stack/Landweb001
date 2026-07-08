import { FlagIcon } from '../components/icons'
import { useTranslations } from '../lib/translations'

// Stub for M2 — the guided submission flow is built in M5.
export function DisputeFormScreen() {
  const { t } = useTranslations()

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <FlagIcon className="w-16 h-16 text-emerald-600" />
      <h2 className="text-xl font-bold">{t('nav.dispute_form')}</h2>
      <p className="text-gray-600 max-w-sm">{t('stub.coming_soon')}</p>
    </div>
  )
}
