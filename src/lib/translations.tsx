import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabaseClient'
import { getCachedTranslations, cacheTranslations } from './offlineStorage'

export type Language = 'lo' | 'en' | 'hm' | 'km'

const LANGUAGE_CYCLE: Language[] = ['lo', 'en', 'hm', 'km']

type TranslationEntry = {
  lao_text: string
  english_text: string
  hmong_text: string
  khmu_text: string
}

const FALLBACK_TRANSLATIONS: Record<string, TranslationEntry> = {
  'app.title': {
    lao_text: 'ຂໍ້ມູນທີ່ດິນ',
    english_text: 'Land Info',
    hmong_text: 'Ntaub Ntawv Av',
    khmu_text: 'Khmu Land Info',
  },
  'banner.fictional_notice': {
    lao_text: 'ຕົວຢ່າງ - ຂໍ້ມູນສົມມຸດຕິຖານເທົ່ານັ້ນ',
    english_text: 'Sample - demonstration data only',
    hmong_text: 'Qauv - Kev sim ua xwb',
    khmu_text: 'Sim - data samot nla',
  },
  'nav.parcel_lookup': {
    lao_text: 'ຄົ້ນຫາທີ່ດິນ',
    english_text: 'Search Land',
    hmong_text: 'Nrhiav Av',
    khmu_text: 'Rong Land',
  },
  'nav.land_use_explainer': {
    lao_text: 'ອະທິບາຍເຂດທີ່ດິນ',
    english_text: 'Land Zone Info',
    hmong_text: 'Cheeb Tsam Av',
    khmu_text: 'Zone Land',
  },
  'nav.dispute_form': {
    lao_text: 'ແຈ້ງບັນຫາ',
    english_text: 'Report Issue',
    hmong_text: 'Tshaj Teeb Meem',
    khmu_text: 'Tsen Panha',
  },
  'nav.field_officer': {
    lao_text: 'ເຈົ້າໜ້າທີ່ພາກສະໜາມ',
    english_text: 'Field Officer',
    hmong_text: 'Tub Ceev Xwm',
    khmu_text: 'Field Officer',
  },
  'nav.back_to_citizen': {
    lao_text: 'ກັບຄືນ',
    english_text: 'Back',
    hmong_text: 'Rov Qab',
    khmu_text: 'Rong',
  },
  'status.registered': {
    lao_text: 'ລົງທະບຽນແລ້ວ',
    english_text: 'Registered',
    hmong_text: 'Sau Npe Lawm',
    khmu_text: 'Krap mu',
  },
  'status.pending': {
    lao_text: 'ກຳລັງລໍຖ້າ',
    english_text: 'Pending',
    hmong_text: 'Nyob Huv Kev',
    khmu_text: 'Moy',
  },
  'status.disputed': {
    lao_text: 'ມີຂໍ້ຂັດແຍ້ງ',
    english_text: 'Disputed',
    hmong_text: 'Muaj Teeb Meem',
    khmu_text: 'Disputed',
  },
  'zone.forest': {
    lao_text: 'ປ່າໄມ້',
    english_text: 'Forest',
    hmong_text: 'Hav Zoov',
    khmu_text: 'Klong',
  },
  'zone.agricultural': {
    lao_text: 'ເຂດກະສິກຳ',
    english_text: 'Agricultural',
    hmong_text: 'Ua Liaj Ua Teb',
    khmu_text: 'Agriculture',
  },
  'zone.residential': {
    lao_text: 'ເຂດທີ່ຢູ່ອາໄສ',
    english_text: 'Residential',
    hmong_text: 'Tsev Nyob',
    khmu_text: 'Hom',
  },
  'zone.disputed': {
    lao_text: 'ເຂດຂັດແຍ້ງ',
    english_text: 'Disputed Zone',
    hmong_text: 'Av Teeb Meem',
    khmu_text: 'Disputed Zone',
  },
  'search.placeholder': {
    lao_text: 'ພິມຊື່ບ້ານ...',
    english_text: 'Type village name...',
    hmong_text: 'Sau lub zos...',
    khmu_text: 'Type village...',
  },
  'search.button': {
    lao_text: 'ຄົ້ນຫາ',
    english_text: 'Search',
    hmong_text: 'Nrhiav',
    khmu_text: 'Rong',
  },
  'scan.button': {
    lao_text: 'ສະແກນລະຫັດສາທິດ',
    english_text: 'Scan demo code',
    hmong_text: 'Luam Code',
    khmu_text: 'Scan code',
  },
  'lastsynced.label': {
    lao_text: 'ອັບເດດຫຼ້າສຸດ',
    english_text: 'Last synced',
    hmong_text: 'Synced Lawm',
    khmu_text: 'Last synced',
  },
  'lastsynced.value': {
    lao_text: '2 ຊົ່ວໂມງກ່ອນ',
    english_text: '2 hours ago',
    hmong_text: '2 teev dhau los',
    khmu_text: '2 hr',
  },
  'dispute.step_parcel': {
    lao_text: '\u1eecເລືອກທີ່ດິນ/ບ້ານ',
    english_text: 'Select parcel/village',
    hmong_text: 'Xaiv Av/Zos',
    khmu_text: 'Select parcel',
  },
  'dispute.step_category': {
    lao_text: 'ເລືອກປະເພດບັນຫາ',
    english_text: 'Select issue category',
    hmong_text: 'Xaiv Hom Teeb Meem',
    khmu_text: 'Select category',
  },
  'dispute.submit': {
    lao_text: 'ຍື່ນສົ່ງ',
    english_text: 'Submit',
    hmong_text: 'Xa Mus',
    khmu_text: 'Sendo',
  },
  'dispute.reference_label': {
    lao_text: 'ເລກອ້າງອີງ',
    english_text: 'Reference number',
    hmong_text: 'Tus Nab Npawb',
    khmu_text: 'Ref number',
  },
  'lookup.title': {
    lao_text: 'ກວດສອບສະຖານະທີ່ດິນ',
    english_text: 'Check land status',
    hmong_text: 'Tshawb Av',
    khmu_text: 'Check land',
  },
  'lookup.village_label': {
    lao_text: 'ເລືອກບ້ານຂອງທ່ານ',
    english_text: 'Select your village',
    hmong_text: 'Xaiv Koj Lub Zos',
    khmu_text: 'Select your village',
  },
  'lookup.village_placeholder': {
    lao_text: '-- ເລືອກບ້ານ --',
    english_text: '-- Select village --',
    hmong_text: '-- Xaiv Lub Zos --',
    khmu_text: '-- Select village --',
  },
  'lookup.no_results': {
    lao_text: 'ບໍ່ພົບຂໍ້ມູນ. ລອງສະແກນລະຫັດສາທິດ.',
    english_text: 'No results found. Try scanning the demo code instead.',
    hmong_text: 'Tsis pom av. Sim nrog code.',
    khmu_text: 'No results',
  },
  'lookup.scan_hint': {
    lao_text: 'ຈຳລອງການສະແກນລະຫັດ QR ສາທິດ',
    english_text: 'Simulate scanning a demo QR code',
    hmong_text: 'Sim luam code',
    khmu_text: 'Simulate QR scan',
  },
  'stub.coming_soon': {
    lao_text: 'ໜ້ານີ້ກຳລັງພັດທະນາ',
    english_text: 'This page is under development',
    hmong_text: 'Tab tom ua chaw',
    khmu_text: 'Under dev',
  },
  'explainer.hint': {
    lao_text: 'ແຕະເຂດສີເພື່ອຮຽນຮູ້ຄວາມໝາຍ',
    english_text: 'Tap a colored area to learn what it means',
    hmong_text: 'Kais hauv av kawm ntxiv',
    khmu_text: 'Tap area to learn',
  },
  'explainer.map_caption': {
    lao_text: 'ຮູບແບບປະກອບຄຳອະທິບາຍ - ບໍ່ແມ່ນແຜນທີ່ທີ່ຖືກຕ້ອງ',
    english_text: 'Illustrative layout — not an accurate map',
    hmong_text: 'Daim duab saib xwb',
    khmu_text: 'Illustration only',
  },
  'explainer.legend_title': {
    lao_text: 'ປະເພດເຂດ',
    english_text: 'Zone types',
    hmong_text: 'Cov Hom Av',
    khmu_text: 'Zone types',
  },
  'explainer.panel.village_label': {
    lao_text: 'ບ້ານ',
    english_text: 'Village',
    hmong_text: 'Zos',
    khmu_text: 'Village',
  },
  'explainer.panel.close': {
    lao_text: 'ປິດ',
    english_text: 'Close',
    hmong_text: 'Kaw',
    khmu_text: 'Close',
  },
  'zone_explain.forest': {
    lao_text: 'ເຂດນີ້ຖືກໝາຍເປັນປ່າໄມ້.',
    english_text: 'This area is marked as forest land.',
    hmong_text: 'Cheeb tsam no yog hav zoov av.',
    khmu_text: 'This is forest land.',
  },
  'zone_explain.agricultural': {
    lao_text: 'ເຂດນີ້ຖືກໝາຍເປັນທີ່ດິນກະສິກຳ.',
    english_text: 'This area is marked as farmland.',
    hmong_text: 'Cheeb tsam no yog av ua liaj ua teb.',
    khmu_text: 'This is farmland.',
  },
  'zone_explain.residential': {
    lao_text: 'ເຂດນີ້ຖືກໝາຍເປັນທີ່ດິນສຳລັບທີ່ຢູ່ອາໄສ.',
    english_text: 'This area is marked as land for homes.',
    hmong_text: 'Cheeb tsam no yog av tsev nyob.',
    khmu_text: 'This is home land.',
  },
  'zone_explain.disputed': {
    lao_text: 'ເຂດນີ້ຖືກໝາຍວ່າມີຂໍ້ຂັດແຍ້ງ.',
    english_text: 'This area is marked as land under disagreement.',
    hmong_text: 'Av muaj teeb meem tsis sib haum.',
    khmu_text: 'This land is under dispute.',
  },
  'dispute.step3_title': {
    lao_text: 'ເພີ່ມລາຍລະອຽດ (ບໍ່ບັງຄັບ)',
    english_text: 'Add more detail (optional)',
    hmong_text: 'Ntxiv lwm yam (tsis yuam)',
    khmu_text: 'Add detail (optional)',
  },
  'dispute.step3_placeholder': {
    lao_text: 'ພιມລາຍລະອຽດເພີ່ມເຕີມທີ່ນີ້ (ບໍ່ບັງຄັບ)',
    english_text: 'Type any extra detail here (optional)',
    hmong_text: 'Sau cov ntsiab lus ntawm no',
    khmu_text: 'Type details here',
  },
  'dispute.step4_title': {
    lao_text: 'ກວດສອບ ແລະ ຍື່ນສົ່ງ',
    english_text: 'Review and submit',
    hmong_text: 'Tshawb xyuas thiab xa mus',
    khmu_text: 'Review and submit',
  },
  'dispute.parcel_label': {
    lao_text: 'ເລືອກທີ່ດິນ',
    english_text: 'Pick the parcel',
    hmong_text: 'Xaiv thaj av',
    khmu_text: 'Pick parcel',
  },
  'dispute.no_parcels': {
    lao_text: 'ບໍ່ພົບທີ່ດິນສຳລັບບ້ານນີ້.',
    english_text: 'No parcels found for this village.',
    hmong_text: 'Tsis pom av rau lub zos no.',
    khmu_text: 'No parcels',
  },
  'dispute.back': {
    lao_text: 'ກັບຄືນ',
    english_text: 'Back',
    hmong_text: 'Rov Qab',
    khmu_text: 'Back',
  },
  'dispute.next': {
    lao_text: 'ຕໍ່ໄປ',
    english_text: 'Next',
    hmong_text: 'Ntxiv',
    khmu_text: 'Next',
  },
  'dispute.category.boundary': {
    lao_text: 'ບັນຫາຂອບເຂດທີ່ດິນ',
    english_text: 'Boundary problem',
    hmong_text: 'Teeb meem thaj tsam av',
    khmu_text: 'Boundary problem',
  },
  'dispute.category.wrong_info': {
    lao_text: 'ຂໍ້ມູນທີ່ສະແດງບໍ່ຖືກຕ້ອງ',
    english_text: 'Wrong information shown',
    hmong_text: 'Qhia tsis yog tseeb',
    khmu_text: 'Wrong info',
  },
  'dispute.category.ownership': {
    lao_text: 'ໃຜເປັນເຈົ້າຂອງທີ່ດິນນີ້',
    english_text: 'Who owns this land',
    hmong_text: 'Tus tswv av yog leej twg',
    khmu_text: 'Who owns this land',
  },
  'dispute.category.other': {
    lao_text: 'ບັນຫາອື່ນໆ',
    english_text: 'Something else',
    hmong_text: 'Lwm yam teeb meem',
    khmu_text: 'Other',
  },
  'dispute.note_label': {
    lao_text: 'ລາຍລະອຽດເພີ່ມເຕີມ (ບໍ່ບັງຄັບ)',
    english_text: 'Extra detail (optional)',
    hmong_text: 'Ntsiab lus ntxiv',
    khmu_text: 'Extra detail',
  },
  'dispute.review_village': {
    lao_text: 'ບ້ານ',
    english_text: 'Village',
    hmong_text: 'Zos',
    khmu_text: 'Village',
  },
  'dispute.review_parcel': {
    lao_text: 'ທີ່ດິນ',
    english_text: 'Parcel',
    hmong_text: 'Thaj Av',
    khmu_text: 'Parcel',
  },
  'dispute.review_category': {
    lao_text: 'ບັນຫາ',
    english_text: 'Issue',
    hmong_text: 'Teeb Meem',
    khmu_text: 'Issue',
  },
  'dispute.review_note': {
    lao_text: 'ລາຍລະອຽດ',
    english_text: 'Detail',
    hmong_text: 'Ntsiab Lus',
    khmu_text: 'Detail',
  },
  'dispute.review_note_empty': {
    lao_text: 'ບໍ່ໄດ້ເພີ່ມ',
    english_text: 'None added',
    hmong_text: 'Tsis muaj',
    khmu_text: 'None',
  },
  'dispute.submit_error': {
    lao_text: 'ມີຂໍ້ຜິດພາດ. ກະລຸນາລອງໃໝ່.',
    english_text: 'Something went wrong. Please try again.',
    hmong_text: 'Muaj teeb meem. Sim dua.',
    khmu_text: 'Error, try again',
  },
  'dispute.confirmation_title': {
    lao_text: 'ຍື່ນສົ່ງແລ້ວ',
    english_text: 'Submitted',
    hmong_text: 'Xa Mus Lawm',
    khmu_text: 'Submitted',
  },
  'dispute.confirmation_body': {
    lao_text: 'ບັນທຶກຄວາມກັງວົນຂອງທ່ານແລ້ວ.',
    english_text: 'Your concern has been recorded.',
    hmong_text: 'Koj cov teeb meem khaws tseg lawm.',
    khmu_text: 'Concern recorded',
  },
  'dispute.confirmation_disclaimer': {
    lao_text: 'ນີ້ແມ່ນຕົວຢ່າງສາທິດເທົ່ານັ້ນ. ມັນບໍ່ໄດ້ສົ່ງຄວາມກັງວົນຂອງທ່ານໄປຫາຫ້ອງການທີ່ດິນ ຫຼື ອົງການໃດໆທີ່ແທ້ຈິງ.',
    english_text: 'This is a prototype demo. It does not send your concern to any real land office or authority.',
    hmong_text: 'Qhov no yog qauv sim xwb.',
    khmu_text: 'Demo only',
  },
  'dispute.confirmation_new': {
    lao_text: 'ຍື່ນສົ່ງອີກ',
    english_text: 'Submit another',
    hmong_text: 'Xa dua tshiab',
    khmu_text: 'Submit another',
  },
  'audio.play_button': {
    lao_text: 'ຫຼິ້ນຄຳອະທິບາຍ',
    english_text: 'Play explanation',
    hmong_text: 'Mloog lus piav',
    khmu_text: 'Play explanation',
  },
  'audio.coming_soon_badge': {
    lao_text: 'ແນວຄິດອະນາຄົດ - ຍັງໃຊ້ບໍ່ໄດ້',
    english_text: 'Future idea — not yet functional',
    hmong_text: 'Mloog tau sai sai no',
    khmu_text: 'Coming soon',
  },
  'dispute.keep_reference': {
    lao_text: 'ເກັບເລກນີ້ໄວ້. ໃຊ້ມັນຢູ່ໜ້າ "ຕິດຕາມເລື່ອງ" ເພື່ອເບິ່ງຄວາມຄືບໜ້າ.',
    english_text: 'Keep this number. Use it on the “My Case” tab to see what happens next.',
    hmong_text: 'Khaws tus lej no cia.',
    khmu_text: 'Keep this number',
  },
  'officer.status.submitted': {
    lao_text: 'ຍື່ນສົ່ງແລ້ວ',
    english_text: 'Submitted',
    hmong_text: 'Xa Mus Lawm',
    khmu_text: 'Submitted',
  },
  'officer.status.in_review': {
    lao_text: 'ກຳລັງກວດສອບ',
    english_text: 'Being looked at',
    hmong_text: 'Tab tom saib',
    khmu_text: 'Being looked at',
  },
  'officer.status.resolved': {
    lao_text: 'ແກ້ໄຂແລ້ວ',
    english_text: 'Resolved',
    hmong_text: 'Daws tau lawm',
    khmu_text: 'Resolved',
  },
  'nav.case_status': {
    lao_text: 'ຕິດຕາມເລື່ອງ',
    english_text: 'My Case',
    hmong_text: 'Kuv Rooj Plaub',
    khmu_text: 'My Case',
  },
  'case.title': {
    lao_text: 'ຕິດຕາມເລື່ອງຂອງທ່ານ',
    english_text: 'Check your case',
    hmong_text: 'Xyuas koj rooj plaub',
    khmu_text: 'Check your case',
  },
  'case.intro': {
    lao_text: 'ພິມເລກອ້າງອີງທີ່ທ່ານໄດ້ຮັບຕອນຍື່ນສົ່ງ.',
    english_text: 'Type the reference number you were given when you submitted.',
    hmong_text: 'Sau tus lej koj tau txais thaum xa.',
    khmu_text: 'Type your reference number',
  },
  'case.input_label': {
    lao_text: 'ເລກອ້າງອີງ',
    english_text: 'Reference number',
    hmong_text: 'Tus lej',
    khmu_text: 'Reference number',
  },
  'case.search': {
    lao_text: 'ຄົ້ນຫາ',
    english_text: 'Find my case',
    hmong_text: 'Nrhiav',
    khmu_text: 'Find my case',
  },
  'case.scan': {
    lao_text: 'ສະແກນລະຫັດ',
    english_text: 'Scan code',
    hmong_text: 'Luam tus lej',
    khmu_text: 'Scan code',
  },
  'case.not_found': {
    lao_text: 'ບໍ່ພົບເລື່ອງນີ້. ກະລຸນາກວດເລກອ້າງອີງອີກຄັ້ງ.',
    english_text: 'No case found with that number. Please check it and try again.',
    hmong_text: 'Tsis pom. Sim dua.',
    khmu_text: 'Case not found',
  },
  'case.timeline_title': {
    lao_text: 'ຄວາມຄືບໜ້າ',
    english_text: 'Progress',
    hmong_text: 'Kev nce qib',
    khmu_text: 'Progress',
  },
  'case.your_report': {
    lao_text: 'ສິ່ງທີ່ທ່ານແຈ້ງ',
    english_text: 'What you reported',
    hmong_text: 'Koj qhia dab tsi',
    khmu_text: 'What you reported',
  },
  'case.your_evidence': {
    lao_text: 'ຫຼັກຖານຂອງທ່ານ',
    english_text: 'Your evidence',
    hmong_text: 'Koj cov pov thawj',
    khmu_text: 'Your evidence',
  },
  'case.officer_remark': {
    lao_text: 'ຄຳຕອບຈາກເຈົ້າໜ້າທີ່',
    english_text: 'Officer reply',
    hmong_text: 'Tub ceev xwm teb',
    khmu_text: 'Officer reply',
  },
  'case.awaiting': {
    lao_text: 'ຍັງບໍ່ທັນມີການປ່ຽນແປງ. ເລື່ອງຂອງທ່ານກຳລັງລໍຖ້າກວດສອບ.',
    english_text: 'No update yet. Your case is waiting to be reviewed.',
    hmong_text: 'Tseem tsis tau muaj xov xwm.',
    khmu_text: 'No update yet',
  },
  'case.offline_notice': {
    lao_text: 'ເລື່ອງນີ້ຍັງເກັບຢູ່ໃນເຄື່ອງນີ້ ແລະ ຈະສົ່ງເມື່ອມີສັນຍານ.',
    english_text: 'This case is still stored on this phone and will be sent when you have a connection.',
    hmong_text: 'Tseem nyob hauv lub xov tooj no.',
    khmu_text: 'Saved on this phone',
  },
  'lookup.scan_not_found': {
    lao_text: 'ບໍ່ພົບທີ່ດິນສຳລັບລະຫັດນີ້.',
    english_text: 'No land parcel matches that code.',
    hmong_text: 'Tsis pom thaj av rau tus lej no.',
    khmu_text: 'No parcel for that code',
  },
  'lookup.show_code': {
    lao_text: 'ສະແດງລະຫັດ QR ຂອງທີ່ດິນນີ້',
    english_text: 'Show this parcel’s QR code',
    hmong_text: 'Qhia tus lej QR',
    khmu_text: 'Show QR code',
  },
  'lookup.hide_code': {
    lao_text: 'ເຊື່ອງລະຫັດ QR',
    english_text: 'Hide QR code',
    hmong_text: 'Zais tus lej QR',
    khmu_text: 'Hide QR code',
  },
  'lookup.show_code_hint': {
    lao_text: 'ຕົວຢ່າງ: ລະຫັດແບບນີ້ອາດຕິດຢູ່ໜ້າດິນ ຫຼື ໃນເອກະສານ.',
    english_text: 'Example only: a code like this could be posted on a notice board or printed on a document.',
    hmong_text: 'Piv txwv xwb.',
    khmu_text: 'Example only',
  },
}

