import { FictionalDataBanner } from './components/FictionalDataBanner'
import { ConnectionStatus } from './components/ConnectionStatus'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <FictionalDataBanner />

      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold">
          Land Use Transparency Prototype
        </h1>
        <p className="max-w-md text-gray-700">
          Project scaffold is live. Feature screens (parcel lookup, land-use
          map, dispute form, field officer dashboard) are built in later
          modules.
        </p>
        <ConnectionStatus />
      </main>
    </div>
  )
}

export default App
