import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { IconMapPin, IconCalendar, IconUser, IconClock, IconInfo } from '../components/Icons'
import { formatDateFromISO, TASK_TYPES, TASK_PRIORITIES } from '../utils/validators'

const EVENT_TYPES = [
  { value: 'wedding', label: 'Boda' },
  { value: 'social', label: 'Social' },
  { value: 'corporate', label: 'Corporativo' },
  { value: 'birthday', label: 'Cumpleaños' },
  { value: 'other', label: 'Otro' },
]

const EVENT_STATUS = [
  { value: 'planning', label: 'Planificación' },
  { value: 'in_progress', label: 'En Producción' },
  { value: 'finished', label: 'Finalizado' },
]

const SUBTASK_STATUS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'done', label: 'Completada' },
  { value: 'postponed', label: 'Aplazada' },
]

// Traduce el valor crudo del backend a su etiqueta en español
function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || 'No especificado'
}

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

  const subtasks = Array.isArray(event.subtasks) ? event.subtasks : []

  return (
    <div className="create-page-container">
      <div className="form-card-pro">
        <div className="form-card-header">
          <div>
            <h2 className="form-heading">{event.name}</h2>
            <p className="form-subheading">
              <span className="badge-status-chip">{getOptionLabel(EVENT_STATUS, event.status)}</span>{' '}
              • Tipo: {getOptionLabel(EVENT_TYPES, event.event_type)}
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

      {/* Gestiones (subtareas logísticas) del evento */}
      <section className="events-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Gestiones del Evento</h2>
            <p className="section-subtitle">Subtareas logísticas para mantener la producción en marcha</p>
          </div>
          <span className="badge-chip">
            {subtasks.length} {subtasks.length === 1 ? 'gestión' : 'gestiones'}
          </span>
        </div>

        {subtasks.length === 0 ? (
          <div className="card-pro">
            <p className="muted">
              Aún no hay gestiones en este evento. Agrega la primera para empezar a organizar la logística.
            </p>
          </div>
        ) : (
          <div className="events-cards-grid">
            {subtasks.map((task) => (
              <div key={task.id} className="event-card-item">
                <div className="event-card-top">
                  <span className="event-status-badge">
                    {getOptionLabel(SUBTASK_STATUS, task.status)}
                  </span>
                  <span className="event-date">
                    <IconCalendar size={13} />
                    <span>
                      {task.scheduled_date ? formatDateFromISO(task.scheduled_date) : 'N/A'}
                    </span>
                  </span>
                </div>

                <h3 className="event-name">{task.name}</h3>
                <p className="event-client">Tipo: {getOptionLabel(TASK_TYPES, task.type)}</p>

                <div className="event-details-list">
                  <div className="event-detail-row">
                    <IconClock size={14} />
                    <span>
                      Horas estimadas:{' '}
                      {task.estimated_hours != null && task.estimated_hours !== ''
                        ? `${Number(task.estimated_hours).toFixed(1)} hrs`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="event-detail-row">
                    <IconInfo size={14} />
                    <span>Prioridad: {getOptionLabel(TASK_PRIORITIES, task.priority)}</span>
                  </div>
                </div>

                {task.note && <p className="event-client">Nota: {task.note}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
