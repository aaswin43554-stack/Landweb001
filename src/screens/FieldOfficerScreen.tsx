import { BriefcaseIcon } from '../components/icons'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { useTranslations } from '../lib/translations'

// Stub for M2 — the dispute queue/list view is built in M6.
export function FieldOfficerScreen() {
  const { t } = useTranslations()

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center bg-gray-50">
      <BriefcaseIcon className="w-16 h-16 text-gray-700" />
      <h2 className="text-xl font-bold">{t('nav.field_officer')}</h2>
      <p className="text-gray-600 max-w-sm">{t('stub.coming_soon')}</p>
      <div className="mt-4">
        <ConnectionStatus />
      </div>
    </div>
  )
}
