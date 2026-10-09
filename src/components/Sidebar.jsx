import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  IconCalendar,
  IconClock,
  IconPlus,
  IconCalendarDays,
  IconUser,
  IconLogOut,
} from './Icons'
import { useAuth } from '../auth/AuthContext'
import DailyLimitModal from './DailyLimitModal'

const NAV_ITEMS = [
  { to: '/hoy', label: 'Hoy', Icon: IconClock },
  { to: '/crear', label: 'Crear evento', Icon: IconPlus },
  { to: '/eventos', label: 'Eventos', Icon: IconCalendarDays },
]

export default function Sidebar({ isMobileOpen, onCloseMobile }) {
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  // El useState va AQUÍ ADENTRO:
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
  }

  return (
    <>
      {/* Backdrop móvil */}
      {isMobileOpen && (
        <div
          className="mobile-backdrop"
          role="button"
          tabIndex={0}
          aria-label="Cerrar menú"
          onClick={onCloseMobile}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onCloseMobile()
            }
          }}
        />
      )}

      <aside className={`main-sidebar ${isMobileOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          {/* Marca */}
          <div className="brand-header">
            <div className="brand-logo-box" aria-hidden="true">
              <IconCalendar size={22} />
            </div>
            <div className="brand-text">
              <span className="brand-title">Organizador de Eventos</span>
              <p className="brand-subtitle">Gestión logística</p>
            </div>
          </div>

          {/* Menú vertical de navegación */}
          <nav className="sidebar-nav" aria-label="Navegación principal">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onCloseMobile}
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Perfil del organizador autenticado con configuración US-12 */}
        <div className="sidebar-bottom">
          <div className="profile-card">
            <div className="profile-avatar" aria-hidden="true">
              <IconUser size={16} />
            </div>
            <div className="profile-info">
              <p className="profile-name">{fullName}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <p className="profile-limit" style={{ margin: 0 }}>
                  Límite: {user?.daily_hours_limit ?? 6} h/día
                </p>
                <button
                  type="button"
                  className="btn-sec-pro btn-small"
                  style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', cursor: 'pointer' }}
                  onClick={() => setIsLimitModalOpen(true)}
                  title="Cambiar límite diario de horas (US-12)"
                >
                  Cambiar
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn-logout"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <IconLogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Modal para configurar límite diario (US-12) */}
      <DailyLimitModal
        isOpen={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
      />
    </>
  )
}