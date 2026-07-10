import { supabase } from './supabaseClient'

export type ParcelStatus = 'registered' | 'pending' | 'disputed'
export type ZoneType = 'forest' | 'agricultural' | 'residential' | 'disputed'

export type Village = {
  id: string
  name: string
  province: string
}

export type Parcel = {
  id: string
  village_id: string
  demo_village_name: string
  status: ParcelStatus
  zone_type: ZoneType
  geo_coords: { lat: number; lng: number }
}

const PARCEL_COLUMNS = 'id, village_id, demo_village_name, status, zone_type, geo_coords'

// Fixed so the "simulated scan" always returns the same demo result.
const DEMO_SCAN_PARCEL_ID = 'DEMO-PARCEL-0005'

export async function fetchVillages(): Promise<Village[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('villages').select('id, name, province').order('name')
  if (error || !data) return []
  return data
}

export async function fetchParcelsByVillage(villageId: string): Promise<Parcel[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('parcels')
    .select(PARCEL_COLUMNS)
    .eq('village_id', villageId)
    .order('id')
  if (error || !data) return []
  return data as Parcel[]
}

export async function fetchDemoScanParcel(): Promise<Parcel | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('parcels')
    .select(PARCEL_COLUMNS)
    .eq('id', DEMO_SCAN_PARCEL_ID)
    .single()
  if (error || !data) return null
  return data as Parcel
}

export async function fetchAllParcels(): Promise<Parcel[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('parcels').select(PARCEL_COLUMNS).order('id')
  if (error || !data) return []
  return data as Parcel[]
}

export type DisputeCategory = 'boundary' | 'wrong_info' | 'ownership' | 'other'

// Plain-English labels folded into the disputes.description column, since
// the M1 schema has no separate category field. The field-officer view
// (M6) is allowed more technical language, so this is fine to read raw.
const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  boundary: 'Boundary problem',
  wrong_info: 'Wrong information shown',
  ownership: 'Ownership question',
  other: 'Other concern',
}

// No auth/real identity in this prototype (see M0 guardrails), so every
// submission is attributed to a fixed demo citizen rather than a real name.
const DEMO_SUBMITTER = 'demo-citizen'

export async function createDispute(input: {
  parcelId: string
  category: DisputeCategory
  note: string
}): Promise<{ fakeReferenceNumber: string } | null> {
  if (!supabase) return null
  const description = [DISPUTE_CATEGORY_LABELS[input.category], input.note.trim()].filter(Boolean).join(' — ')
  const { data, error } = await supabase
    .from('disputes')
    .insert({ parcel_id: input.parcelId, submitted_by: DEMO_SUBMITTER, description })
    .select('fake_reference_number')
    .single()
  if (error || !data) return null
  return { fakeReferenceNumber: data.fake_reference_number as string }
}

// M6 field-officer dashboard. Display-only — there is no RLS update policy
// on `disputes` for the anon key, so this stays a read-only queue view
// rather than a case-management tool (matches the M6/M7 "demo queue view
// only" guardrail in module_prompts.txt).
export type DisputeStatus = 'submitted' | 'in_review' | 'resolved'

export type Dispute = {
  id: string
  parcel_id: string
  submitted_by: string
  description: string | null
  status: DisputeStatus
  fake_reference_number: string
  created_at: string
  parcel: { demo_village_name: string; village_id: string; zone_type: ZoneType } | null
}

const DISPUTE_COLUMNS =
  'id, parcel_id, submitted_by, description, status, fake_reference_number, created_at, parcel:parcels(demo_village_name, village_id, zone_type)'

export async function fetchDisputes(): Promise<Dispute[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('disputes')
    .select(DISPUTE_COLUMNS)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => ({
    ...row,
    parcel: Array.isArray(row.parcel) ? (row.parcel[0] ?? null) : row.parcel,
  })) as Dispute[]
}
