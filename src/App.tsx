import Dashboard from './pages/Dashboard'

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
