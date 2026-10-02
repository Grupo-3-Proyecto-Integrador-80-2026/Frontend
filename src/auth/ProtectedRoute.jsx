import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import StatusMessage from '../components/StatusMessage'

/**
 * Envuelve las rutas privadas (/hoy, /crear, /evento/:id, /eventos):
 * sin sesión redirige a /login y recuerda a qué página quería ir el organizador.
 */
export default function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <div className="auth-checking">
        <StatusMessage variant="loading" title="Verificando tu sesión..." />
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

/** Para /login y /registro: si ya hay sesión, no tiene sentido mostrarlas. */
export function PublicOnlyRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <div className="auth-checking">
        <StatusMessage variant="loading" title="Verificando tu sesión..." />
      </div>
    )
  }

  if (status === 'authenticated') {
    return <Navigate to={location.state?.from?.pathname || '/hoy'} replace />
  }

  return <Outlet />
}
