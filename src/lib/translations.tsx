import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabaseClient'

export type Language = 'lo' | 'en' | 'min-demo'

const LANGUAGE_CYCLE: Language[] = ['lo', 'en', 'min-demo']

type TranslationEntry = { lao_text: string; english_text: string; sample_minority_language_text: string }

// Baked-in copy of the M1 seed data (see supabase/seed.sql) so the UI
// renders correctly instantly, before the live fetch resolves, and still
// works if a teammate hasn't configured .env yet.
const FALLBACK_TRANSLATIONS: Record<string, TranslationEntry> = {
  'app.title': { lao_text: 'ຂໍ້ມູນທີ່ດິນ', english_text: 'Land Info', sample_minority_language_text: 'Dinfo Baan' },
  'banner.fictional_notice': {
    lao_text: 'ຕົວຢ່າງ - ຂໍ້ມູນສົມມຸດຕິຖານເທົ່ານັ້ນ',
    english_text: 'Sample - demonstration data only',
    sample_minority_language_text: 'Sampol - demo data bo tae',
  },
  'nav.parcel_lookup': { lao_text: 'ຄົ້ນຫາທີ່ດິນ', english_text: 'Search Land', sample_minority_language_text: 'Hasearch dinlan' },
  'nav.land_use_explainer': {
    lao_text: 'ອະທິບາຍເຂດທີ່ດິນ',
    english_text: 'Land Zone Info',
    sample_minority_language_text: 'Zone-info dinlan',
  },
  'nav.dispute_form': { lao_text: 'ແຈ້ງບັນຫາ', english_text: 'Report Issue', sample_minority_language_text: 'Report panha' },
  'nav.field_officer': {
    lao_text: 'ເຈົ້າໜ້າທີ່ພາກສະໜາມ',
    english_text: 'Field Officer',
    sample_minority_language_text: 'Field officero',
  },
  'nav.back_to_citizen': { lao_text: 'ກັບຄືນ', english_text: 'Back', sample_minority_language_text: 'Backo to citizeno' },
  'status.registered': { lao_text: 'ລົງທະບຽນແລ້ວ', english_text: 'Registered', sample_minority_language_text: 'Registo-don' },
  'status.pending': { lao_text: 'ກຳລັງລໍຖ້າ', english_text: 'Pending', sample_minority_language_text: 'Waito-lang' },
  'status.disputed': { lao_text: 'ມີຂໍ້ຂັດແຍ້ງ', english_text: 'Disputed', sample_minority_language_text: 'Disputo-nay' },
  'zone.forest': { lao_text: 'ປ່າໄມ້', english_text: 'Forest', sample_minority_language_text: 'Foresto-mai' },
  'zone.agricultural': { lao_text: 'ເຂດກະສິກຳ', english_text: 'Agricultural', sample_minority_language_text: 'Farmo-kasi' },
  'zone.residential': { lao_text: 'ເຂດທີ່ຢູ່ອາໄສ', english_text: 'Residential', sample_minority_language_text: 'Homo-asai' },
  'zone.disputed': { lao_text: 'ເຂດຂັດແຍ້ງ', english_text: 'Disputed Zone', sample_minority_language_text: 'Disputo-zone' },
  'search.placeholder': {
    lao_text: 'ພິມຊື່ບ້ານ...',
    english_text: 'Type village name...',
    sample_minority_language_text: 'Type baan nane...',
  },
  'search.button': { lao_text: 'ຄົ້ນຫາ', english_text: 'Search', sample_minority_language_text: 'Searcho' },
  'scan.button': { lao_text: 'ສະແກນລະຫັດສາທິດ', english_text: 'Scan demo code', sample_minority_language_text: 'Scano demo-code' },
  'lastsynced.label': { lao_text: 'ອັບເດດຫຼ້າສຸດ', english_text: 'Last synced', sample_minority_language_text: 'Lasto-sync' },
  'lastsynced.value': { lao_text: '2 ຊົ່ວໂມງກ່ອນ', english_text: '2 hours ago', sample_minority_language_text: '2 hours agongo' },
  'dispute.step_parcel': {
    lao_text: 'ເລືອກທີ່ດິນ/ບ້ານ',
    english_text: 'Select parcel/village',
    sample_minority_language_text: 'Picko parcel',
  },
  'dispute.step_category': {
    lao_text: 'ເລືອກປະເພດບັນຫາ',
    english_text: 'Select issue category',
    sample_minority_language_text: 'Picko category',
  },
  'dispute.submit': { lao_text: 'ຍື່ນສົ່ງ', english_text: 'Submit', sample_minority_language_text: 'Sendo form' },
  'dispute.reference_label': {
    lao_text: 'ເລກອ້າງອີງ',
    english_text: 'Reference number',
    sample_minority_language_text: 'Refo number',
  },
  'lookup.title': { lao_text: 'ກວດສອບສະຖານະທີ່ດິນ', english_text: 'Check land status', sample_minority_language_text: 'Checko land status' },
  'lookup.village_label': {
    lao_text: 'ເລືອກບ້ານຂອງທ່ານ',
    english_text: 'Select your village',
    sample_minority_language_text: 'Picko your baan',
  },
  'lookup.village_placeholder': {
    lao_text: '-- ເລືອກບ້ານ --',
    english_text: '-- Select village --',
    sample_minority_language_text: '-- Picko baan --',
  },
  'lookup.no_results': {
    lao_text: 'ບໍ່ພົບຂໍ້ມູນ. ລອງສະແກນລະຫັດສາທິດ.',
    english_text: 'No results found. Try scanning the demo code instead.',
    sample_minority_language_text: 'No datao found. Try scano instead.',
  },
  'lookup.scan_hint': {
    lao_text: 'ຈຳລອງການສະແກນລະຫັດ QR ສາທິດ',
    english_text: 'Simulate scanning a demo QR code',
    sample_minority_language_text: 'Fako QR scano demo',
  },
  'stub.coming_soon': {
    lao_text: 'ໜ້ານີ້ກຳລັງພັດທະນາ',
    english_text: 'This page is under development',
    sample_minority_language_text: 'Pageo comingo soon',
  },
  'explainer.hint': {
    lao_text: 'ແຕະເຂດສີເພື່ອຮຽນຮູ້ຄວາມໝາຍ',
    english_text: 'Tap a colored area to learn what it means',
    sample_minority_language_text: 'Tapo colored area to learno',
  },
  'explainer.map_caption': {
    lao_text: 'ຮູບແບບປະກອບຄຳອະທິບາຍ - ບໍ່ແມ່ນແຜນທີ່ທີ່ຖືກຕ້ອງ',
    english_text: 'Illustrative layout — not an accurate map',
    sample_minority_language_text: 'Illustro layout - not real mapo',
  },
  'explainer.legend_title': {
    lao_text: 'ປະເພດເຂດ',
    english_text: 'Zone types',
    sample_minority_language_text: 'Zoneo typeso',
  },
  'explainer.panel.village_label': {
    lao_text: 'ບ້ານ',
    english_text: 'Village',
    sample_minority_language_text: 'Baano',
  },
  'explainer.panel.close': {
    lao_text: 'ປິດ',
    english_text: 'Close',
    sample_minority_language_text: 'Closeo',
  },
  'zone_explain.forest': {
    lao_text: 'ເຂດນີ້ຖືກໝາຍເປັນປ່າໄມ້.',
    english_text: 'This area is marked as forest land.',
    sample_minority_language_text: 'This areao is foresto land.',
  },
  'zone_explain.agricultural': {
    lao_text: 'ເຂດນີ້ຖືກໝາຍເປັນທີ່ດິນກະສິກຳ.',
    english_text: 'This area is marked as farmland.',
    sample_minority_language_text: 'This areao is farmo land.',
  },
  'zone_explain.residential': {
    lao_text: 'ເຂດນີ້ຖືກໝາຍເປັນທີ່ດິນສຳລັບທີ່ຢູ່ອາໄສ.',
    english_text: 'This area is marked as land for homes.',
    sample_minority_language_text: 'This areao is homo land.',
  },
  'zone_explain.disputed': {
    lao_text: 'ເຂດນີ້ຖືກໝາຍວ່າມີຂໍ້ຂັດແຍ້ງ.',
    english_text: 'This area is marked as land under disagreement.',
    sample_minority_language_text: 'This areao has disagreemento.',
  },
  'dispute.step3_title': {
    lao_text: 'ເພີ່ມລາຍລະອຽດ (ບໍ່ບັງຄັບ)',
    english_text: 'Add more detail (optional)',
    sample_minority_language_text: 'Addo detailo (optionalo)',
  },
  'dispute.step3_placeholder': {
    lao_text: 'ພິມລາຍລະອຽດເພີ່ມເຕີມທີ່ນີ້ (ບໍ່ບັງຄັບ)',
    english_text: 'Type any extra detail here (optional)',
    sample_minority_language_text: 'Typeo detailo here (optionalo)',
  },
  'dispute.step4_title': {
    lao_text: 'ກວດສອບ ແລະ ຍື່ນສົ່ງ',
    english_text: 'Review and submit',
    sample_minority_language_text: 'Reviewo and sendo',
  },
  'dispute.parcel_label': {
    lao_text: 'ເລືອກທີ່ດິນ',
    english_text: 'Pick the parcel',
    sample_minority_language_text: 'Picko the landplot',
  },
  'dispute.no_parcels': {
    lao_text: 'ບໍ່ພົບທີ່ດິນສຳລັບບ້ານນີ້.',
    english_text: 'No parcels found for this village.',
    sample_minority_language_text: 'No landplot foundo for this baano.',
  },
  'dispute.back': {
    lao_text: 'ກັບຄືນ',
    english_text: 'Back',
    sample_minority_language_text: 'Backo',
  },
  'dispute.next': {
    lao_text: 'ຕໍ່ໄປ',
    english_text: 'Next',
    sample_minority_language_text: 'Nexto',
  },
  'dispute.category.boundary': {
    lao_text: 'ບັນຫາຂອບເຂດທີ່ດິນ',
    english_text: 'Boundary problem',
    sample_minority_language_text: 'Boundaryo problemo',
  },
  'dispute.category.wrong_info': {
    lao_text: 'ຂໍ້ມູນທີ່ສະແດງບໍ່ຖືກຕ້ອງ',
    english_text: 'Wrong information shown',
    sample_minority_language_text: 'Wrongo infoo shown',
  },
  'dispute.category.ownership': {
    lao_text: 'ໃຜເປັນເຈົ້າຂອງທີ່ດິນນີ້',
    english_text: 'Who owns this land',
    sample_minority_language_text: 'Whoo owno this land',
  },
  'dispute.category.other': {
    lao_text: 'ບັນຫາອື່ນໆ',
    english_text: 'Something else',
    sample_minority_language_text: 'Somethingo elseo',
  },
  'dispute.note_label': {
    lao_text: 'ລາຍລະອຽດເພີ່ມເຕີມ (ບໍ່ບັງຄັບ)',
    english_text: 'Extra detail (optional)',
    sample_minority_language_text: 'Extrao detailo (optionalo)',
  },
  'dispute.review_village': {
    lao_text: 'ບ້ານ',
    english_text: 'Village',
    sample_minority_language_text: 'Baano',
  },
  'dispute.review_parcel': {
    lao_text: 'ທີ່ດິນ',
    english_text: 'Parcel',
    sample_minority_language_text: 'Landploto',
  },
  'dispute.review_category': {
    lao_text: 'ບັນຫາ',
    english_text: 'Issue',
    sample_minority_language_text: 'Issueo',
  },
  'dispute.review_note': {
    lao_text: 'ລາຍລະອຽດ',
    english_text: 'Detail',
    sample_minority_language_text: 'Detailo',
  },
  'dispute.review_note_empty': {
    lao_text: 'ບໍ່ໄດ້ເພີ່ມ',
    english_text: 'None added',
    sample_minority_language_text: 'Noneo addedo',
  },
  'dispute.submit_error': {
    lao_text: 'ມີຂໍ້ຜິດພາດ. ກະລຸນາລອງໃໝ່.',
    english_text: 'Something went wrong. Please try again.',
    sample_minority_language_text: 'Somethingo wrongo. Try againo.',
  },
  'dispute.confirmation_title': {
    lao_text: 'ຍື່ນສົ່ງແລ້ວ',
    english_text: 'Submitted',
    sample_minority_language_text: 'Submittedo',
  },
  'dispute.confirmation_body': {
    lao_text: 'ບັນທຶກຄວາມກັງວົນຂອງທ່ານແລ້ວ.',
    english_text: 'Your concern has been recorded.',
    sample_minority_language_text: 'Your concerno is recordedo.',
  },
  'dispute.confirmation_disclaimer': {
    lao_text: 'ນີ້ແມ່ນຕົວຢ່າງສາທິດເທົ່ານັ້ນ. ມັນບໍ່ໄດ້ສົ່ງຄວາມກັງວົນຂອງທ່ານໄປຫາຫ້ອງການທີ່ດິນ ຫຼື ອົງການໃດໆທີ່ແທ້ຈິງ.',
    english_text: 'This is a prototype demo. It does not send your concern to any real land office or authority.',
    sample_minority_language_text: 'This is demoo only. It bo sendo to any realo officeo.',
  },
  'dispute.confirmation_new': {
    lao_text: 'ຍື່ນສົ່ງອີກ',
    english_text: 'Submit another',
    sample_minority_language_text: 'Sendo anothero',
  },
  'audio.play_button': {
    lao_text: 'ຫຼິ້ນຄຳອະທິບາຍ',
    english_text: 'Play explanation',
    sample_minority_language_text: 'Playo explanationo',
  },
  'audio.coming_soon_badge': {
    lao_text: 'ແນວຄິດອະນາຄົດ - ຍັງໃຊ້ບໍ່ໄດ້',
    english_text: 'Future idea — not yet functional',
    sample_minority_language_text: 'Futuro ideao - not yeto workingo',
  },
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
      .select('key, lao_text, english_text, sample_minority_language_text')
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return
        setRows((prev) => {
          const next = { ...prev }
          for (const row of data) {
            next[row.key] = {
              lao_text: row.lao_text,
              english_text: row.english_text,
              sample_minority_language_text: row.sample_minority_language_text,
            }
          }
          return next
        })
      })
  }, [])

  function t(key: string): string {
    const entry = rows[key]
    if (!entry) return key
    if (language === 'lo') return entry.lao_text
    if (language === 'en') return entry.english_text
    return entry.sample_minority_language_text
  }

  function toggleLanguage() {
    setLanguage((prev) => LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(prev) + 1) % LANGUAGE_CYCLE.length])
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
