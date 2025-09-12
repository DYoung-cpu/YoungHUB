import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'

const ALLOWED_EMAILS = [
  import.meta.env.VITE_ALLOWED_EMAIL_1 || 'dyoung@lendwisemortgage.com',
  import.meta.env.VITE_ALLOWED_EMAIL_2 || 'lisa@gmail.com'
]

function App() {
  // TEMPORARY: Skip all auth for mobile testing
  const isVercel = window.location.hostname.includes('vercel.app')
  
  if (isVercel) {
    return (
      <div className="app">
        <Dashboard session={null as any} />
      </div>
    )
  }

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && ALLOWED_EMAILS.includes(session.user.email || '')) {
        setSession(session)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && ALLOWED_EMAILS.includes(session.user.email || '')) {
        setSession(session)
      } else {
        setSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading Family Finance Hub...</p>
      </div>
    )
  }
  
  return (
    <div className="app">
      {!session ? (
        <LoginPage allowedEmails={ALLOWED_EMAILS} />
      ) : (
        <Dashboard session={session} />
      )}
    </div>
  )
}

export default App