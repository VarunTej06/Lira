import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './theme-dark.css'
import App from './App.tsx'
import { initKvMirror, onKvChange } from './services/kvMirror'
import { syncStructured } from './services/structuredStore'
import { applyAccent, loadAccent } from './utils/accent'

// Restore projects, sprints, teams, standups and preferences from data/*.json before anything reads them.
onKvChange(() => { void syncStructured() })
initKvMirror().finally(() => {
  applyAccent(loadAccent()) // the saved accent colour, before the first paint of the app
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
