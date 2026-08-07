import { useState, useEffect } from 'react'
import { useAuth, type UserRole } from '../lib/auth'
import { QrScanner } from '../components/QrScanner'
import { QrIcon } from '../components/icons'

export function LoginScreen() {
  const { loginWithPasskey, registerPasskey, loginWithQR, registeredUsers } = useAuth()
  
  const [tab, setTab] = useState<'passkey' | 'qr'>('passkey')
  const [selectedUserId, setSelectedUserId] = useState('demo-citizen')
  const [showScanner, setShowScanner] = useState(false)
  const [qrCodeInput, setQrCodeInput] = useState('')
  const [scanError, setScanError] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Registration states (for demo/on-boarding setup)
  const [showRegister, setShowRegister] = useState(false)
  const [regId, setRegId] = useState('')
  const [regName, setRegName] = useState('')
  const [regRole, setRegRole] = useState<UserRole>('citizen')
  const [regPin, setRegPin] = useState('') // Created Backup PIN

  // Hardware Biometrics check & PIN verify states
  const [hasBiometricHardware, setHasBiometricHardware] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  
  // Interactive PIN Pad States
  const [enteredPin, setEnteredPin] = useState('')
  const [pinError, setPinError] = useState(false)

  // Query platform biometrics availability
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setHasBiometricHardware)
        .catch(() => setHasBiometricHardware(false))
    }
  }, [])

  // Synchronize default selected user once registry loads
  useEffect(() => {
    const biometricUsers = registeredUsers.filter((u) => u.biometricRegistered)
    if (biometricUsers.length > 0 && !biometricUsers.some((u) => u.id === selectedUserId)) {
      setSelectedUserId(biometricUsers[0].id)
    }
  }, [registeredUsers, selectedUserId])

  const handlePasskeyLogin = async () => {
    if (!selectedUserId) return
    
    // Clear previous values
    setEnteredPin('')
    setPinError(false)
    setScanSuccess(false)
    
    if (hasBiometricHardware) {
      // 1. Device has biometric hardware (Fingerprint/TouchID): Trigger native browser scanner
      setIsScanning(true)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      const success = await loginWithPasskey(selectedUserId)
      if (success) {
        setScanSuccess(true)
        await new Promise((resolve) => setTimeout(resolve, 600))
      } else {
        alert('Biometric validation failed.')
      }
      setIsScanning(false)
    } else {
      // 2. Device lacks biometrics (Laptop / Desktop): Open interactive Backup PIN input modal
      setIsScanning(true)
    }
  };

  // Handle number click on simulated Pin Pad
  const handlePinNumClick = async (num: string) => {
    if (enteredPin.length >= 4 || scanSuccess) return
    
    const nextPin = enteredPin + num
    setEnteredPin(nextPin)
    setPinError(false)
    
    if (nextPin.length === 4) {
      // Check PIN validity
      const success = await loginWithPasskey(selectedUserId, nextPin)
      if (success) {
        setScanSuccess(true)
        await new Promise((resolve) => setTimeout(resolve, 800))
        setIsScanning(false)
      } else {
        // Verification failed: Trigger shaking error effect
        setPinError(true)
        await new Promise((resolve) => setTimeout(resolve, 500))
        setEnteredPin('')
      }
    }
  }

  const handlePinDelete = () => {
    if (enteredPin.length > 0) {
      setEnteredPin(enteredPin.slice(0, -1))
      setPinError(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regId.trim() || !regName.trim() || regPin.length !== 4) {
      alert('Please fill out all fields and enter a 4-digit backup PIN.')
      return
    }
    
    setIsProcessing(true)
    const success = await registerPasskey(regId.trim(), regName.trim(), regRole, regPin)
    setIsProcessing(false)
    
    if (success) {
      alert('Passkey profile registered successfully!')
      setShowRegister(false)
      setSelectedUserId(regId.trim())
      setRegId('')
      setRegName('')
      setRegPin('')
    } else {
      alert('Failed to register passkey profile.')
    }
  }

  const handleQRLoginSubmit = async (val: string = qrCodeInput) => {
    if (!val.trim()) return
    setIsProcessing(true)
    const success = await loginWithQR(val)
    setIsProcessing(false)
    if (success) {
      setQrCodeInput('')
    } else {
      setScanError(true)
    }
  }

  const handleScanResult = (val: string) => {
    setShowScanner(false)
    handleQRLoginSubmit(val)
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 bg-slate-50 min-h-[500px]">
      <div className="w-full max-w-md bg-white rounded-3xl border-2 border-gray-200 p-6 shadow-md transition-all">
        {/* Brand / Title */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">GIZ Land Info System</h2>
          <p className="text-xs text-gray-500 mt-1">Official Secure Access Portal</p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-2 border-gray-200 rounded-xl overflow-hidden p-0.5 bg-gray-50 mb-6">
          <button
            type="button"
            onClick={() => { setTab('passkey'); setShowRegister(false); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'passkey' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-500'
            }`}
          >
            🎙️ Biometric Passkey
          </button>
          <button
            type="button"
            onClick={() => { setTab('qr'); setShowRegister(false); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'qr' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-500'
            }`}
          >
            🪪 QR Card Login
          </button>
        </div>

        {/* TAB 1: PASSKEY BIOMETRICS */}
        {tab === 'passkey' && !showRegister && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-gray-600">
              Select your profile and scan biometrics to log in.
            </p>

            {/* Profile Dropdown Selector */}
            <div className="w-full flex flex-col gap-1.5 text-left bg-gray-50 border border-gray-200 rounded-xl p-3">
              <label htmlFor="biometric-user-select" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Select Biometric Account
              </label>
              <select
                id="biometric-user-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none font-semibold text-slate-700"
              >
                {registeredUsers
                  .filter((u) => u.biometricRegistered)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.role === 'field-officer' ? 'Officer' : 'Citizen'})
                    </option>
                  ))}
              </select>
            </div>
            
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={isProcessing}
              className="w-28 h-28 rounded-full bg-emerald-50 border-4 border-emerald-600 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-14 h-14">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </button>

            <span className="text-xs font-bold text-slate-500">
              {hasBiometricHardware ? 'Tap to verify fingerprint sensor' : 'Tap to sign in with Backup PIN'}
            </span>

            <div className="w-full border-t border-gray-200 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Register new biometric device credentials ➔
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: PASSKEY REGISTRATION ON-BOARDING */}
        {tab === 'passkey' && showRegister && (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
            <h3 className="font-bold text-slate-800 text-sm">Onboard Biometrics / Passkey</h3>
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-id" className="text-xs font-semibold text-gray-600">
                User ID / National ID
              </label>
              <input
                id="reg-id"
                required
                value={regId}
                onChange={(e) => setRegId(e.target.value)}
                placeholder="e.g. CITIZEN-10492"
                className="rounded-xl border-2 border-gray-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-name" className="text-xs font-semibold text-gray-600">
                Full Name
              </label>
              <input
                id="reg-name"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Somphorn Keo"
                className="rounded-xl border-2 border-gray-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-role" className="text-xs font-semibold text-gray-600">
                System Role
              </label>
              <select
                id="reg-role"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as UserRole)}
                className="rounded-xl border-2 border-gray-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="citizen">Citizen (Submit Disputes)</option>
                <option value="field-officer">Field Officer (Case Manager)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-pin" className="text-xs font-semibold text-gray-600">
                Set 4-Digit Backup PIN (For Laptop/Non-Biometric Logins)
              </label>
              <input
                id="reg-pin"
                required
                type="password"
                pattern="\d{4}"
                maxLength={4}
                value={regPin}
                onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 1234"
                className="rounded-xl border-2 border-gray-300 px-3 py-2 text-sm bg-white font-mono text-center tracking-widest focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={isProcessing}
                className="flex-1 rounded-xl bg-emerald-700 text-white py-2.5 text-xs font-bold active:bg-emerald-800 disabled:bg-gray-300"
              >
                {isProcessing ? 'Registering...' : 'Register Profile'}
              </button>
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                className="px-4 rounded-xl border-2 border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: QR CARD SCAN LOGINS */}
        {tab === 'qr' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 text-center">
              Scan your physical GIZ Citizen Identity Card QR code using your device camera, or input it manually below.
            </p>

            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-white py-3 text-sm font-bold active:bg-slate-900 shadow-sm cursor-pointer"
            >
              <QrIcon className="w-5 h-5" />
              <span>Open Scanner Camera</span>
            </button>

            <div className="flex items-center my-1">
              <span className="flex-1 border-t border-gray-200"></span>
              <span className="text-[10px] font-bold text-gray-400 px-3 uppercase">or type credentials ID</span>
              <span className="flex-1 border-t border-gray-200"></span>
            </div>

            <div className="flex gap-2">
              <input
                value={qrCodeInput}
                onChange={(e) => setQrCodeInput(e.target.value)}
                placeholder="e.g. demo-citizen OR demo-officer"
                className="flex-1 rounded-xl border-2 border-gray-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleQRLoginSubmit()}
                disabled={!qrCodeInput.trim() || isProcessing}
                className="px-4 rounded-xl bg-emerald-700 text-white font-bold text-xs active:bg-emerald-800 disabled:bg-gray-300"
              >
                Submit
              </button>
            </div>

            {scanError && (
              <p className="text-xs text-red-600 text-center font-semibold">
                Invalid card code identifier. Try again.
              </p>
            )}

            {showScanner && (
              <QrScanner
                title="Scan ID QR Card"
                hint="Hold your identity card up to the camera scan frame."
                onResult={handleScanResult}
                onClose={() => setShowScanner(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Tactile Biometric OR PIN Pad Scanner Overlay */}
      {isScanning && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <style>{`
            @keyframes infinite-loading {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
            .animate-infinite-loading {
              animation: infinite-loading 1.2s infinite linear;
            }
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20%, 60% { transform: translateX(-6px); }
              40%, 80% { transform: translateX(6px); }
            }
            .animate-shake {
              animation: shake 0.4s ease-in-out;
            }
          `}</style>
          
          <div className="bg-white rounded-3xl p-6 max-w-[280px] w-full flex flex-col items-center gap-5 shadow-2xl border-2 border-emerald-500 animate-in fade-in zoom-in duration-200">
            {/* Header info */}
            <div className="text-center w-full">
              <h3 className="font-bold text-lg text-slate-800">
                {scanSuccess 
                  ? 'Verification Successful' 
                  : hasBiometricHardware 
                    ? 'Scanning Fingerprint' 
                    : 'Verify Backup PIN'
                }
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {scanSuccess 
                  ? 'Access granted. Welcome back!' 
                  : hasBiometricHardware 
                    ? 'Place your finger on your device\'s fingerprint sensor.' 
                    : 'Device lacks fingerprint hardware. Enter your 4-digit backup PIN (default: 1234).'
                }
              </p>
            </div>

            {/* Visual feedback element (Fingerprint OR Pin dots) */}
            {hasBiometricHardware || scanSuccess ? (
              <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                scanSuccess ? 'bg-emerald-600 text-white' : 'bg-emerald-50 border-4 border-emerald-650'
              }`}>
                {scanSuccess ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-10 h-10">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-10 h-10 text-emerald-700 animate-pulse">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                )}
              </div>
            ) : (
              /* Dot indicator for PIN entry */
              <div className={`flex gap-3 my-2 justify-center ${pinError ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((idx) => (
                  <span
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                      idx < enteredPin.length
                        ? 'bg-emerald-650 border-emerald-650 scale-110'
                        : pinError
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Simulated progress bar for hardware biometrics */}
            {hasBiometricHardware && !scanSuccess && (
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                <div className="h-full bg-emerald-600 animate-infinite-loading rounded-full w-1/2 absolute top-0 left-0"></div>
              </div>
            )}

            {/* Numerical PIN Pad for non-biometric laptops */}
            {!hasBiometricHardware && !scanSuccess && (
              <div className="w-full flex flex-col gap-2 border-t border-gray-100 pt-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handlePinNumClick(n)}
                      className="py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-slate-700 hover:bg-gray-100 active:bg-gray-200 select-none cursor-pointer"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsScanning(false)}
                    className="py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 select-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinNumClick('0')}
                    className="py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-slate-700 hover:bg-gray-100 active:bg-gray-200 select-none cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handlePinDelete}
                    className="py-2.5 text-xs font-bold text-red-650 hover:text-red-800 select-none cursor-pointer"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
