import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { supabase } from './lib/supabase'
import AuthScreen from './AuthScreen'
import App from './App'

function Root() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    // Loading
    return (
      <div style={{
        minHeight: '100vh', background: '#0A0A0F',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#444', fontFamily: 'monospace', fontSize: 13,
      }}>
        💪
      </div>
    )
  }

  if (!session) return <AuthScreen />

  return <App session={session} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
