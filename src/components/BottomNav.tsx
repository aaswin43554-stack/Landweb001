import type { CitizenScreen } from '../lib/navigation'
import { useTranslations } from '../lib/translations'
import { FlagIcon, MapIcon, SearchIcon } from './icons'

type Props = {
  active: CitizenScreen
  onChange: (screen: CitizenScreen) => void
  iconOnly?: boolean
}

const TABS: { screen: CitizenScreen; Icon: typeof SearchIcon; labelKey: string }[] = [
  { screen: 'parcel-lookup', Icon: SearchIcon, labelKey: 'nav.parcel_lookup' },
  { screen: 'land-use-explainer', Icon: MapIcon, labelKey: 'nav.land_use_explainer' },
  { screen: 'dispute-form', Icon: FlagIcon, labelKey: 'nav.dispute_form' },
]

export function BottomNav({ active, onChange, iconOnly = false }: Props) {
  const { t } = useTranslations()

  return (
    <nav className="w-full bg-white border-t border-gray-200 flex" role="tablist">
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
            className={`flex-1 flex flex-col items-center justify-center gap-1 px-1 transition-all ${
              iconOnly ? 'py-4' : 'py-3 text-xs font-semibold'
            } ${isActive ? 'text-emerald-700' : 'text-gray-500'}`}
          >
            <Icon className={`w-8 h-8 ${isActive ? 'text-emerald-700' : 'text-gray-400'}`} />
            {!iconOnly && <span className="leading-tight text-center">{t(labelKey)}</span>}
          </button>
        )
      })}
    </nav>
  )
}
