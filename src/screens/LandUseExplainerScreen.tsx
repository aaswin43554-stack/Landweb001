import { MapIcon } from '../components/icons'
import { useTranslations } from '../lib/translations'

// Stub for M2 — real map/zone visualization is built in M4.
export function LandUseExplainerScreen() {
  const { t } = useTranslations()

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <MapIcon className="w-16 h-16 text-emerald-600" />
      <h2 className="text-xl font-bold">{t('nav.land_use_explainer')}</h2>
      <p className="text-gray-600 max-w-sm">{t('stub.coming_soon')}</p>
    </div>
  )
}
