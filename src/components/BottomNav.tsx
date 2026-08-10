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
    <nav className="sticky bottom-0 z-30 w-full bg-white border-t border-gray-200 flex shadow-lg select-none" role="tablist">
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
            className={`flex-1 flex flex-col items-center justify-center gap-1 px-1 transition-all cursor-pointer touch-manipulation active:scale-95 ${
              iconOnly ? 'py-3 pb-4' : 'py-2 pb-3.5 text-xs font-semibold'
            } ${isActive ? 'text-emerald-700 bg-emerald-50/50' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${isActive ? 'text-emerald-700' : 'text-gray-400'}`} />
            {!iconOnly && <span className="leading-tight text-center text-[11px] sm:text-xs font-bold">{t(labelKey)}</span>}
          </button>
        )
      })}
    </nav>
  )
}
