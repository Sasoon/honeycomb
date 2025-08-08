import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { scheduleDictionaryPreload } from './lib/wordValidator'

// Schedule heavy dictionary preload during idle time
scheduleDictionaryPreload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
