import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { IconMapPin, IconCalendar, IconUser, IconClock } from '../components/Icons'
import { formatDateFromISO } from '../utils/validators'

export default function EventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
        const response = await fetch(`${baseUrl}/api/events/${id}/`)
        if (!response.ok) {
          throw new Error('No se pudo cargar el evento o no existe.')
        }
        const data = await response.json()
        setEvent(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [id])

  if (loading) {
    return (
      <div className="page-container">
        <p>Cargando detalles del evento...</p>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="page-container">
        <div className="banner-alert banner-error">
          <strong>Error:</strong> {error}
        </div>
        <Link to="/" className="btn-sec-pro" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Volver al Inicio
        </Link>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="form-card-pro">
        <div className="form-card-header">
          <div>
            <h2 className="form-heading">{event.name}</h2>
            <p className="form-subheading">
              <span className="badge-status-chip">{event.status}</span> • Tipo: {event.event_type}
            </p>
          </div>
        </div>

        <div className="form-body-pro" style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconCalendar size={18} className="text-brand-icon" />
            <span><strong>Fecha:</strong> {event.event_date ? formatDateFromISO(event.event_date) : 'N/A'}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconUser size={18} className="text-brand-icon" />
            <span><strong>Cliente/Contacto:</strong> {event.contact || 'No especificado'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconMapPin size={18} className="text-brand-icon" />
            <span><strong>Lugar:</strong> {event.location || 'No especificado'}</span>
          </div>

          <div>
            <strong>Descripción:</strong>
            <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-line', color: 'var(--slate-600)' }}>
              {event.description || 'Sin descripción detallada.'}
            </p>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--slate-200)' }}>
             <Link to="/" className="btn-sec-pro">
                Volver al Listado
             </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
