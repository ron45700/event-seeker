import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/karantina/400.css'
import '@fontsource/karantina/700.css'
import '@fontsource/ibm-plex-sans-hebrew/400.css'
import '@fontsource/ibm-plex-sans-hebrew/500.css'
import '@fontsource/ibm-plex-sans-hebrew/600.css'
import './styles/tokens.css'
import './styles/base.css'
import { App } from './App'
import { ToastProvider } from './components/Toast'
import { SessionProvider } from './lib/session'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SessionProvider>
  </StrictMode>,
)
