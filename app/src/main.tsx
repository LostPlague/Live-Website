import { StrictMode, lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { ThreeExperience } from './components/ThreeExperience'
import { OS } from './os/OS'
import { initAnalytics, resolveOwner, track } from './analytics'

// The private Control Center — lazy so it stays out of the main portfolio bundle.
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

// Track everything EXCEPT the private control center (don't count yourself).
// /admin still resolves the owner tag — tagging is a preference, not tracking,
// so `/admin?me=<token>` works there without turning analytics on.
if (window.location.pathname.startsWith('/admin')) resolveOwner()
else initAnalytics()

// Phones go straight into the OS instead of the 3D room. Two reasons, both
// measured: (1) the room's content lives on a CRT that renders ~11% of a phone
// screen, and entering it is triggered by mouse HOVER, which touch devices
// don't have — so the content was unreachable; (2) the room pulls ~21MB of
// models/textures/video before it can even be shown. Half of all real visitors
// are on phones. Desktop is untouched — including touch-screen laptops, which
// is why the coarse-pointer test is also width-gated.
const isHandheld =
  window.innerWidth < 768 ||
  (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024)

/** Mobile entry point. Fires experience_started so the funnel — and the
 *  analytics "real human" gate, which keys on it — still works without the
 *  3D room, then hands over to the full-screen OS. */
function MobileHome() {
  useEffect(() => { track('experience_started', { mode: 'mobile', skipped3d: true }) }, [])
  return <OS />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={isHandheld ? <MobileHome /> : <ThreeExperience />} />
        <Route path="/os" element={<OS />} />
        <Route path="/os/*" element={<OS />} />
        <Route path="/admin" element={<Suspense fallback={null}><AdminDashboard /></Suspense>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
