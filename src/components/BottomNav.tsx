import type { CitizenScreen } from '../lib/navigation'
import { useTranslations } from '../lib/translations'
import { ClockIcon, FlagIcon, MapIcon, SearchIcon } from './icons'

type Props = {
  active: CitizenScreen
  onChange: (screen: CitizenScreen) => void
  iconOnly?: boolean
}

const TABS: { screen: CitizenScreen; Icon: typeof SearchIcon; labelKey: string }[] = [
  { screen: 'parcel-lookup', Icon: SearchIcon, labelKey: 'nav.parcel_lookup' },
  { screen: 'land-use-explainer', Icon: MapIcon, labelKey: 'nav.land_use_explainer' },
  { screen: 'dispute-form', Icon: FlagIcon, labelKey: 'nav.dispute_form' },
  { screen: 'case-status', Icon: ClockIcon, labelKey: 'nav.case_status' },
]

export function BottomNav({ active, onChange, iconOnly = false }: Props) {
  const { t } = useTranslations()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 flex shadow-2xl select-none" role="tablist">
      {TABS.map(({ screen, Icon, labelKey }) => {
        const isActive = screen === active
        return (
          <button
            key={screen}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => onChange(screen)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] relative px-1 transition-all cursor-pointer touch-manipulation active:scale-95 ${
              iconOnly ? 'py-3 pb-3' : 'py-2 pb-3 text-xs font-bold'
            } ${isActive ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-emerald-600 rounded-b-full shadow-sm" />
            )}
            <Icon className={`w-6 h-6 sm:w-7 sm:h-7 transition-transform ${isActive ? 'text-emerald-700 dark:text-emerald-400 scale-110' : 'text-slate-400'}`} />
            {!iconOnly && <span className="leading-tight text-center text-[11px] sm:text-xs font-extrabold">{t(labelKey)}</span>}
          </button>
        )
      })}
    </nav>
  )
}
