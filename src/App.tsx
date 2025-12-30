import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Chat } from './pages/Chat'
import { Layout } from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Chat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
