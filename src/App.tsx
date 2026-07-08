import { useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { FictionalDataBanner } from './components/FictionalDataBanner'
import { Header } from './components/Header'
import type { AppView } from './lib/navigation'
import { TranslationsProvider } from './lib/translations'
import { DisputeFormScreen } from './screens/DisputeFormScreen'
import { FieldOfficerScreen } from './screens/FieldOfficerScreen'
import { LandUseExplainerScreen } from './screens/LandUseExplainerScreen'
import { ParcelLookupScreen } from './screens/ParcelLookupScreen'

function AppShell() {
  const [view, setView] = useState<AppView>({ mode: 'citizen', screen: 'parcel-lookup' })

  return (
    <div className="min-h-screen flex flex-col">
      <FictionalDataBanner />
      <Header
        mode={view.mode}
        onEnterFieldOfficer={() => setView({ mode: 'field-officer' })}
        onExitFieldOfficer={() => setView({ mode: 'citizen', screen: 'parcel-lookup' })}
      />

      <main className="flex-1 flex flex-col">
        {view.mode === 'field-officer' && <FieldOfficerScreen />}
        {view.mode === 'citizen' && view.screen === 'parcel-lookup' && <ParcelLookupScreen />}
        {view.mode === 'citizen' && view.screen === 'land-use-explainer' && <LandUseExplainerScreen />}
        {view.mode === 'citizen' && view.screen === 'dispute-form' && <DisputeFormScreen />}
      </main>

      {view.mode === 'citizen' && (
        <BottomNav active={view.screen} onChange={(screen) => setView({ mode: 'citizen', screen })} />
      )}
    </div>
  )
}

function App() {
  return (
    <TranslationsProvider>
      <AppShell />
    </TranslationsProvider>
  )
}

export default App
