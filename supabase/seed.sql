-- M1 seed data for the GIZ Land Use Transparency Prototype.
-- 100% fictional: invented village/parcel names, invented provinces,
-- and coordinates that are not derived from any real cadastral source.
-- Run after 20260707000000_create_core_tables.sql, e.g. via the
-- Supabase SQL editor or `supabase db push` once a project is linked.

insert into villages (id, name, province, languages_supported) values
  ('DEMO-VLG-001', 'Ban Namdeng', 'Xok Champa', ARRAY['lo', 'min-demo']),
  ('DEMO-VLG-002', 'Ban Silimone', 'Houa Sili', ARRAY['lo', 'min-demo']),
  ('DEMO-VLG-003', 'Ban Vilaysook', 'Dok Champa', ARRAY['lo']),
  ('DEMO-VLG-004', 'Ban Thongdee', 'Pha Xanam', ARRAY['lo', 'min-demo'])
on conflict (id) do nothing;

insert into parcels (id, village_id, demo_village_name, status, zone_type, geo_coords) values
  ('DEMO-PARCEL-0001', 'DEMO-VLG-001', 'Ban Namdeng', 'registered', 'agricultural', '{"lat": 19.9000, "lng": 102.6000}'::jsonb),
  ('DEMO-PARCEL-0002', 'DEMO-VLG-002', 'Ban Silimone', 'registered', 'forest', '{"lat": 18.4000, "lng": 104.1000}'::jsonb),
  ('DEMO-PARCEL-0003', 'DEMO-VLG-003', 'Ban Vilaysook', 'pending', 'residential', '{"lat": 15.2000, "lng": 105.8000}'::jsonb),
  ('DEMO-PARCEL-0004', 'DEMO-VLG-004', 'Ban Thongdee', 'registered', 'agricultural', '{"lat": 20.7000, "lng": 101.9000}'::jsonb),
  ('DEMO-PARCEL-0005', 'DEMO-VLG-001', 'Ban Namdeng', 'disputed', 'forest', '{"lat": 19.9110, "lng": 102.6130}'::jsonb),
  ('DEMO-PARCEL-0006', 'DEMO-VLG-002', 'Ban Silimone', 'pending', 'disputed', '{"lat": 18.4110, "lng": 104.1130}'::jsonb),
  ('DEMO-PARCEL-0007', 'DEMO-VLG-003', 'Ban Vilaysook', 'registered', 'residential', '{"lat": 15.2110, "lng": 105.8130}'::jsonb),
  ('DEMO-PARCEL-0008', 'DEMO-VLG-004', 'Ban Thongdee', 'registered', 'agricultural', '{"lat": 20.7110, "lng": 101.9130}'::jsonb),
  ('DEMO-PARCEL-0009', 'DEMO-VLG-001', 'Ban Namdeng', 'registered', 'agricultural', '{"lat": 19.9220, "lng": 102.6260}'::jsonb),
  ('DEMO-PARCEL-0010', 'DEMO-VLG-002', 'Ban Silimone', 'pending', 'forest', '{"lat": 18.4220, "lng": 104.1260}'::jsonb),
  ('DEMO-PARCEL-0011', 'DEMO-VLG-003', 'Ban Vilaysook', 'registered', 'residential', '{"lat": 15.2220, "lng": 105.8260}'::jsonb),
  ('DEMO-PARCEL-0012', 'DEMO-VLG-004', 'Ban Thongdee', 'disputed', 'agricultural', '{"lat": 20.7220, "lng": 101.9260}'::jsonb),
  ('DEMO-PARCEL-0013', 'DEMO-VLG-001', 'Ban Namdeng', 'pending', 'forest', '{"lat": 19.9330, "lng": 102.6390}'::jsonb),
  ('DEMO-PARCEL-0014', 'DEMO-VLG-002', 'Ban Silimone', 'registered', 'disputed', '{"lat": 18.4330, "lng": 104.1390}'::jsonb),
  ('DEMO-PARCEL-0015', 'DEMO-VLG-003', 'Ban Vilaysook', 'registered', 'residential', '{"lat": 15.2330, "lng": 105.8390}'::jsonb),
  ('DEMO-PARCEL-0016', 'DEMO-VLG-004', 'Ban Thongdee', 'registered', 'agricultural', '{"lat": 20.7330, "lng": 101.9390}'::jsonb),
  ('DEMO-PARCEL-0017', 'DEMO-VLG-001', 'Ban Namdeng', 'pending', 'agricultural', '{"lat": 19.9440, "lng": 102.6520}'::jsonb),
  ('DEMO-PARCEL-0018', 'DEMO-VLG-002', 'Ban Silimone', 'registered', 'forest', '{"lat": 18.4440, "lng": 104.1520}'::jsonb),
  ('DEMO-PARCEL-0019', 'DEMO-VLG-003', 'Ban Vilaysook', 'disputed', 'residential', '{"lat": 15.2440, "lng": 105.8520}'::jsonb),
  ('DEMO-PARCEL-0020', 'DEMO-VLG-004', 'Ban Thongdee', 'pending', 'agricultural', '{"lat": 20.7440, "lng": 101.9520}'::jsonb),
  ('DEMO-PARCEL-0021', 'DEMO-VLG-001', 'Ban Namdeng', 'registered', 'forest', '{"lat": 19.9550, "lng": 102.6650}'::jsonb),
  ('DEMO-PARCEL-0022', 'DEMO-VLG-002', 'Ban Silimone', 'registered', 'disputed', '{"lat": 18.4550, "lng": 104.1650}'::jsonb),
  ('DEMO-PARCEL-0023', 'DEMO-VLG-003', 'Ban Vilaysook', 'registered', 'residential', '{"lat": 15.2550, "lng": 105.8650}'::jsonb),
  ('DEMO-PARCEL-0024', 'DEMO-VLG-004', 'Ban Thongdee', 'pending', 'agricultural', '{"lat": 20.7550, "lng": 101.9650}'::jsonb),
  ('DEMO-PARCEL-0025', 'DEMO-VLG-001', 'Ban Namdeng', 'registered', 'agricultural', '{"lat": 19.9660, "lng": 102.6780}'::jsonb),
  ('DEMO-PARCEL-0026', 'DEMO-VLG-002', 'Ban Silimone', 'disputed', 'forest', '{"lat": 18.4660, "lng": 104.1780}'::jsonb),
  ('DEMO-PARCEL-0027', 'DEMO-VLG-003', 'Ban Vilaysook', 'pending', 'residential', '{"lat": 15.2660, "lng": 105.8780}'::jsonb),
  ('DEMO-PARCEL-0028', 'DEMO-VLG-004', 'Ban Thongdee', 'registered', 'agricultural', '{"lat": 20.7660, "lng": 101.9780}'::jsonb)
