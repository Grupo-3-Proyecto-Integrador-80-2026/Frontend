import { useState } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Today from './pages/Today'
import Events from './pages/Events'
import CreateEvent from './pages/CreateEvent'
import EventDetail from './pages/EventDetail'
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
  return {
    title: 'Hoy',
    description: 'Las gestiones que necesitan tu atención, de la más urgente a la menos urgente.',
  }
}

// Estructura de las páginas privadas: barra lateral + encabezado + contenido
function AppLayout() {
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
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      {/* Públicas: si ya hay sesión, redirigen a /hoy */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
      </Route>

      {/* Privadas (US-11): sin sesión redirigen a /login */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/hoy" element={<Today />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/crear" element={<CreateEvent />} />
          <Route path="/evento/:id" element={<EventDetail />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/hoy" replace />} />
    </Routes>
  )
}

export default App
