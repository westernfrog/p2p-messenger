import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { actions, getState } from '@/lib/app'

// Follow the system appearance (dark-mode.md: no app-specific switch). Share's tokens key off `.dark`.
const dark = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => document.documentElement.classList.toggle('dark', dark.matches)
dark.addEventListener('change', applyTheme)
applyTheme()

// Keep the layout the size of the visible area, so the on-screen keyboard never covers the composer.
const vv = window.visualViewport
if (vv) {
  const update = () => {
    document.documentElement.style.setProperty('--app-h', `${vv.height}px`)
    if (vv.offsetTop) window.scrollTo(0, 0)
  }
  vv.addEventListener('resize', update)
  update()
}

actions.boot()

// Opened from a QR or invite link (`#add=…`): go straight to adding that contact.
if (location.hash.startsWith('#add=')) {
  const link = location.href
  history.replaceState(null, '', location.pathname + location.search)
  if (getState().me) actions.openSheet({ kind: 'add', tab: 'scan', prefill: link })
  else sessionStorage.setItem('p2pmsg:pending-add', link)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
