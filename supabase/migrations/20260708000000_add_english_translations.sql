-- Add English as a first-class language column alongside Lao and the
-- placeholder minority-demo language. English is a baseline reference
-- language for this prototype, not just Lao + one demo minority language.
alter table translations add column if not exists english_text text;

update translations t set english_text = v.english_text
from (values
  ('app.title', 'Land Info'),
  ('banner.fictional_notice', 'Sample - demonstration data only'),
  ('nav.parcel_lookup', 'Search Land'),
  ('nav.land_use_explainer', 'Land Zone Info'),
  ('nav.dispute_form', 'Report Issue'),
  ('nav.field_officer', 'Field Officer'),
  ('nav.back_to_citizen', 'Back'),
  ('status.registered', 'Registered'),
  ('status.pending', 'Pending'),
  ('status.disputed', 'Disputed'),
  ('zone.forest', 'Forest'),
  ('zone.agricultural', 'Agricultural'),
  ('zone.residential', 'Residential'),
  ('zone.disputed', 'Disputed Zone'),
  ('search.placeholder', 'Type village name...'),
  ('search.button', 'Search'),
  ('scan.button', 'Scan demo code'),
  ('lastsynced.label', 'Last synced'),
  ('lastsynced.value', '2 hours ago'),
  ('dispute.step_parcel', 'Select parcel/village'),
  ('dispute.step_category', 'Select issue category'),
  ('dispute.submit', 'Submit'),
  ('dispute.reference_label', 'Reference number'),
  ('lookup.title', 'Check land status'),
  ('lookup.village_label', 'Select your village'),
  ('lookup.village_placeholder', '-- Select village --'),
  ('lookup.no_results', 'No results found. Try scanning the demo code instead.'),
  ('lookup.scan_hint', 'Simulate scanning a demo QR code'),
  ('stub.coming_soon', 'This page is under development')
) as v(key, english_text)
where t.key = v.key;

alter table translations alter column english_text set not null;
