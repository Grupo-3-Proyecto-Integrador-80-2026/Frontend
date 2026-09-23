import { NavLink } from 'react-router-dom'
import {
  IconCalendar,
  IconPlus,
  IconClock,
  IconCalendarDays,
  IconRefresh,
} from './Icons'

export default function Sidebar({ isMobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="mobile-backdrop"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`main-sidebar ${isMobileOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          {/* Brand Logo */}
          <div className="brand-header">
            <div className="brand-logo-box">
              <IconCalendar size={22} className="text-white" />
            </div>
            <div className="brand-text">
              <span className="brand-title">Organizador de Eventos</span>
              <p className="brand-subtitle">Gestión Logística</p>
            </div>
          </div>

          {/* Botón Principal: + Crear Evento */}
          <NavLink
            to="/crear"
            onClick={onCloseMobile}
            className="btn-crear-sidebar"
          >
            <IconPlus size={18} />
            <span>Crear Evento</span>
          </NavLink>

          {/* Menú vertical de navegación */}
          <nav className="sidebar-nav">
            <div className="nav-section-title">OPERACIONES</div>

            {/* Pestaña: Hoy / Inicio */}
            <NavLink
              to="/"
              end
              onClick={onCloseMobile}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="nav-item-content">
                <div className="nav-item-icon">
                  <IconClock size={16} />
                </div>
                <span>Hoy</span>
              </div>
            </NavLink>

            {/* Pestaña: Crear Evento */}
            <NavLink
              to="/crear"
              onClick={onCloseMobile}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="nav-item-content">
                <div className="nav-item-icon">
                  <IconCalendarDays size={16} />
                </div>
                <span>Crear Evento</span>
              </div>
            </NavLink>
          </nav>
        </div>

        {/* Bottom Sidebar: Perfil del Organizador */}
        <div className="sidebar-bottom">
          <div className="profile-card">
            <div className="profile-avatar">
              <span>EM</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">Elena Morales</p>
              <div className="profile-status">
                <span className="status-dot"></span>
                <p className="profile-limit">Límite: 6.0 hrs/día</p>
              </div>
            </div>
          </div>

          <div className="sync-status">
            <span className="sync-left">
              <IconRefresh size={12} className="sync-icon" />
              <span>Sincronizado</span>
            </span>
            <span className="sync-time">En línea</span>
          </div>
        </div>
      </aside>
    </>
  )
}
