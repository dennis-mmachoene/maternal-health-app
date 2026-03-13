/**
 * App.jsx — Root component with React Router layout.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import EDA from './pages/EDA'
import Training from './pages/Training'
import Performance from './pages/Performance'
import Predict from './pages/Predict'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-h-screen">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/eda" element={<EDA />} />
            <Route path="/training" element={<Training />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/predict" element={<Predict />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
