import { useEffect, useState } from 'react'
import { IconCalendar } from './Icons'

// Pasado este tiempo se avisa que el servidor puede estar arrancando (Render en frío)
const SLOW_NOTICE_MS = 5000

/**
 * Pantalla de carga mientras se consulta /api/auth/me/ (US-11).
 *
 * - role="status" anuncia el mensaje sin interrumpir al lector de pantalla.
 * - Si la verificación tarda, se explica la espera en lugar de dejar solo el spinner.
 * - Las animaciones se desactivan con prefers-reduced-motion (ver App.css).
 */
export default function SessionCheck() {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    const timerId = setTimeout(() => setIsSlow(true), SLOW_NOTICE_MS)
    return () => clearTimeout(timerId)
  }, [])

  return (
    <main className="session-check">
      <div className="session-check-blob session-check-blob-a" aria-hidden="true" />
      <div className="session-check-blob session-check-blob-b" aria-hidden="true" />

      <div className="session-check-card" role="status" aria-live="polite">
        <div className="session-check-logo" aria-hidden="true">
          <span className="session-check-ring" />
          <span className="session-check-pulse" />
          <span className="session-check-logo-box">
            <IconCalendar size={30} />
          </span>
        </div>

        <p className="session-check-brand">Organizador de Eventos</p>

        <p className="session-check-title">
          Verificando tu sesión
          <span className="session-check-dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>

        <div className="session-check-bar" aria-hidden="true">
          <span className="session-check-bar-fill" />
        </div>

        {isSlow && (
          <p className="session-check-hint">
            Estamos activando el servidor. La primera carga puede tardar hasta un minuto.
          </p>
        )}
      </div>
    </main>
  )
}
