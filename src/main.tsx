import './lib/zod-config'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'
import { healIosStandaloneViewport } from './app/ios-viewport'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

healIosStandaloneViewport()
