import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getSyncStatus, formatLastSync } from '../lib/offlineStorage'
import { syncQueuedDisputes } from '../lib/land'
import { useTranslations } from '../lib/translations'

type Status = 'checking' | 'connected' | 'unreachable' | 'not-configured' | 'offline'

export function ConnectionStatus() {
  const { t } = useTranslations()
  const [status, setStatus] = useState<Status>(
    isSupabaseConfigured ? 'checking' : 'not-configured',
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSync, setLastSync] = useState<number | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) {
      setStatus('not-configured')
      return
    }

    // Check online status and sync queued disputes if online
    const checkOnline = async () => {
      try {
        const { error } = await client.auth.getSession()
        const online = !error
        setStatus(online ? 'connected' : 'unreachable')
        
        if (online) {
          // Sync disputes in background when we transition to online
          await syncQueuedDisputes()
        }

        // Update sync status
        const syncStatus = getSyncStatus(online)
        setPendingCount(syncStatus.pendingCount)
        setLastSync(syncStatus.lastSync)
      } catch {
        setStatus('unreachable')
        const syncStatus = getSyncStatus(false)
        setPendingCount(syncStatus.pendingCount)
        setLastSync(syncStatus.lastSync)
      }
    }

    checkOnline()
    
    // Listen for online/offline events
    const handleOnline = () => checkOnline()
    const handleOffline = () => {
      setStatus('offline')
      const syncStatus = getSyncStatus(false)
      setPendingCount(syncStatus.pendingCount)
      setLastSync(syncStatus.lastSync)
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Periodic check every 30 seconds
    const interval = setInterval(checkOnline, 30000)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const label = {
    checking: t('status.pending') + '...',
    connected: 'Online',
    unreachable: t('dispute.submit_error'),
    'not-configured': 'Not configured',
    offline: 'Offline',
  }[status]

  const dotColor = {
    checking: 'bg-gray-400 animate-pulse',
    connected: 'bg-green-500',
    unreachable: 'bg-red-500',
    'not-configured': 'bg-gray-400',
    offline: 'bg-amber-500',
  }[status]

  const showPending = pendingCount > 0
  const showLastSync = lastSync !== null

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
      
      {showLastSync && (
        <span className="text-xs text-gray-400">·</span>
      )}
      {showLastSync && (
        <span className="text-xs text-gray-500">{t('lastsynced.label')}: {formatLastSync(lastSync)}</span>
      )}
      
      {showPending && (
        <span className="text-xs text-gray-400">·</span>
      )}
      {showPending && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {pendingCount} pending sync
        </span>
      )}
    </div>
  )
}
