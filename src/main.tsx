import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './i18n'
import { setCanvasBackend } from '@whiskeyjack-net/icon-stack-core'
import { browserCanvasBackend } from '@whiskeyjack-net/icon-stack-core/browser'

// The icon pipeline is host-agnostic: the browser supplies DOM canvas +
// pica, the CLI supplies Skia. Install one before generating anything.
setCanvasBackend(browserCanvasBackend)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      The app is served from a subpath (whiskeyjack.net/icon-stack/), so the
      router has to be told, or it matches its routes against `/icon-stack/` and
      nothing matches -- the shell paints and `<Routes>` renders nothing, which
      looks exactly like a blank page. Following a nav link then "fixes" it by
      moving to `/`, at the wrong URL, which is why the symptom reads as
      intermittent.

      Taken from Vite's BASE_URL rather than written out again, so the path is
      declared once. A second hardcoded copy is the kind that drifts.
    */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
