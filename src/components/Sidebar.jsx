import { NavLink } from 'react-router-dom'
import { IconClock, IconPlus, IconCalendarDays, IconUser } from './Icons'
import flozLogo from '../assets/floz-logo.png'

// Un único acceso por destino: "Crear evento" ya no se repite como botón aparte
const NAV_ITEMS = [
  { to: '/hoy', label: 'Hoy', Icon: IconClock },
  { to: '/crear', label: 'Crear evento', Icon: IconPlus },
  { to: '/eventos', label: 'Eventos', Icon: IconCalendarDays },
]

export default function Sidebar({ isMobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Mobile backdrop */}
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
          {/* Marca Floz */}
          <div className="brand-header">
            <img src={flozLogo} alt="" className="brand-logo-img" />
            <div className="brand-text">
              <span className="brand-title">Floz</span>
              <p className="brand-subtitle">Organizador de eventos</p>
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

        {/* Perfil: usuario demo hasta que se integre el login (US-11) */}
        <div className="sidebar-bottom">
          <div className="profile-card">
            <div className="profile-avatar" aria-hidden="true">
              <IconUser size={16} />
            </div>
            <div className="profile-info">
              <p className="profile-name">Organizador demo</p>
              <p className="profile-limit">Límite: 6 h de gestión al día</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
