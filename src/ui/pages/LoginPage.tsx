import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PosBackground from '../components/PosBackground'
import Logo from '../components/Logo'
import PasswordInput from '../components/PasswordInput'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.')
      return
    }
    setSubmitting(true)
    const ok = await login(email, password)
    setSubmitting(false)
    if (ok) navigate('/dashboard', { replace: true })
    else setError('Invalid email or password.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <PosBackground />
      <div className="relative bg-brand-card backdrop-blur-2xl border border-white/30 dark:border-white/[0.08] rounded-card px-10 py-10 shadow-premium-lg w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <Logo className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-brand-text-primary">Welcome Back</h1>
          <p className="text-sm text-brand-text-muted mt-1">Sign in to your POS dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email"
              className="w-full px-4 py-2.5 rounded-input bg-brand-surface/50 border border-brand-border text-sm text-brand-text-primary placeholder:text-brand-text-muted outline-none focus:border-brand-primary transition-colors" />
          </div>
          <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />

          {error && <p className="text-sm text-accent-orange">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-button bg-brand-primary text-gray-900 font-semibold text-sm hover:brightness-105 transition-all disabled:opacity-50">
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  )
}
