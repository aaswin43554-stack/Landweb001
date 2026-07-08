import { useTranslations } from '../lib/translations'
import { ArrowLeftIcon, BriefcaseIcon, GlobeIcon } from './icons'

type Props = {
  mode: 'citizen' | 'field-officer'
  onEnterFieldOfficer: () => void
  onExitFieldOfficer: () => void
}

export function Header({ mode, onEnterFieldOfficer, onExitFieldOfficer }: Props) {
  const { t, language, toggleLanguage } = useTranslations()

  return (
    <header className="w-full bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'field-officer' && (
            <button
              type="button"
              onClick={onExitFieldOfficer}
              className="shrink-0 p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200"
              aria-label={t('nav.back_to_citizen')}
            >
              <ArrowLeftIcon className="w-6 h-6 text-gray-700" />
            </button>
          )}
          <h1 className="text-lg font-bold truncate">{t('app.title')}</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 rounded-full border-2 border-gray-300 px-3 py-2 text-sm font-semibold active:bg-gray-100"
          >
            <GlobeIcon className="w-5 h-5" />
            {language === 'lo' ? 'ລາວ' : 'Min-demo'}
          </button>

          {mode === 'citizen' && (
            <button
              type="button"
              onClick={onEnterFieldOfficer}
              className="flex items-center gap-1.5 rounded-full border-2 border-gray-300 px-3 py-2 text-sm font-semibold active:bg-gray-100"
            >
              <BriefcaseIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{t('nav.field_officer')}</span>
            </button>
          )}
        </div>
      </div>

      {mode === 'citizen' && (
        <p className="mt-1 text-xs text-gray-500">
          {t('lastsynced.label')}: {t('lastsynced.value')}
        </p>
      )}
    </header>
  )
}
