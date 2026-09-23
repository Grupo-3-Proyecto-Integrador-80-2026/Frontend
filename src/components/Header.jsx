import { useState } from 'react'
import { IconSearch, IconMenu, IconX } from './Icons'

export default function Header({
  title,
  subtitle = 'Jornada de Producción',
  onToggleMobileMenu,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <header className="main-header">
      <div className="header-left">
        <div className="header-meta">
          <span className="date-badge">
            Jueves, 24 de Octubre
          </span>
          <span className="meta-separator">•</span>
          <span className="subtitle-text">{subtitle}</span>
        </div>
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        {/* Buscador Compacto */}
        <div className="search-box">
          <div className="search-icon-wrapper">
            <IconSearch size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar gestión, evento o proveedor..."
            className="search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="search-clear-btn"
              type="button"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={onToggleMobileMenu}
          className="btn-mobile-menu"
          aria-label="Abrir menú"
          type="button"
        >
          <IconMenu size={22} />
        </button>
      </div>
    </header>
  )
}
