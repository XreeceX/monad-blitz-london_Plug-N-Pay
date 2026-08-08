import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'
import { Wall } from './wall/Wall'

// Two surfaces, one build: the phone app by default, the booth's public
// leaderboard screen at /#wall (spec §3.8).
const isWall = window.location.hash === '#wall'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isWall ? <Wall /> : <App />}</StrictMode>,
)
