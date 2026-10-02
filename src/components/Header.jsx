import { IconMenu } from './Icons'

// Encabezado de cada vista: título + una línea que explica para qué sirve.
// Reemplaza el antiguo "fecha • Jornada de Producción" y el buscador sin función.
export default function Header({ title, description, onToggleMobileMenu }) {
  return (
    <header className="main-header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
        {description && <p className="header-description">{description}</p>}
      </div>

      <div className="header-right">
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
