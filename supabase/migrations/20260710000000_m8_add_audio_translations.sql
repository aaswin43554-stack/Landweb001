-- M8 polish pass: copy for the mocked "play explanation" audio-icon
-- concept button (static, non-functional — see PlayExplanationButton.tsx).
insert into translations (key, lao_text, english_text, sample_minority_language_text) values
  ('audio.play_button', 'ຫຼິ້ນຄຳອະທິບາຍ', 'Play explanation', 'Playo explanationo'),
  ('audio.coming_soon_badge', 'ແນວຄິດອະນາຄົດ - ຍັງໃຊ້ບໍ່ໄດ້', 'Future idea — not yet functional', 'Futuro ideao - not yeto workingo')
on conflict (key) do nothing;
