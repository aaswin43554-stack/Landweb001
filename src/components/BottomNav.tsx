import type { CitizenScreen } from '../lib/navigation'
import { useTranslations } from '../lib/translations'
import { FlagIcon, MapIcon, SearchIcon } from './icons'

type Props = {
  active: CitizenScreen
  onChange: (screen: CitizenScreen) => void
}

const TABS: { screen: CitizenScreen; Icon: typeof SearchIcon; labelKey: string }[] = [
  { screen: 'parcel-lookup', Icon: SearchIcon, labelKey: 'nav.parcel_lookup' },
  { screen: 'land-use-explainer', Icon: MapIcon, labelKey: 'nav.land_use_explainer' },
  { screen: 'dispute-form', Icon: FlagIcon, labelKey: 'nav.dispute_form' },
]

export function BottomNav({ active, onChange }: Props) {
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
            onClick={() => onChange(screen)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 px-1 text-xs font-semibold ${
              isActive ? 'text-emerald-700' : 'text-gray-500'
            }`}
          >
            <Icon className={`w-7 h-7 ${isActive ? 'text-emerald-700' : 'text-gray-400'}`} />
            <span className="leading-tight text-center">{t(labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
