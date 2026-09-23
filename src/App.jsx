import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Home from './pages/Home'
import CreateEvent from './pages/CreateEvent'
import './App.css'

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const isCreateRoute = location.pathname === '/crear'

  const title = isCreateRoute ? 'Crear Nuevo Evento' : 'Gestiones de Hoy'
  const subtitle = isCreateRoute ? 'Planificador y control de capacidad' : 'Jornada de Producción'

  return (
    <div className="app-layout">
      {/* Sidebar fijo estilo Prototipo */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Panel Principal */}
      <main className="main-viewport">
        <Header
          title={title}
          subtitle={subtitle}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <div className="main-content-scroll">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/crear" element={<CreateEvent />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
