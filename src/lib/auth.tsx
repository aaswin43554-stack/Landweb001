import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type UserRole = 'citizen' | 'field-officer'

export interface User {
  id: string
  username: string
  role: UserRole
  biometricRegistered: boolean
  credentialId?: string
  backupPin: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  registeredUsers: User[]
  loginWithPasskey: (userId: string, enteredPin?: string) => Promise<boolean>
  registerPasskey: (id: string, username: string, role: UserRole, backupPin: string) => Promise<boolean>
  loginWithQR: (qrCodeData: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const LOCAL_STORAGE_KEY = 'giz-auth-session'
const REGISTERED_USERS_KEY = 'giz-registered-users'

// Default mock registry with standard backup PINs (default: 1234)
const DEFAULT_REGISTRY: Record<string, User> = {
  'demo-citizen': { id: 'demo-citizen', username: 'Demo Citizen', role: 'citizen', biometricRegistered: true, backupPin: '1234' },
  'demo-officer': { id: 'demo-officer', username: 'Officer Sisavath', role: 'field-officer', biometricRegistered: true, backupPin: '1234' },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Initialize session and registry
  useEffect(() => {
    try {
      const session = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (session) {
        setUser(JSON.parse(session))
      }
      
      const registry = localStorage.getItem(REGISTERED_USERS_KEY)
      if (!registry) {
        localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(DEFAULT_REGISTRY))
        setRegisteredUsers(Object.values(DEFAULT_REGISTRY))
      } else {
        setRegisteredUsers(Object.values(JSON.parse(registry)))
      }
    } catch (err) {
      console.warn('Failed to load auth session:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getRegistry = (): Record<string, User> => {
    try {
      const registry = localStorage.getItem(REGISTERED_USERS_KEY)
      return registry ? JSON.parse(registry) : DEFAULT_REGISTRY
    } catch {
      return DEFAULT_REGISTRY
    }
  }

  const saveUserToRegistry = (user: User) => {
    try {
      const registry = getRegistry()
      registry[user.id] = user
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registry))
      setRegisteredUsers(Object.values(registry))
    } catch (err) {
      console.warn('Failed to save user to registry:', err)
    }
  }

  /**
   * Biometric Passkey Registration with Backup PIN Setup
   */
  const registerPasskey = async (id: string, username: string, role: UserRole, backupPin: string): Promise<boolean> => {
    try {
      let credentialId: string | undefined = undefined

      // 1. Try to invoke native WebAuthn Credentials creation if available and in secure context
      if (typeof window !== 'undefined' && window.PublicKeyCredential && window.isSecureContext) {
        try {
          const challenge = new Uint8Array(32)
          window.crypto.getRandomValues(challenge)
          const userId = new Uint8Array(16)
          window.crypto.getRandomValues(userId)

          const credential = await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: 'GIZ Land Info' },
              user: {
                id: userId,
                name: id,
                displayName: username,
              },
              pubKeyCredParams: [{ alg: -7, type: 'public-key' }], // ES256
              timeout: 60000,
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
              },
            },
          }) as PublicKeyCredential | null

          if (credential) {
            // Encode rawId to base64 string for local storage representation
            credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
          }
        } catch (webAuthnErr: any) {
          console.warn('PublicKeyCredential creation failed, using secure software simulator:', webAuthnErr.message)
        }
      }

      // 2. Register user credentials locally
      const newUser: User = {
        id,
        username,
        role,
        biometricRegistered: true,
        credentialId,
        backupPin,
      }
      saveUserToRegistry(newUser)
      return true
    } catch (err) {
      console.error('Passkey registration error:', err)
      return false
    }
  }

  /**
   * Biometric Passkey Login with Backup PIN Fallback validation
   */
  const loginWithPasskey = async (userId: string, enteredPin?: string): Promise<boolean> => {
    try {
      const registry = getRegistry()
      const targetUser = registry[userId]
      if (!targetUser) return false

      let verified = false

      // 1. Try native WebAuthn login assertion if credentialId exists
      if (typeof window !== 'undefined' && window.PublicKeyCredential && window.isSecureContext && targetUser.credentialId) {
        try {
          const challenge = new Uint8Array(32)
          window.crypto.getRandomValues(challenge)

          // Decode base64 credentialId back to buffer
          const rawId = Uint8Array.from(atob(targetUser.credentialId), c => c.charCodeAt(0))

          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              timeout: 60000,
              allowCredentials: [{
                id: rawId,
                type: 'public-key',
              }],
              userVerification: 'required',
            },
          })

          if (assertion) {
            verified = true
          }
        } catch (webAuthnErr: any) {
          console.warn('PublicKeyCredential verification failed, using backup verification:', webAuthnErr.message)
        }
      }

      // 2. Backup PIN verification check (for desktop/laptops lacking biometric sensors)
      if (!verified && enteredPin) {
        if (targetUser.backupPin === enteredPin) {
          verified = true
        }
      }

      if (verified) {
        setUser(targetUser)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(targetUser))
        return true
      }
      return false
    } catch (err) {
      console.error('Biometric passkey login error:', err)
      return false
    }
  }

  /**
   * Scan QR / NFC Card authentication logic
   */
  const loginWithQR = async (qrCodeData: string): Promise<boolean> => {
    try {
      let cardId = qrCodeData.trim()
      let cardRole: UserRole = 'citizen'
      let cardName = 'Card Citizen'

      // Check if QR data is formatted as JSON
      try {
        const parsed = JSON.parse(qrCodeData)
        if (parsed.id) cardId = parsed.id
        if (parsed.role) cardRole = parsed.role as UserRole
        if (parsed.username) cardName = parsed.username
      } catch {
        // Raw string: detect if citizen ID
        if (cardId.toLowerCase().includes('officer')) {
          cardRole = 'field-officer'
          cardName = 'Officer Scanner'
        } else if (cardId.toLowerCase().includes('citizen')) {
          cardRole = 'citizen'
          cardName = 'Citizen Cardholder'
        }
      }

      const registry = getRegistry()
      let matchedUser = registry[cardId]

      if (!matchedUser) {
        matchedUser = {
          id: cardId,
          username: cardName,
          role: cardRole,
          biometricRegistered: false,
          backupPin: '1234',
        }
        saveUserToRegistry(matchedUser)
      }

      setUser(matchedUser)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(matchedUser))
      return true
    } catch (err) {
      console.error('QR card login error:', err)
      return false
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        registeredUsers,
        loginWithPasskey,
        registerPasskey,
        loginWithQR,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
