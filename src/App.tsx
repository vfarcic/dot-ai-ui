import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Visualization } from './pages/Visualization'
import { Layout } from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="v/:sessionId" element={<Visualization />} />
          <Route index element={<Navigate to="/v/demo" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
