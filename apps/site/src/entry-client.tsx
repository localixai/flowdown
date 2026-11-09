import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import 'llx-markdown/styles.css'
import './styles.css'
import './pages.css'
import { App } from './App'
import { normalizeRoute } from './lib/routes'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App route={normalizeRoute(window.location.pathname)} />
  </StrictMode>
)
// A prerendered page is hydrated; `vite dev` serves the empty template, which is rendered.
if (root.firstElementChild) hydrateRoot(root, app)
else createRoot(root).render(app)
