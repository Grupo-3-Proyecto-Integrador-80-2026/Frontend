import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  IconClock,
  IconInfo,
  IconCheckCircle,
  IconCalendar,
  IconMapPin,
  IconDollarSign,
  IconPlus,
} from '../components/Icons'

const DEFAULT_SAMPLE_EVENTS = [
  {
    id: 'event-1',
    name: 'Boda Lucía & Mateo',
    date: '28 Oct 2026',
    client: 'Lucía Fernández & Mateo Gómez',
    venue: 'Hacienda Los Almendros',
    totalBudget: '$24,500 USD',
    status: 'En Producción',
  },
  {
    id: 'event-2',
    name: 'Graduación Medicina',
    date: '3 Nov 2026',
    client: 'Facultad de Medicina - Promoción XLVIII',
    venue: 'Gran Salón Hotel Real',
    totalBudget: '$18,200 USD',
    status: 'En Producción',
  },
  {
    id: 'event-3',
    name: 'Festival de Verano',
    date: '15 Nov 2026',
    client: 'Asociación Cultural Ciudad Verde',
    venue: 'Parque Metropolitano Norte',
    totalBudget: '$45,000 USD',
    status: 'Planificación',
  },
]

export default function Home() {
  const [mensajeBackend, setMensajeBackend] = useState('Conectando con la API...')
  const [errorBackend, setErrorBackend] = useState(false)
  const [eventsList, setEventsList] = useState(DEFAULT_SAMPLE_EVENTS)

  const limitHours = 6.0
  const consumedHours = 3.5
  const percentage = Math.min(Math.round((consumedHours / limitHours) * 100), 100)
  const marginHours = Math.max(0, limitHours - consumedHours)

  const integrantes = [
    'Juan Pablo Escamilla Montilla - 202420580',
    'Santiago David Guerrero Jaramillo - 202419030',
    'Brayan Steven Candela Isaza - 202415014',
    'Nicolle Andrea Paz Molineros - 202419714',
  ]

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

    // Test DB connection
    fetch(`${baseUrl}/api/db-test/`)
      .then((res) => {
        if (!res.ok) throw new Error('Error en la respuesta del servidor')
        return res.json()
      })
      .then((data) => {
        setMensajeBackend(data.message)
        setErrorBackend(false)
      })
      .catch((err) => {
        console.error(err)
        setMensajeBackend('Error al conectar con la API / Base de datos')
        setErrorBackend(true)
      })

    // Try fetching events from backend API if available
    fetch(`${baseUrl}/api/events/`)
      .then((res) => {
        if (!res.ok) throw new Error('No se pudieron obtener los eventos')
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const formatted = data.map((ev) => ({
            id: ev.id,
            name: ev.name,
            date: ev.event_date || 'Por definir',
            client: ev.contact || 'Cliente no especificado',
            venue: ev.location || 'Lugar por definir',
            totalBudget: ev.event_type || 'General',
            status: ev.status === 'planning' ? 'Planificación' : ev.status === 'in_progress' ? 'En Producción' : 'Finalizado',
          }))
          setEventsList(formatted)
        }
      })
      .catch(() => {
        // Fallback to default sample events
      })
  }, [])

  return (
    <div className="home-container">
      {/* Top Widgets: Capacidad Diaria + Regla de Prioridad Activa */}
      <section className="top-widgets-grid">
        {/* Bloque 1: Tarjeta de Capacidad Diaria */}
        <div className="widget-card widget-capacity">
          <div className="widget-header">
            <div className="widget-title-group">
              <div className="widget-icon-box">
                <IconClock size={16} />
              </div>
              <div>
                <p className="widget-label">CAPACIDAD DIARIA</p>
                <h3 className="widget-heading">
                  {consumedHours.toFixed(1)} hrs ocupadas de {limitHours.toFixed(1)} hrs diarias
                </h3>
              </div>
            </div>
            <span className="badge-capacity">
              {percentage}% ocupada
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="progress-section">
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="progress-stats">
              <span>Consumido: <strong>{consumedHours.toFixed(1)} hrs</strong></span>
              <span className="text-brand">Margen disponible: {marginHours.toFixed(1)} hrs</span>
              <span>Límite: <strong>{limitHours.toFixed(1)} hrs</strong></span>
            </div>
          </div>
        </div>

        {/* Bloque 2: Regla de Prioridad */}
        <div className="widget-card widget-priority">
          <div className="priority-content">
            <div className="priority-icon-box">
              <IconInfo size={16} />
            </div>
            <div>
              <p className="priority-label">REGLA DE PRIORIDAD ACTIVA</p>
              <p className="priority-desc">
                Orden automático: Vencidas primero, luego gestiones de hoy por prioridad alta y duración estimada.
              </p>
            </div>
          </div>
          <div className="priority-footer">
            <span className="priority-tag">
              <IconCheckCircle size={14} />
              <span>Criterio equilibrado</span>
            </span>
            <span className="priority-count">{eventsList.length} eventos activos</span>
          </div>
        </div>
      </section>

      {/* Sección de Diagnóstico y Academia */}
      <section className="section-grid">
        {/* Estado Backend */}
        <div className="card-pro">
          <div className="card-pro-header">
            <h3>Estado Backend &amp; BD</h3>
            <span className={`status-pill ${errorBackend ? 'pill-error' : 'pill-success'}`}>
              {errorBackend ? 'Sin conexión' : 'Conectado'}
            </span>
          </div>
          <p className={`status-message ${errorBackend ? 'text-error' : 'text-success'}`}>
            {mensajeBackend}
          </p>
          <p className="endpoint-hint">
            Endpoint consultado: <code>/api/db-test/</code>
          </p>
        </div>

        {/* Información Académica */}
        <div className="card-pro">
          <div className="card-pro-header">
            <h3>Información Académica</h3>
            <span className="badge-chip">Sprint 1</span>
          </div>
          <div className="info-row">
            <span className="info-key">Curso:</span>
            <span className="info-val">Proyecto Integrador I (750018C)</span>
          </div>
          <div className="info-row">
            <span className="info-key">Profesor:</span>
            <span className="info-val">Fabián S. Valencia C.</span>
          </div>
          <div className="info-row">
            <span className="info-key">Semestre:</span>
            <span className="info-val">2026-II</span>
          </div>
        </div>
      </section>

      {/* Cartera de Eventos Activos */}
      <section className="events-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Eventos Activos en Cartera</h2>
            <p className="section-subtitle">Logística, fechas clave y presupuestos de montaje</p>
          </div>
          <Link to="/crear" className="btn-primary-action">
            <IconPlus size={16} />
            <span>Nuevo Evento</span>
          </Link>
        </div>

        <div className="events-cards-grid">
          {eventsList.map((ev) => (
            <div key={ev.id} className="event-card-item">
              <div className="event-card-top">
                <span className="event-status-badge">{ev.status}</span>
                <span className="event-date">
                  <IconCalendar size={13} />
                  <span>{ev.date}</span>
                </span>
              </div>

              <h3 className="event-name">{ev.name}</h3>
              <p className="event-client">Cliente: {ev.client}</p>

              <div className="event-details-list">
                <div className="event-detail-row">
                  <IconMapPin size={14} className="icon-map" />
                  <span className="truncate">{ev.venue}</span>
                </div>
                <div className="event-detail-row">
                  <IconDollarSign size={14} className="icon-dollar" />
                  <span>{ev.totalBudget}</span>
                </div>
              </div>

              <div className="event-card-footer">
                <Link to="/crear" className="btn-manage-event">
                  Gestionar en Mesa
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integrantes del Grupo */}
      <section className="team-section card-pro">
        <div className="card-pro-header">
          <h3>Integrantes del Grupo</h3>
          <span className="badge-chip">Grupo 3</span>
        </div>
        <div className="team-grid">
          {integrantes.map((member, idx) => (
            <div key={idx} className="team-card">
              <div className="team-avatar">
                {member.charAt(0)}
              </div>
              <span className="team-name">{member}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
