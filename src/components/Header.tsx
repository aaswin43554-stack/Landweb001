import type { Language } from '../lib/translations'
import { useTranslations } from '../lib/translations'
import { BriefcaseIcon, GlobeIcon } from './icons'
import { getLastSync, formatLastSync } from '../lib/offlineStorage'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../lib/auth'

type Props = {
  mode: 'citizen' | 'field-officer' | 'admin'
  onSelectMode: (mode: 'citizen' | 'field-officer' | 'admin') => void
  onTriggerP2PSync: () => void
  highContrast: boolean
  onToggleHighContrast: () => void
  iconOnlyNav: boolean
  onToggleIconOnlyNav: () => void
}

const LANGUAGE_LABELS: Record<Language, string> = {
  lo: 'ພາສາລາວ (Lao)',
  en: 'English',
  hm: 'Hmong (Mông)',
  km: 'Khmu (Kmhmu)',
}

function AccessibilityIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
      <path d="M6 9h12" />
      <path d="M12 9v6" />
      <path d="M9 20l3-5 3 5" />
    </svg>
  )
}

export function Header({
  mode,
  onSelectMode,
  onTriggerP2PSync,
  highContrast,
  onToggleHighContrast,
  iconOnlyNav,
  onToggleIconOnlyNav,
}: Props) {
  const { t, language, setLanguage } = useTranslations()
  const { user, logout } = useAuth()
  const [lastSync, setLastSync] = useState<string>('')
  const [showA11yMenu, setShowA11yMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function updateSyncTime() {
      const syncTime = await getLastSync()
      setLastSync(syncTime ? formatLastSync(syncTime) : t('lastsynced.value'))
    }
    updateSyncTime()
  }, [t])

  // Close accessibility menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowA11yMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="w-full bg-white border-b border-gray-200 px-4 py-3 relative z-40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-extrabold truncate text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-7 bg-emerald-600 rounded-full inline-block"></span>
            {t('app.title')}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* P2P Sync Trigger Button */}
          <button
            type="button"
            onClick={onTriggerP2PSync}
            className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-full text-xs shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            📶 P2P Sync
          </button>

          {/* User Role Selection Dropdown */}
          <div className="relative flex items-center gap-1 rounded-full border-2 border-gray-300 px-2 py-1 bg-white text-sm font-semibold hover:bg-gray-50">
            <BriefcaseIcon className="w-4 h-4 text-gray-500" />
            <select
              value={mode}
              onChange={(e) => onSelectMode(e.target.value as 'citizen' | 'field-officer' | 'admin')}
              className="appearance-none bg-transparent pr-4 focus:outline-none cursor-pointer text-gray-800 font-bold text-xs"
              aria-label="Select user role"
            >
              <option value="citizen">Citizen</option>
              <option value="field-officer">Officer</option>
              <option value="admin">Chief (Admin)</option>
            </select>
            <span className="text-[9px] text-gray-400 font-bold pointer-events-none pr-1">▼</span>
          </div>

          {/* Direct Language Selection Dropdown */}
          <div className="relative flex items-center gap-1 rounded-full border-2 border-gray-300 px-2 py-1 bg-white text-sm font-semibold hover:bg-gray-50">
            <GlobeIcon className="w-4 h-4 text-gray-500" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="appearance-none bg-transparent pr-4 focus:outline-none cursor-pointer text-gray-800 font-bold text-xs"
              aria-label="Select language"
            >
              {Object.entries(LANGUAGE_LABELS).map(([code]) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-gray-400 font-bold pointer-events-none pr-1">▼</span>
          </div>

          {/* Accessibility Settings Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowA11yMenu(!showA11yMenu)}
              className={`flex items-center justify-center p-1.5 rounded-full border-2 text-sm font-semibold active:bg-gray-100 ${
                showA11yMenu ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 text-gray-700'
              }`}
              aria-label="Accessibility Settings"
              aria-expanded={showA11yMenu}
            >
              <AccessibilityIcon className="w-5 h-5" />
            </button>

            {/* Accessibility Popover Panel */}
            {showA11yMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2 mb-3">
                  Accessibility Options
                </h3>
                
                <div className="flex flex-col gap-4">
                  {/* High Contrast Toggle */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-semibold text-gray-700">High Contrast Mode</span>
                    <input
                      type="checkbox"
                      checked={highContrast}
                      onChange={onToggleHighContrast}
                      className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300 cursor-pointer"
                    />
                  </label>

                  {/* Icon Only Navigation Toggle */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-semibold text-gray-700">Icon-only Navigation</span>
                    <input
                      type="checkbox"
                      checked={iconOnlyNav}
                      onChange={onToggleIconOnlyNav}
                      className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
<<<<<<< HEAD
=======

          {/* User Profile / Logout Pill */}
          {user && (
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 text-xs font-bold text-slate-700">
              <span className="truncate max-w-[80px] sm:max-w-none">👤 {user.username}</span>
              <button
                type="button"
                onClick={logout}
                className="ml-1 text-red-600 hover:underline text-[10px] cursor-pointer"
              >
                Logout
              </button>
            </div>
          )}

          {mode === 'citizen' && user?.role === 'field-officer' && (
            <button
              type="button"
              onClick={onEnterFieldOfficer}
              className="flex items-center gap-1.5 rounded-full border-2 border-gray-300 px-3 py-2 text-sm font-semibold active:bg-gray-100"
            >
              <BriefcaseIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{t('nav.field_officer')}</span>
            </button>
          )}
>>>>>>> f49bd50c6356d5c7f353daf8fbede4347e757aa0
        </div>
      </div>

      <p className="mt-1 text-xs text-gray-400 font-medium">
        {t('lastsynced.label')}: {lastSync}
      </p>
    </header>
  )
}
