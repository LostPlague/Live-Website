import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { ThreeExperience } from './components/ThreeExperience'
import { OS } from './os/OS'
import { initAnalytics } from './analytics'

// The private Control Center — lazy so it stays out of the main portfolio bundle.
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

// Track everything EXCEPT the private control center (don't count yourself).
if (!window.location.pathname.startsWith('/admin')) initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ThreeExperience />} />
        <Route path="/os" element={<OS />} />
        <Route path="/os/*" element={<OS />} />
        <Route path="/admin" element={<Suspense fallback={null}><AdminDashboard /></Suspense>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
