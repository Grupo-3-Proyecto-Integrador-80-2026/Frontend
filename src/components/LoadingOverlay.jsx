/**
 * Estado "cargando" moderno: el contenido de fondo (silueta o datos anteriores)
 * queda difuminado tras un velo con blur y una tarjeta flotante con spinner.
 *
 * - El fondo es `inert` y aria-hidden: no se puede enfocar ni lo lee el lector de pantalla.
 * - La tarjeta usa role="status" para anunciar la carga sin interrumpir.
 */
export default function LoadingOverlay({ label, children }) {
  return (
    <div className="loading-layer">
      <div className="loading-background" aria-hidden="true" inert>
        {children}
      </div>
      <div className="loading-overlay">
        <div className="loading-card" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <span>{label}</span>
        </div>
      </div>
    </div>
  )
}

// Silueta de la vista "Hoy": tres grupos con tarjetas fantasma
export function TodaySkeleton() {
  return (
    <div className="today-groups">
      {[2, 2, 3].map((cards, groupIndex) => (
        <div key={groupIndex} className="today-group">
          <div className="skeleton skeleton-heading" />
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="today-card skeleton-card">
              <div className="skeleton skeleton-line skeleton-line-lg" />
              <div className="skeleton skeleton-line skeleton-line-md" />
              <div className="skeleton skeleton-line skeleton-line-sm" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Silueta de la vista "Eventos": cuadrícula de tarjetas fantasma
export function EventsSkeleton() {
  return (
    <div className="events-cards-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="event-card-item skeleton-card">
          <div className="skeleton skeleton-line skeleton-line-sm" />
          <div className="skeleton skeleton-line skeleton-line-lg" />
          <div className="skeleton skeleton-line skeleton-line-md" />
          <div className="skeleton skeleton-line skeleton-line-md" />
          <div className="skeleton skeleton-button" />
        </div>
      ))}
    </div>
  )
}