type TranslationsContextValue = {
  language: Language
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  t: (key: string) => string
}

const TranslationsContext = createContext<TranslationsContextValue | null>(null)

const PREFERRED_LANG_KEY = 'giz-preferred-language'

export function TranslationsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(PREFERRED_LANG_KEY) as Language
      if (saved && ['lo', 'en', 'hm', 'km'].includes(saved)) {
        return saved
      }
    } catch {
      // Ignore storage errors, fallback to default Lao
    }
    return 'lo'
  })
  
  const [rows, setRows] = useState<Record<string, TranslationEntry>>(FALLBACK_TRANSLATIONS)

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(PREFERRED_LANG_KEY, lang)
    } catch (err) {
      console.warn('Failed to persist preferred language choice:', err)
    }
  }

  useEffect(() => {
    async function loadCached() {
      const cached = await getCachedTranslations()
      if (Object.keys(cached).length > 0) {
        setRows((prev) => ({ ...prev, ...cached }))
      }
    }
    loadCached()
  }, [])

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
              lao_text: row.lao_text || '',
              english_text: row.english_text || '',
              hmong_text: row.sample_minority_language_text || '',
              khmu_text: row.sample_minority_language_text || '',
            }
          }
          cacheTranslations(next)
          return next
        })
      })
  }, [])

  function t(key: string): string {
    const entry = rows[key]
    if (!entry) return key
    if (language === 'lo') return entry.lao_text
    if (language === 'en') return entry.english_text
    if (language === 'hm') return entry.hmong_text
    return entry.khmu_text
  }

  function toggleLanguage() {
    const nextLang = LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length]
    setLanguage(nextLang)
  }

  return (
    <TranslationsContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </TranslationsContext.Provider>
  )
}

export function useTranslations(): TranslationsContextValue {
  const ctx = useContext(TranslationsContext)
  if (!ctx) throw new Error('useTranslations must be used within a TranslationsProvider')
  return ctx
}
