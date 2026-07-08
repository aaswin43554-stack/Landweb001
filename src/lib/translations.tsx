import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabaseClient'

export type Language = 'lo' | 'min-demo'

type TranslationEntry = { lao_text: string; sample_minority_language_text: string }

// Baked-in copy of the M1 seed data (see supabase/seed.sql) so the UI
// renders correctly instantly, before the live fetch resolves, and still
// works if a teammate hasn't configured .env yet.
const FALLBACK_TRANSLATIONS: Record<string, TranslationEntry> = {
  'app.title': { lao_text: 'ຂໍ້ມູນທີ່ດິນ', sample_minority_language_text: 'Dinfo Baan' },
  'banner.fictional_notice': {
    lao_text: 'ຕົວຢ່າງ - ຂໍ້ມູນສົມມຸດຕິຖານເທົ່ານັ້ນ',
    sample_minority_language_text: 'Sampol - demo data bo tae',
  },
  'nav.parcel_lookup': { lao_text: 'ຄົ້ນຫາທີ່ດິນ', sample_minority_language_text: 'Hasearch dinlan' },
  'nav.land_use_explainer': { lao_text: 'ອະທິບາຍເຂດທີ່ດິນ', sample_minority_language_text: 'Zone-info dinlan' },
  'nav.dispute_form': { lao_text: 'ແຈ້ງບັນຫາ', sample_minority_language_text: 'Report panha' },
  'nav.field_officer': { lao_text: 'ເຈົ້າໜ້າທີ່ພາກສະໜາມ', sample_minority_language_text: 'Field officero' },
  'nav.back_to_citizen': { lao_text: 'ກັບຄືນ', sample_minority_language_text: 'Backo to citizeno' },
  'status.registered': { lao_text: 'ລົງທະບຽນແລ້ວ', sample_minority_language_text: 'Registo-don' },
  'status.pending': { lao_text: 'ກຳລັງລໍຖ້າ', sample_minority_language_text: 'Waito-lang' },
  'status.disputed': { lao_text: 'ມີຂໍ້ຂັດແຍ້ງ', sample_minority_language_text: 'Disputo-nay' },
  'zone.forest': { lao_text: 'ປ່າໄມ້', sample_minority_language_text: 'Foresto-mai' },
  'zone.agricultural': { lao_text: 'ເຂດກະສິກຳ', sample_minority_language_text: 'Farmo-kasi' },
  'zone.residential': { lao_text: 'ເຂດທີ່ຢູ່ອາໄສ', sample_minority_language_text: 'Homo-asai' },
  'zone.disputed': { lao_text: 'ເຂດຂັດແຍ້ງ', sample_minority_language_text: 'Disputo-zone' },
  'search.placeholder': { lao_text: 'ພິມຊື່ບ້ານ...', sample_minority_language_text: 'Type baan nane...' },
  'search.button': { lao_text: 'ຄົ້ນຫາ', sample_minority_language_text: 'Searcho' },
  'scan.button': { lao_text: 'ສະແກນລະຫັດສາທິດ', sample_minority_language_text: 'Scano demo-code' },
  'lastsynced.label': { lao_text: 'ອັບເດດຫຼ້າສຸດ', sample_minority_language_text: 'Lasto-sync' },
  'lastsynced.value': { lao_text: '2 ຊົ່ວໂມງກ່ອນ', sample_minority_language_text: '2 hours agongo' },
  'dispute.step_parcel': { lao_text: 'ເລືອກທີ່ດິນ/ບ້ານ', sample_minority_language_text: 'Picko parcel' },
  'dispute.step_category': { lao_text: 'ເລືອກປະເພດບັນຫາ', sample_minority_language_text: 'Picko category' },
  'dispute.submit': { lao_text: 'ຍື່ນສົ່ງ', sample_minority_language_text: 'Sendo form' },
  'dispute.reference_label': { lao_text: 'ເລກອ້າງອີງ', sample_minority_language_text: 'Refo number' },
  'lookup.title': { lao_text: 'ກວດສອບສະຖານະທີ່ດິນ', sample_minority_language_text: 'Checko land status' },
  'lookup.village_label': { lao_text: 'ເລືອກບ້ານຂອງທ່ານ', sample_minority_language_text: 'Picko your baan' },
  'lookup.village_placeholder': { lao_text: '-- ເລືອກບ້ານ --', sample_minority_language_text: '-- Picko baan --' },
  'lookup.no_results': {
    lao_text: 'ບໍ່ພົບຂໍ້ມູນ. ລອງສະແກນລະຫັດສາທິດ.',
    sample_minority_language_text: 'No datao found. Try scano instead.',
  },
  'lookup.scan_hint': { lao_text: 'ຈຳລອງການສະແກນລະຫັດ QR ສາທິດ', sample_minority_language_text: 'Fako QR scano demo' },
  'stub.coming_soon': { lao_text: 'ໜ້ານີ້ກຳລັງພັດທະນາ', sample_minority_language_text: 'Pageo comingo soon' },
}

type TranslationsContextValue = {
  language: Language
  toggleLanguage: () => void
  t: (key: string) => string
}

const TranslationsContext = createContext<TranslationsContextValue | null>(null)

export function TranslationsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('lo')
  const [rows, setRows] = useState<Record<string, TranslationEntry>>(FALLBACK_TRANSLATIONS)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('translations')
      .select('key, lao_text, sample_minority_language_text')
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return
        setRows((prev) => {
          const next = { ...prev }
          for (const row of data) {
            next[row.key] = {
              lao_text: row.lao_text,
              sample_minority_language_text: row.sample_minority_language_text,
            }
          }
          return next
        })
      })
  }, [])

  function t(key: string): string {
    const entry = rows[key]
    return entry ? (language === 'lo' ? entry.lao_text : entry.sample_minority_language_text) : key
  }

  function toggleLanguage() {
    setLanguage((prev) => (prev === 'lo' ? 'min-demo' : 'lo'))
  }

  return (
    <TranslationsContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </TranslationsContext.Provider>
  )
}

export function useTranslations(): TranslationsContextValue {
  const ctx = useContext(TranslationsContext)
  if (!ctx) throw new Error('useTranslations must be used within a TranslationsProvider')
  return ctx
}
