import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Today from './pages/Today'
import Events from './pages/Events'
import CreateEvent from './pages/CreateEvent'
import EventDetail from './pages/EventDetail'
import './App.css'

// Título y descripción del encabezado según la ruta activa
function getHeaderCopy(pathname) {
  if (pathname === '/crear') {
    return {
      title: 'Crear evento',
      description: 'Registra el evento y, si quieres, su plan inicial de gestiones.',
    }
  }
  if (pathname.startsWith('/evento/')) {
    return {
      title: 'Detalle del evento',
      description: 'Consulta y actualiza el evento y sus gestiones logísticas.',
    }
  }
  if (pathname === '/eventos') {
    return {
      title: 'Eventos',
      description: 'Todos los eventos que estás organizando.',
    }
  }
  return {
    title: 'Hoy',
    description: 'Las gestiones que necesitan tu atención, de la más urgente a la menos urgente.',
  }
}

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const { title, description } = getHeaderCopy(location.pathname)

  return (
    <div className="app-layout">
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Panel Principal */}
      <main className="main-viewport">
        <Header
          title={title}
          description={description}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <div className="main-content-scroll">
          <Routes>
            <Route path="/" element={<Navigate to="/hoy" replace />} />
            <Route path="/hoy" element={<Today />} />
            <Route path="/eventos" element={<Events />} />
            <Route path="/crear" element={<CreateEvent />} />
            <Route path="/evento/:id" element={<EventDetail />} />
            <Route path="*" element={<Navigate to="/hoy" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
