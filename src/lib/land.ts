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
