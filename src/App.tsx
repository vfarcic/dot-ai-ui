import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Visualization } from './pages/Visualization'
import { Layout } from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="v/:sessionId" element={<Visualization />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
