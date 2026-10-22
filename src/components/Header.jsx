import { IconMenu } from './Icons'

// Encabezado de cada vista: título + una línea que explica para qué sirve.
// Reemplaza el antiguo "fecha • Jornada de Producción" y el buscador sin función.
export default function Header({
  title,
  description,
  isMobileMenuOpen = false,
  onToggleMobileMenu,
  actions = null,
}) {
  return (
    <header className="main-header">
      <button
        onClick={onToggleMobileMenu}
        className="btn-mobile-menu"
        aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="main-sidebar"
        type="button"
      >
        <IconMenu size={22} />
      </button>

      <div className="header-left">
        <h1 className="header-title">{title}</h1>
        {description && <p className="header-description">{description}</p>}
      </div>

      <div className="header-right">{actions}</div>
    </header>
  )
}
