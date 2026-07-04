import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../services/api'

interface User {
  id: string
  full_name: string
  email: string
  username: string
}

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  hasOwner: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [hasOwner, setHasOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const e = window.electron as any
    e.auth.ownerStatus().then((status: { hasOwner: boolean }) => {
      setHasOwner(status.hasOwner)
      setLoading(false)
    })
  }, [])

  const login = async (email: string, password: string) => {
    const user = await api.auth.login(email, password) as User | null
    if (user) {
      setCurrentUser(user)
      return true
    }
    return false
  }

  const logout = () => setCurrentUser(null)

  return (
    <AuthContext.Provider value={{ currentUser, loading, hasOwner, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
