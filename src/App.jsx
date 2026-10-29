import { useCallback, useState } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Today from './pages/Today'
import Events from './pages/Events'
import CreateEvent from './pages/CreateEvent'
import EventDetail from './pages/EventDetail'
import Progress from './pages/Progress'
import Login from './pages/Login'
import Register from './pages/Register'
import ProtectedRoute, { PublicOnlyRoute } from './auth/ProtectedRoute'
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
  if (pathname === '/progreso') {
    return {
      title: 'Progreso de preparación',
      description: 'Porcentaje de avance y gestiones completadas por evento.',
    }
  }
  return {
    title: 'Hoy',
    description: 'Las gestiones que necesitan tu atención, de la más urgente a la menos urgente.',
  }
}

function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // Estable entre renders: el Sidebar la usa como dependencia de su efecto de foco
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), [])
  const location = useLocation()
  const { title, description } = getHeaderCopy(location.pathname)

  return (
    <div className="app-layout">
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={closeMobileMenu}
      />

      <main className="main-viewport">
        <Header
          title={title}
          description={description}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        <div className="main-content-scroll">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/hoy" element={<Today />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/progreso" element={<Progress />} />
          <Route path="/crear" element={<CreateEvent />} />
          <Route path="/evento/:id" element={<EventDetail />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/hoy" replace />} />
    </Routes>
  )
}

export default App