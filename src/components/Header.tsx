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
  darkMode: boolean
  onToggleDarkMode: () => void
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
  highContrast: _highContrast,
  onToggleHighContrast: _onToggleHighContrast,
  iconOnlyNav,
  onToggleIconOnlyNav,
  darkMode,
  onToggleDarkMode,
}: Props) {
  const { t, language, setLanguage } = useTranslations()
  const { user, logout } = useAuth()
  const [lastSync, setLastSync] = useState<string>('')
  const [showA11yMenu, setShowA11yMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

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

  // Close mobile 3-dot menu when clicking outside
  useEffect(() => {
    function handleClickOutsideMobile(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutsideMobile)
    return () => document.removeEventListener('mousedown', handleClickOutsideMobile)
  }, [])

  return (
    <header className="w-full bg-white border-b border-gray-200 px-3 py-2.5 sm:px-4 sm:py-3 relative z-40">
      <div className="flex flex-row items-center justify-between gap-2">
        
        {/* Title Block */}
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base sm:text-lg font-extrabold truncate text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2 sm:w-2.5 h-6 sm:h-7 bg-emerald-600 rounded-full inline-block shrink-0"></span>
            {t('app.title')}
          </h1>
        </div>

        {/* Desktop Controls (hidden on mobile, shown on desktop) */}
        <div className="hidden sm:flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-full justify-end">
          
          {/* User Profile / Logout Pill */}
          {user && (
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-bold text-slate-700">
              <span className="truncate max-w-[70px] sm:max-w-[100px]">👤 {user.username}</span>
              <button
                type="button"
                onClick={logout}
                className="text-red-650 hover:underline text-[9px] cursor-pointer pl-0.5"
              >
                Logout
              </button>
            </div>
          )}

          {/* P2P Sync Trigger Button */}
          <button
            type="button"
            onClick={onTriggerP2PSync}
            className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-3 py-1.5 rounded-full text-xs shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            📶 P2P Sync
          </button>

          {/* User Role Selection Dropdown */}
          <div className="relative flex items-center gap-1 rounded-full border-2 border-slate-300 px-2.5 py-1 bg-white text-xs font-bold shadow-sm hover:border-slate-400">
            <BriefcaseIcon className="w-4 h-4 text-emerald-700 shrink-0" />
            <select
              value={mode}
              onChange={(e) => onSelectMode(e.target.value as 'citizen' | 'field-officer' | 'admin')}
              className="appearance-none bg-transparent pr-3.5 focus:outline-none cursor-pointer text-slate-800 font-extrabold text-xs"
              aria-label="Select user role"
            >
              <option value="citizen">Citizen</option>
              <option value="field-officer">Officer</option>
              <option value="admin">Chief (Admin)</option>
            </select>
            <span className="text-[8px] text-slate-400 font-bold pointer-events-none pr-0.5">▼</span>
          </div>

          {/* Direct Language Selection Dropdown */}
          <div className="relative flex items-center gap-1 rounded-full border-2 border-slate-300 px-2.5 py-1 bg-white text-xs font-bold shadow-sm hover:border-slate-400">
            <GlobeIcon className="w-4 h-4 text-emerald-700 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="appearance-none bg-transparent pr-3.5 focus:outline-none cursor-pointer text-slate-800 font-extrabold text-xs"
              aria-label="Select language"
            >
              {Object.entries(LANGUAGE_LABELS).map(([code]) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
            <span className="text-[8px] text-slate-400 font-bold pointer-events-none pr-0.5">▼</span>
          </div>

          {/* Accessibility Settings Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowA11yMenu(!showA11yMenu)}
              className={`flex items-center justify-center p-1.5 rounded-full border-2 text-xs font-semibold active:bg-gray-100 ${
                showA11yMenu ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 text-gray-700'
              }`}
              aria-label="Accessibility Settings"
              aria-expanded={showA11yMenu}
            >
              <AccessibilityIcon className="w-4.5 h-4.5" />
            </button>

            {/* Accessibility Popover Panel */}
            {showA11yMenu && (
              <div className="absolute right-0 mt-2 w-56 sm:w-64 rounded-2xl border-2 border-gray-200 bg-white p-3 sm:p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 border-b border-gray-100 pb-1.5 mb-2.5">
                  Accessibility Options
                </h3>
                
                <div className="flex flex-col gap-3">
                  {/* Icon Only Navigation Toggle */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">Icon-only Navigation</span>
                    <input
                      type="checkbox"
                      checked={iconOnlyNav}
                      onChange={onToggleIconOnlyNav}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Controls (shown on mobile, hidden on desktop) */}
        <div className="flex sm:hidden items-center gap-2">
          {/* Current account badge */}
          {user && (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-full px-2.5 py-1 font-extrabold max-w-[120px] truncate flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-slate-500" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="8" r="3.6" />
                <path d="M5 20c0-4.1 3.1-6.7 7-6.7s7 2.6 7 6.7" />
              </svg>
              {user.username}
            </span>
          )}
          
          {/* Hamburger Menu Button and dropdown */}
          <div className="relative" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="flex items-center justify-center p-2 rounded-full border border-gray-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 active:scale-95 transition-all cursor-pointer"
              aria-label="Menu"
              aria-expanded={showMobileMenu}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>

            {/* Mobile Dropdown Panel */}
            {showMobileMenu && (
              <div className="absolute right-0 mt-2.5 w-60 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-xl z-50 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
                
                {/* P2P Sync Button */}
                <button
                  type="button"
                  onClick={() => {
                    onTriggerP2PSync();
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center justify-start gap-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5a5 5 0 0 1 0-7M19 12.5a5 5 0 0 0 0-7M8 15a3 3 0 0 1 0-4M16 15a3 3 0 0 0 0-4M12 11.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                  </svg>
                  P2P Sync
                </button>

                {/* Account / Role Selection Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pl-1">Role / Account</label>
                  <div className="relative flex items-center rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2 py-1.5 text-xs font-semibold">
                    <BriefcaseIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-1.5 shrink-0" />
                    <select
                      value={mode}
                      onChange={(e) => {
                        onSelectMode(e.target.value as 'citizen' | 'field-officer' | 'admin');
                        setShowMobileMenu(false);
                      }}
                      className="w-full appearance-none bg-transparent pr-4 focus:outline-none cursor-pointer text-gray-800 dark:text-slate-100 font-bold"
                    >
                      <option value="citizen">Citizen</option>
                      <option value="field-officer">Officer</option>
                      <option value="admin">Chief (Admin)</option>
                    </select>
                    <span className="absolute right-2.5 text-[8px] text-gray-400 dark:text-gray-500 pointer-events-none">▼</span>
                  </div>
                </div>

                {/* Language Selection Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pl-1">Language</label>
                  <div className="relative flex items-center rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-2 py-1.5 text-xs font-semibold">
                    <GlobeIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-1.5 shrink-0" />
                    <select
                      value={language}
                      onChange={(e) => {
                        setLanguage(e.target.value as Language);
                        setShowMobileMenu(false);
                      }}
                      className="w-full appearance-none bg-transparent pr-4 focus:outline-none cursor-pointer text-gray-800 dark:text-slate-100 font-bold"
                    >
                      {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-2.5 text-[8px] text-gray-400 dark:text-gray-500 pointer-events-none">▼</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-200 dark:bg-slate-700 w-full" />

                {/* Toggles Group */}
                <div className="flex flex-col gap-1">
                  {/* Theme Mode Toggle (Dark/Light) */}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleDarkMode();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      {darkMode ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-500 shrink-0">
                          <circle cx="12" cy="12" r="5" />
                          <line x1="12" y1="1" x2="12" y2="3" />
                          <line x1="12" y1="21" x2="12" y2="23" />
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                          <line x1="1" y1="12" x2="3" y2="12" />
                          <line x1="21" y1="12" x2="23" y2="12" />
                          <line x1="4.22" y1="18.36" x2="5.64" y2="16.93" />
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-indigo-500 shrink-0">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      )}
                      Theme
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase">
                      {darkMode ? 'Light' : 'Dark'}
                    </span>
                  </button>

                  {/* Icon-only Navigation Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleIconOnlyNav();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                      Icon Nav
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase">
                      {iconOnlyNav ? 'On' : 'Off'}
                    </span>
                  </button>
                </div>

                {/* Logout Action (if logged in) */}
                {user && (
                  <>
                    <div className="h-px bg-gray-200 dark:bg-slate-700 w-full" />
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setShowMobileMenu(false);
                      }}
                      className="w-full flex items-center justify-start gap-2.5 text-left px-2.5 py-2.5 text-xs font-extrabold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      Logout
                    </button>
                  </>
                )}

              </div>
            )}
          </div>
        </div>

      </div>

      <p className="mt-1 text-[10px] sm:text-xs text-gray-400 font-medium">
        {t('lastsynced.label')}: {lastSync}
      </p>
    </header>
  )
}
