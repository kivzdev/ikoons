import '@fontsource-variable/inter'
import './tokens.css'
import './page.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

if (import.meta.env.DEV) void import('./film')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