on conflict (id) do nothing;

-- Core UI strings. Lao text and the placeholder minority-language text
-- are both approximate/demo-quality — production translation review is
-- out of scope for this prototype (see module_prompts.txt, M1).
-- 'min-demo' is an invented placeholder language, not a real minority
-- language, so no specific language/community's script is misrepresented.
-- English is included as a baseline reference language alongside Lao.
insert into translations (key, lao_text, english_text, sample_minority_language_text) values
  ('app.title', 'ຂໍ້ມູນທີ່ດິນ', 'Land Info', 'Dinfo Baan'),
  ('banner.fictional_notice', 'ຕົວຢ່າງ - ຂໍ້ມູນສົມມຸດຕິຖານເທົ່ານັ້ນ', 'Sample - demonstration data only', 'Sampol - demo data bo tae'),
  ('nav.parcel_lookup', 'ຄົ້ນຫາທີ່ດິນ', 'Search Land', 'Hasearch dinlan'),
  ('nav.land_use_explainer', 'ອະທິບາຍເຂດທີ່ດິນ', 'Land Zone Info', 'Zone-info dinlan'),
  ('nav.dispute_form', 'ແຈ້ງບັນຫາ', 'Report Issue', 'Report panha'),
  ('nav.field_officer', 'ເຈົ້າໜ້າທີ່ພາກສະໜາມ', 'Field Officer', 'Field officero'),
  ('status.registered', 'ລົງທະບຽນແລ້ວ', 'Registered', 'Registo-don'),
  ('status.pending', 'ກຳລັງລໍຖ້າ', 'Pending', 'Waito-lang'),
  ('status.disputed', 'ມີຂໍ້ຂັດແຍ້ງ', 'Disputed', 'Disputo-nay'),
  ('zone.forest', 'ປ່າໄມ້', 'Forest', 'Foresto-mai'),
  ('zone.agricultural', 'ເຂດກະສິກຳ', 'Agricultural', 'Farmo-kasi'),
  ('zone.residential', 'ເຂດທີ່ຢູ່ອາໄສ', 'Residential', 'Homo-asai'),
  ('zone.disputed', 'ເຂດຂັດແຍ້ງ', 'Disputed Zone', 'Disputo-zone'),
  ('search.placeholder', 'ພິມຊື່ບ້ານ...', 'Type village name...', 'Type baan nane...'),
  ('search.button', 'ຄົ້ນຫາ', 'Search', 'Searcho'),
  ('scan.button', 'ສະແກນລະຫັດສາທິດ', 'Scan demo code', 'Scano demo-code'),
  ('lastsynced.label', 'ອັບເດດຫຼ້າສຸດ', 'Last synced', 'Lasto-sync'),
  ('dispute.step_parcel', 'ເລືອກທີ່ດິນ/ບ້ານ', 'Select parcel/village', 'Picko parcel'),
  ('dispute.step_category', 'ເລືອກປະເພດບັນຫາ', 'Select issue category', 'Picko category'),
  ('dispute.submit', 'ຍື່ນສົ່ງ', 'Submit', 'Sendo form'),
  ('dispute.reference_label', 'ເລກອ້າງອີງ', 'Reference number', 'Refo number')
on conflict (key) do nothing;

-- M2/M3 additions: nav shell, language toggle chrome, and parcel lookup
-- screen copy. Same demo-quality disclaimer as above applies.
insert into translations (key, lao_text, english_text, sample_minority_language_text) values
  ('nav.back_to_citizen', 'ກັບຄືນ', 'Back', 'Backo to citizeno'),
  ('lastsynced.value', '2 ຊົ່ວໂມງກ່ອນ', '2 hours ago', '2 hours agongo'),
  ('lookup.title', 'ກວດສອບສະຖານະທີ່ດິນ', 'Check land status', 'Checko land status'),
  ('lookup.village_label', 'ເລືອກບ້ານຂອງທ່ານ', 'Select your village', 'Picko your baan'),
  ('lookup.village_placeholder', '-- ເລືອກບ້ານ --', '-- Select village --', '-- Picko baan --'),
  ('lookup.no_results', 'ບໍ່ພົບຂໍ້ມູນ. ລອງສະແກນລະຫັດສາທິດ.', 'No results found. Try scanning the demo code instead.', 'No datao found. Try scano instead.'),
  ('lookup.scan_hint', 'ຈຳລອງການສະແກນລະຫັດ QR ສາທິດ', 'Simulate scanning a demo QR code', 'Fako QR scano demo'),
  ('stub.coming_soon', 'ໜ້ານີ້ກຳລັງພັດທະນາ', 'This page is under development', 'Pageo comingo soon')
on conflict (key) do nothing;
