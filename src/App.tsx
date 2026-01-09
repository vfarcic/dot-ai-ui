import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Visualization } from './pages/Visualization'
import { Dashboard } from './pages/Dashboard'
import { ResourceDetail } from './pages/ResourceDetail'
import { Layout } from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect home to dashboard until home page is implemented */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Resource detail page - group uses _core for core resources, namespace uses _cluster for cluster-scoped */}
        <Route path="/dashboard/:group/:version/:kind/:namespace/:name" element={<ResourceDetail />} />
        {/* Visualization uses Layout wrapper */}
        <Route element={<Layout />}>
          <Route path="/v/:sessionId" element={<Visualization />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
