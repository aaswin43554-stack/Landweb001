import { useEffect, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { FictionalDataBanner } from './components/FictionalDataBanner'
import { Header } from './components/Header'
import type { AppView } from './lib/navigation'
import { TranslationsProvider } from './lib/translations'
import { AuthProvider, useAuth } from './lib/auth'
import { DisputeFormScreen } from './screens/DisputeFormScreen'
import { CaseStatusScreen } from './screens/CaseStatusScreen'
import { FieldOfficerScreen } from './screens/FieldOfficerScreen'
import { LandUseExplainerScreen } from './screens/LandUseExplainerScreen'
import { ParcelLookupScreen } from './screens/ParcelLookupScreen'
import { LoginScreen } from './screens/LoginScreen'
import { preloadAndCacheAll } from './lib/land'

function AppContent() {
  const { user } = useAuth()
  const [view, setView] = useState<AppView>({ mode: 'citizen', screen: 'parcel-lookup' })
  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem('giz-a11y-high-contrast') === 'true'
  })
  const [iconOnlyNav, setIconOnlyNav] = useState(() => {
    return localStorage.getItem('giz-a11y-icon-only-nav') === 'true'
  })

  useEffect(() => {
    preloadAndCacheAll()
  }, [])

  // Auto-route based on logged-in user role
  useEffect(() => {
    if (user) {
      if (user.role === 'field-officer') {
        setView({ mode: 'field-officer' })
      } else {
        setView({ mode: 'citizen', screen: 'parcel-lookup' })
      }
    }
  }, [user])

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast)
    localStorage.setItem('giz-a11y-high-contrast', String(highContrast))
  }, [highContrast])

  useEffect(() => {
    localStorage.setItem('giz-a11y-icon-only-nav', String(iconOnlyNav))
  }, [iconOnlyNav])

  // 1. If not authenticated, force Login Screen
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <FictionalDataBanner />
        <Header
          mode="citizen"
          onEnterFieldOfficer={() => {}}
          onExitFieldOfficer={() => {}}
          highContrast={highContrast}
          onToggleHighContrast={() => setHighContrast(!highContrast)}
          iconOnlyNav={iconOnlyNav}
          onToggleIconOnlyNav={() => setIconOnlyNav(!iconOnlyNav)}
        />
        <main className="flex-1 flex flex-col">
          <LoginScreen />
        </main>
      </div>
    )
  }

  // 2. Authenticated layout rendering
  return (
    <div className="min-h-screen flex flex-col">
      <FictionalDataBanner />
      <Header
        mode={view.mode}
        onEnterFieldOfficer={() => setView({ mode: 'field-officer' })}
        onExitFieldOfficer={() => setView({ mode: 'citizen', screen: 'parcel-lookup' })}
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast(!highContrast)}
        iconOnlyNav={iconOnlyNav}
        onToggleIconOnlyNav={() => setIconOnlyNav(!iconOnlyNav)}
      />

      <main className="flex-1 flex flex-col">
        {view.mode === 'field-officer' && <FieldOfficerScreen />}
        {view.mode === 'citizen' && view.screen === 'parcel-lookup' && <ParcelLookupScreen />}
        {view.mode === 'citizen' && view.screen === 'land-use-explainer' && <LandUseExplainerScreen />}
        {view.mode === 'citizen' && view.screen === 'dispute-form' && <DisputeFormScreen />}
        {view.mode === 'citizen' && view.screen === 'case-status' && <CaseStatusScreen />}
      </main>

      {view.mode === 'citizen' && (
        <BottomNav 
          active={view.screen} 
          onChange={(screen) => setView({ mode: 'citizen', screen })} 
          iconOnly={iconOnlyNav}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <TranslationsProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </TranslationsProvider>
  )
}

export default App
