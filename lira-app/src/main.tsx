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
import { EDITION, appBasename, showsPublicSite } from './utils/edition'
import { PublicSite } from './components/public/PublicSite'

const root = () => createRoot(document.getElementById('root')!)

if (showsPublicSite(EDITION, window.location.pathname)) {
  // The public pages of the hosted edition hold no workspace data, so there is nothing to restore first.
  paintTheme()
  root().render(
    <StrictMode>
      <BrowserRouter>
        <PublicSite />
      </BrowserRouter>
    </StrictMode>,
  )
} else {
  // Restore projects, sprints, teams, standups and preferences from data/*.json before anything reads them.
  onKvChange(() => { void syncStructured() })
  initKvMirror().finally(() => {
    paintTheme() // the theme saved on disk, now that it has been restored (a new browser has none of its own)
    root().render(
      <StrictMode>
        <MotionProvider>
          <BrowserRouter basename={appBasename(EDITION)}>
            <App />
          </BrowserRouter>
          <Confetti />
        </MotionProvider>
      </StrictMode>,
    )
  })
}
