import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { ThreeExperience } from './components/ThreeExperience'
import { OS } from './os/OS'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ThreeExperience />} />
        <Route path="/os" element={<OS />} />
        <Route path="/os/*" element={<OS />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
