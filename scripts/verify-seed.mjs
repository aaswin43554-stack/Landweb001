// Sanity check for M1 seed data. Run after applying the migration + seed
// SQL to a real Supabase project and filling in .env:
//   npm run db:verify
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'

function loadDotEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^([\w.-]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}
loadDotEnv()

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

const tables = ['villages', 'parcels', 'translations', 'disputes']
let ok = true

for (const table of tables) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) {
    console.error(`${table}: ERROR — ${error.message}`)
    ok = false
    continue
  }
  console.log(`${table}: ${count} rows`)
}

const { data: badIds } = await supabase
  .from('parcels')
  .select('id')
  .not('id', 'like', 'DEMO-%')

if (badIds && badIds.length > 0) {
  console.error(`Found ${badIds.length} parcel id(s) without the DEMO- prefix`)
  ok = false
}

process.exit(ok ? 0 : 1)
