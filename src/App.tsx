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
  // TEMPORARY: Bypass auth entirely for local development and production
  console.log('Bypassing auth for development/testing')
  return (
    <div className="app">
      <Dashboard session={null as any} />
    </div>
  )
}

export default App