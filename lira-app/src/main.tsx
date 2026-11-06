import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Inter is served from this app (no request to Google, works offline)
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'
import './index.css'
import './theme-dark.css'
import App from './App.tsx'
import { MotionProvider } from './components/common/motion'
import { Confetti } from './components/common/Confetti'
import { initKvMirror, onKvChange } from './services/kvMirror'
import { syncStructured } from './services/structuredStore'
import { applyAccent, loadAccent } from './utils/accent'

// Restore projects, sprints, teams, standups and preferences from data/*.json before anything reads them.
onKvChange(() => { void syncStructured() })
initKvMirror().finally(() => {
  applyAccent(loadAccent()) // the saved accent colour, before the first paint of the app
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
