import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './theme-dark.css'
import App from './App.tsx'
import { MotionProvider } from './components/common/motion'
import { Confetti } from './components/common/Confetti'
import { initKvMirror, onKvChange } from './services/kvMirror'
import { syncStructured } from './services/structuredStore'
import { paintTheme } from './utils/theme'

// Restore projects, sprints, teams, standups and preferences from data/*.json before anything reads them.
onKvChange(() => { void syncStructured() })
initKvMirror().finally(() => {
  paintTheme() // the theme saved on disk, now that it has been restored (a new browser has none of its own)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MotionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Confetti />
      </MotionProvider>
    </StrictMode>,
  )
})
