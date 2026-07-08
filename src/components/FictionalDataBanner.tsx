import { useTranslations } from '../lib/translations'

/**
 * Non-negotiable guardrail (see build guide section 0 and 11): every
 * screen in this prototype must make it obvious, without anyone having
 * to ask, that nothing here is real. This banner is rendered once in
 * App.tsx above all routes so no future screen can ship without it.
 * Text is sourced from `translations` (banner.fictional_notice) since an
 * English-only disclaimer is meaningless to the Lao/minority-language
 * citizens this app is for.
 */
export function FictionalDataBanner() {
  const { t } = useTranslations()

  return (
    <div
      role="note"
      aria-label="Prototype disclaimer"
      className="w-full bg-amber-300 text-amber-950 text-center py-2 px-4 text-sm sm:text-base font-semibold border-b-2 border-amber-500"
    >
      {t('banner.fictional_notice')}
    </div>
  )
}
