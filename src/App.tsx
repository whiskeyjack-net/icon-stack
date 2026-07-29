import { Navigate, Routes, Route } from 'react-router-dom'
import { GeneratorProvider } from '@/contexts/GeneratorContext'
import { Layout } from '@/components/Layout'
import { Generator } from '@/pages/Generator'
import { Settings } from '@/pages/Settings'

export default function App() {
  return (
    // The provider wraps the Layout, not just the routes: the header toolbar and
    // the replace-confirmation drawer both live in the Layout and both read
    // generator state.
    <GeneratorProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Generator />} />
          <Route path="/settings" element={<Settings />} />
          {/*
            An unmatched path rendered nothing at all, so the shell painted
            around an empty main and read as a broken page. It is reachable
            without anyone typing a bad URL: the domain's shared 404 handler
            stores the requested path and index.html replays it before React
            mounts, so a stale entry restores a route this app has never had.
          */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </GeneratorProvider>
  )
}
