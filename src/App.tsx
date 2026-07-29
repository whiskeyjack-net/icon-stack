import { Routes, Route } from 'react-router-dom'
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
        </Routes>
      </Layout>
    </GeneratorProvider>
  )
}
