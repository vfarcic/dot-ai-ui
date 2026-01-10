import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Visualization } from './pages/Visualization'
import { ResourceDetail } from './pages/ResourceDetail'
import { SharedDashboardLayout } from './components/dashboard/SharedDashboardLayout'
import { DashboardHome } from './components/dashboard/DashboardHome'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect home to dashboard until home page is implemented */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard routes - sidebar expanded by default */}
        <Route element={<SharedDashboardLayout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
        </Route>

        {/* Resource detail page - standalone, has its own layout */}
        {/* group uses _core for core resources, namespace uses _cluster for cluster-scoped */}
        <Route path="/dashboard/:group/:version/:kind/:namespace/:name" element={<ResourceDetail />} />

        {/* Visualization routes - sidebar collapsed by default */}
        <Route element={<SharedDashboardLayout defaultCollapsed />}>
          <Route path="/v/:sessionId" element={<Visualization />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
