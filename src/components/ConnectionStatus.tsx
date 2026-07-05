import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

type Status = 'checking' | 'connected' | 'unreachable' | 'not-configured'

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>(
    isSupabaseConfigured ? 'checking' : 'not-configured',
  )

  useEffect(() => {
    if (!supabase) return
    supabase.auth
      .getSession()
      .then(({ error }) => setStatus(error ? 'unreachable' : 'connected'))
      .catch(() => setStatus('unreachable'))
  }, [])

  const label = {
    checking: 'Checking Supabase connection…',
    connected: 'Supabase: connected',
    unreachable: 'Supabase: unreachable',
    'not-configured': 'Supabase: not configured yet',
  }[status]

  const dotColor = {
    checking: 'bg-gray-400',
    connected: 'bg-green-500',
    unreachable: 'bg-red-500',
    'not-configured': 'bg-gray-400',
  }[status]

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
      {label}
    </div>
  )
}
