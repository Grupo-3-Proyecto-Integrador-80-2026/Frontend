import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Home from './pages/Home'
import CreateEvent from './pages/CreateEvent'
import EventDetail from './pages/EventDetail'
import './App.css'

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const isCreateRoute = location.pathname === '/crear'
  const isDetailRoute = location.pathname.startsWith('/evento/')

  let title = 'Gestiones de Hoy'
  let subtitle = 'Jornada de Producción'

  if (isCreateRoute) {
    title = 'Crear Nuevo Evento'
    subtitle = 'Planificador y control de capacidad'
  } else if (isDetailRoute) {
    title = 'Detalle de Evento'
    subtitle = 'Visualización de información'
  }

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
            <Route path="/evento/:id" element={<EventDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
