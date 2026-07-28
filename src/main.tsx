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
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
