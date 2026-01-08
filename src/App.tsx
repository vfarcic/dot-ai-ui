import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Visualization } from './pages/Visualization'
import { Dashboard } from './pages/Dashboard'
import { Layout } from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect home to dashboard until home page is implemented */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Visualization uses Layout wrapper */}
        <Route element={<Layout />}>
          <Route path="/v/:sessionId" element={<Visualization />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
