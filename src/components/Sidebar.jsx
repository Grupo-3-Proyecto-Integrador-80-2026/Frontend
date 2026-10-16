import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  IconCalendar,
  IconClock,
  IconPlus,
  IconCalendarDays,
  IconBarChart,
  IconUser,
  IconLogOut,
} from './Icons'
import { useAuth } from '../auth/AuthContext'
import DailyLimitModal from './DailyLimitModal'

const NAV_ITEMS = [
  { to: '/hoy', label: 'Hoy', Icon: IconClock },
  { to: '/crear', label: 'Crear evento', Icon: IconPlus },
  { to: '/eventos', label: 'Eventos', Icon: IconCalendarDays },
  { to: '/progreso', label: 'Progreso', Icon: IconBarChart },
]

export default function Sidebar({ isMobileOpen, onCloseMobile }) {
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)

  const sidebarRef = useRef(null)

  // Menú móvil abierto: el foco entra al menú, Escape lo cierra y al cerrarse
  // el foco vuelve al botón que lo abrió
  useEffect(() => {
    if (!isMobileOpen) return undefined

    const opener = document.activeElement
    sidebarRef.current?.querySelector('a, button')?.focus()

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCloseMobile()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [isMobileOpen, onCloseMobile])

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
  }

  return (
    <>
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

      <aside
        id="main-sidebar"
        ref={sidebarRef}
        className={`main-sidebar ${isMobileOpen ? 'open' : ''}`}
      >
        <div className="sidebar-top">
          <div className="brand-header">
            <div className="brand-logo-box" aria-hidden="true">
              <IconCalendar size={22} />
            </div>
            <div className="brand-text">
              <span className="brand-title">Organizador de Eventos</span>
              <p className="brand-subtitle">Gestión logística</p>
            </div>
          </div>

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

        <div className="sidebar-bottom">
          <div className="profile-container">
            {/* Fila 1: Usuario y Logout */}
            <div className="profile-user-row">
              <div className="profile-avatar" aria-hidden="true">
                <IconUser size={16} />
              </div>
              <div className="profile-info truncate">
                <p className="profile-name truncate" title={fullName}>{fullName}</p>
              </div>
              <button
                type="button"
                className="btn-logout"
                onClick={handleLogout}
                disabled={isLoggingOut}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <IconLogOut size={16} />
              </button>
            </div>

            {/* Fila 2: Chip / Botón de límite diario */}
            <button
              type="button"
              className="btn-limit-card"
              onClick={() => setIsLimitModalOpen(true)}
              title="Click para cambiar el límite diario de horas"
            >
              <div className="btn-limit-left">
                <IconClock size={14} className="icon-limit" />
                <span>Límite diario:</span>
              </div>
              <span className="limit-value-badge">
                {user?.daily_hours_limit ?? 6}h / día
              </span>
            </button>
          </div>
        </div>
      </aside>

      {isLimitModalOpen && <DailyLimitModal onClose={() => setIsLimitModalOpen(false)} />}
    </>
  )
}