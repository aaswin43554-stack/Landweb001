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
  highContrast,
  onToggleHighContrast,
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
            className="flex items-center gap-0.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            📶 P2P Sync
          </button>

          {/* User Role Selection Dropdown */}
          <div className="relative flex items-center gap-0.5 sm:gap-1 rounded-full border-2 border-gray-300 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white text-xs sm:text-sm font-semibold hover:bg-gray-50">
            <BriefcaseIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
            <select
              value={mode}
              onChange={(e) => onSelectMode(e.target.value as 'citizen' | 'field-officer' | 'admin')}
              className="appearance-none bg-transparent pr-3.5 focus:outline-none cursor-pointer text-gray-800 font-bold text-[10px] sm:text-xs"
              aria-label="Select user role"
            >
              <option value="citizen">Citizen</option>
              <option value="field-officer">Officer</option>
              <option value="admin">Chief (Admin)</option>
            </select>
            <span className="text-[8px] text-gray-400 font-bold pointer-events-none pr-0.5">▼</span>
          </div>

          {/* Direct Language Selection Dropdown */}
          <div className="relative flex items-center gap-0.5 sm:gap-1 rounded-full border-2 border-gray-300 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white text-xs sm:text-sm font-semibold hover:bg-gray-50">
            <GlobeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="appearance-none bg-transparent pr-3.5 focus:outline-none cursor-pointer text-gray-800 font-bold text-[10px] sm:text-xs"
              aria-label="Select language"
            >
              {Object.entries(LANGUAGE_LABELS).map(([code]) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
            <span className="text-[8px] text-gray-400 font-bold pointer-events-none pr-0.5">▼</span>
          </div>

          {/* Accessibility Settings Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowA11yMenu(!showA11yMenu)}
              className={`flex items-center justify-center p-1 sm:p-1.5 rounded-full border-2 text-xs sm:text-sm font-semibold active:bg-gray-100 ${
                showA11yMenu ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 text-gray-700'
              }`}
              aria-label="Accessibility Settings"
              aria-expanded={showA11yMenu}
            >
              <AccessibilityIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Accessibility Popover Panel */}
            {showA11yMenu && (
              <div className="absolute right-0 mt-2 w-56 sm:w-64 rounded-2xl border-2 border-gray-200 bg-white p-3 sm:p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 border-b border-gray-100 pb-1.5 mb-2.5">
                  Accessibility Options
                </h3>
                
                <div className="flex flex-col gap-3">
                  {/* High Contrast Toggle */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">High Contrast Mode</span>
                    <input
                      type="checkbox"
                      checked={highContrast}
                      onChange={onToggleHighContrast}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300 cursor-pointer"
                    />
                  </label>

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
            <span className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-full px-2.5 py-1 font-extrabold max-w-[120px] truncate">
              👤 {user.username}
            </span>
          )}
          
          {/* 3-dot Button and dropdown */}
          <div className="relative" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="flex items-center justify-center p-2 rounded-full border border-gray-350 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-250 active:scale-95 transition-all cursor-pointer"
              aria-label="Menu"
              aria-expanded={showMobileMenu}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
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
                  className="w-full flex items-center justify-start gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-2.5 rounded-xl text-xs shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                >
                  📶 P2P Sync
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
                    className="w-full flex items-center justify-between px-2 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-1.5">🌓 Theme</span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-450">
                      {darkMode ? '☀️ Light' : '🌙 Dark'}
                    </span>
                  </button>

                  {/* High Contrast Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleHighContrast();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-1.5">♿ High Contrast</span>
                    <span className="text-[11px]">
                      {highContrast ? '✅ On' : '❌ Off'}
                    </span>
                  </button>

                  {/* Icon-only Navigation Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleIconOnlyNav();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-1.5">🖼️ Icon Nav</span>
                    <span className="text-[11px]">
                      {iconOnlyNav ? '✅ On' : '❌ Off'}
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
                      className="w-full flex items-center justify-start gap-2 text-left px-2 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                    >
                      🚪 Logout
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
