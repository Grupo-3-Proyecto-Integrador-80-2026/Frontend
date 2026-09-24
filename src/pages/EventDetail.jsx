import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  IconMapPin,
  IconCalendar,
  IconUser,
  IconClock,
  IconInfo,
  IconPlus,
  IconCheckCircle,
  IconAlertTriangle,
  IconX,
} from '../components/Icons'
import {
  formatDateFromISO,
  formatDateToISO,
  autoFormatDateInput,
  validateSubtaskField,
  validateSubtaskForm,
  EVENT_TYPES,
  EVENT_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
} from '../utils/validators'

const SUBTASK_STATUS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'done', label: 'Completada' },
  { value: 'postponed', label: 'Aplazada' },
]

const INITIAL_SUBTASK_FORM_STATE = {
  name: '',
  type: '',
  scheduled_date: '',
  estimated_hours: '',
  priority: 'medium',
  note: '',
}

// Traduce el valor crudo del backend a su etiqueta en español
function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || 'No especificado'
}

export default function EventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Estado controlado del formulario de creación de gestiones
  const [subtaskForm, setSubtaskForm] = useState(INITIAL_SUBTASK_FORM_STATE)
  const [subtaskErrors, setSubtaskErrors] = useState({})
  const [subtaskTouched, setSubtaskTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ type: null, message: '', details: null })
  const [showSubtaskForm, setShowSubtaskForm] = useState(false)

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

  // Manejador de cambios con formateo DD/MM/AAAA y re-validación inmediata
  const handleChangeSubtask = (e) => {
    const { name, value } = e.target

    // Auto-formatear fecha a DD/MM/AAAA mientras el usuario escribe
    const finalValue = name === 'scheduled_date' ? autoFormatDateInput(value) : value

    setSubtaskForm((prev) => ({
      ...prev,
      [name]: finalValue,
    }))

    // Si el campo ya fue visitado o ya tenía error, re-validamos en tiempo real
    if (subtaskTouched[name] || subtaskErrors[name]) {
      const fieldError = validateSubtaskField(name, finalValue)
      setSubtaskErrors((prev) => ({
        ...prev,
        [name]: fieldError,
      }))
    }
  }

  // Manejador de pérdida de foco (onBlur) para validación inline
  const handleBlurSubtask = (e) => {
    const { name, value } = e.target
    setSubtaskTouched((prev) => ({
      ...prev,
      [name]: true,
    }))

    const fieldError = validateSubtaskField(name, value)
    setSubtaskErrors((prev) => ({
      ...prev,
      [name]: fieldError,
    }))
  }

  // Manejador del envío del formulario de gestión
  const handleSubmitSubtask = async (e) => {
    e.preventDefault()
    setFeedback({ type: null, message: '', details: null })

    // Marcar todos los campos como tocados al intentar enviar
    const allTouched = Object.keys(subtaskForm).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setSubtaskTouched(allTouched)

    // Validar todos los campos
    const formErrors = validateSubtaskForm(subtaskForm)
    setSubtaskErrors(formErrors)

    if (Object.keys(formErrors).length > 0) {
      setFeedback({
        type: 'error',
        message: 'Por favor, corrige los errores en los campos requeridos antes de guardar.',
      })
      return
    }

    setIsSubmitting(true)

    const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

    // Convertir la fecha DD/MM/AAAA al formato ISO AAAA-MM-DD esperado por Django REST Framework
    const isoScheduledDate = formatDateToISO(subtaskForm.scheduled_date)

    const payload = {
      name: subtaskForm.name.trim(),
      type: subtaskForm.type,
      scheduled_date: isoScheduledDate,
      estimated_hours: Number(subtaskForm.estimated_hours),
      priority: subtaskForm.priority,
      note: subtaskForm.note.trim(),
    }

    try {
      const response = await fetch(`${baseUrl}/api/events/${id}/subtasks/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          (data.details ? JSON.stringify(data.details) : 'Error al guardar la gestión en el servidor.')
        )
      }

      // Agregar la subtarea creada al estado local, sin volver a pedir el evento al backend
      setEvent((prev) => ({
        ...prev,
        subtasks: [...(Array.isArray(prev.subtasks) ? prev.subtasks : []), data],
      }))

      setFeedback({
        type: 'success',
        message: `¡Gestión "${data.name}" registrada con éxito!`,
        details: data,
      })

      // Limpiar el formulario para cargar la siguiente gestión
      setSubtaskForm(INITIAL_SUBTASK_FORM_STATE)
      setSubtaskErrors({})
      setSubtaskTouched({})
    } catch (err) {
      // En un fallo de conexión no se limpia el formulario: lo escrito se conserva
      console.error(err)
      setFeedback({
        type: 'error',
        message:
          err instanceof TypeError || !err.message
            ? 'Error de conexión con el servidor. Inténtalo nuevamente.'
            : err.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Restablecer formulario y estados de validación de la gestión
  const handleResetSubtask = () => {
    setSubtaskForm(INITIAL_SUBTASK_FORM_STATE)
    setSubtaskErrors({})
    setSubtaskTouched({})
    setFeedback({ type: null, message: '', details: null })
  }

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
              <span className="badge-status-chip">{getOptionLabel(EVENT_STATUSES, event.status)}</span>{' '}
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
          <div className="header-right">
            <span className="badge-chip">
              {subtasks.length} {subtasks.length === 1 ? 'gestión' : 'gestiones'}
            </span>
            <button
              type="button"
              className="btn-primary-action"
              onClick={() => setShowSubtaskForm((prev) => !prev)}
              aria-expanded={showSubtaskForm}
              aria-controls="subtask-form"
            >
              <IconPlus size={16} />
              <span>{showSubtaskForm ? 'Cerrar Formulario' : 'Nueva Gestión'}</span>
            </button>
          </div>
        </div>

        {/* Alerta de Feedback (Éxito o Error) */}
        {feedback.type === 'success' && (
          <div className="banner-alert banner-success" role="alert">
            <div className="banner-icon-side">
              <IconCheckCircle size={20} className="icon-emerald" />
            </div>
            <div className="banner-content">
              <strong>{feedback.message}</strong>
              {feedback.details?.id && (
                <p className="banner-subtext">
                  ID asignado: #{feedback.details.id} &bull; Tipo: {getOptionLabel(TASK_TYPES, feedback.details.type)} &bull; Fecha: {formatDateFromISO(feedback.details.scheduled_date)}
                </p>
              )}
            </div>
            <div className="banner-actions">
              <button
                type="button"
                className="btn-alert-primary"
                onClick={() => setFeedback({ type: null, message: '', details: null })}
              >
                Cerrar aviso
              </button>
            </div>
          </div>
        )}

        {feedback.type === 'error' && (
          <div className="banner-alert banner-error" role="alert">
            <div className="banner-icon-side">
              <IconAlertTriangle size={20} className="icon-rose" />
            </div>
            <div className="banner-content">
              <strong>Atención:</strong> {feedback.message}
            </div>
            <button
              type="button"
              className="btn-close-alert"
              aria-label="Cerrar alerta"
              onClick={() => setFeedback({ type: null, message: '', details: null })}
            >
              <IconX size={16} />
            </button>
          </div>
        )}

        {/* Formulario de creación de gestión */}
        {showSubtaskForm && (
          <div className="form-card-pro">
            <div className="form-card-header">
              <div className="header-icon-box">
                <IconPlus size={18} />
              </div>
              <div>
                <h2 className="form-heading">Nueva Gestión</h2>
                <p className="form-subheading">Registro de una subtarea logística del evento</p>
              </div>
            </div>

            <form
              id="subtask-form"
              onSubmit={handleSubmitSubtask}
              onReset={handleResetSubtask}
              noValidate
              className="form-body-pro"
            >
              {/* Nombre de la Gestión */}
              <div className="field-group">
                <div className="field-label-row">
                  <label htmlFor="subtask-name" className="field-label">
                    Nombre de la Gestión <span className="req-star">*</span>
                  </label>
                  <span className="char-counter">
                    {subtaskForm.name.length}/200
                  </span>
                </div>
                <input
                  id="subtask-name"
                  type="text"
                  name="name"
                  value={subtaskForm.name}
                  onChange={handleChangeSubtask}
                  onBlur={handleBlurSubtask}
                  placeholder="Ej: Reservar el salón principal"
                  className={`field-input ${subtaskTouched.name && subtaskErrors.name ? 'field-input-error' : ''}`}
                  required
                  maxLength={200}
                  aria-invalid={subtaskTouched.name && !!subtaskErrors.name}
                  aria-describedby={subtaskErrors.name ? 'subtask-name-error' : undefined}
                />
                {subtaskTouched.name && subtaskErrors.name && (
                  <span id="subtask-name-error" className="field-error-text">
                    {subtaskErrors.name}
                  </span>
                )}
              </div>

              {/* Fila: Tipo y Prioridad */}
              <div className="field-row-2">
                <div className="field-group">
                  <label htmlFor="subtask-type" className="field-label">
                    Tipo de Gestión <span className="req-star">*</span>
                  </label>
                  <select
                    id="subtask-type"
                    name="type"
                    value={subtaskForm.type}
                    onChange={handleChangeSubtask}
                    onBlur={handleBlurSubtask}
                    className={`field-input field-select ${subtaskTouched.type && subtaskErrors.type ? 'field-input-error' : ''}`}
                    required
                  >
                    <option value="" disabled>
                      Selecciona un tipo de gestión
                    </option>
                    {TASK_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {subtaskTouched.type && subtaskErrors.type && (
                    <span className="field-error-text">{subtaskErrors.type}</span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="subtask-priority" className="field-label">
                    Prioridad
                  </label>
                  <select
                    id="subtask-priority"
                    name="priority"
                    value={subtaskForm.priority}
                    onChange={handleChangeSubtask}
                    onBlur={handleBlurSubtask}
                    className="field-input field-select"
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fila: Fecha Programada y Horas Estimadas */}
              <div className="field-row-2">
                <div className="field-group">
                  <label htmlFor="subtask-date" className="field-label">
                    Fecha Programada (DD/MM/AAAA) <span className="req-star">*</span>
                  </label>
                  <input
                    id="subtask-date"
                    type="text"
                    name="scheduled_date"
                    value={subtaskForm.scheduled_date}
                    onChange={handleChangeSubtask}
                    onBlur={handleBlurSubtask}
                    placeholder="DD/MM/AAAA (ej. 28/10/2026)"
                    maxLength={10}
                    className={`field-input ${subtaskTouched.scheduled_date && subtaskErrors.scheduled_date ? 'field-input-error' : ''}`}
                    required
                    aria-invalid={subtaskTouched.scheduled_date && !!subtaskErrors.scheduled_date}
                    aria-describedby={subtaskErrors.scheduled_date ? 'subtask-date-error' : 'subtask-date-hint'}
                  />
                  <small id="subtask-date-hint" className="field-hint">
                    Formato: <strong>DD/MM/AAAA</strong> (Día/Mes/Año)
                  </small>
                  {subtaskTouched.scheduled_date && subtaskErrors.scheduled_date && (
                    <span id="subtask-date-error" className="field-error-text">
                      {subtaskErrors.scheduled_date}
                    </span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="subtask-hours" className="field-label">
                    Horas Estimadas <span className="req-star">*</span>
                  </label>
                  <input
                    id="subtask-hours"
                    type="number"
                    name="estimated_hours"
                    value={subtaskForm.estimated_hours}
                    onChange={handleChangeSubtask}
                    onBlur={handleBlurSubtask}
                    placeholder="Ej: 2.5"
                    min="0"
                    step="0.1"
                    className={`field-input ${subtaskTouched.estimated_hours && subtaskErrors.estimated_hours ? 'field-input-error' : ''}`}
                    required
                    aria-invalid={subtaskTouched.estimated_hours && !!subtaskErrors.estimated_hours}
                    aria-describedby={subtaskErrors.estimated_hours ? 'subtask-hours-error' : 'subtask-hours-hint'}
                  />
                  <small id="subtask-hours-hint" className="field-hint">
                    Número mayor a 0, con máximo 1 decimal.
                  </small>
                  {subtaskTouched.estimated_hours && subtaskErrors.estimated_hours && (
                    <span id="subtask-hours-error" className="field-error-text">
                      {subtaskErrors.estimated_hours}
                    </span>
                  )}
                </div>
              </div>

              {/* Nota */}
              <div className="field-group">
                <label htmlFor="subtask-note" className="field-label">
                  Nota
                </label>
                <textarea
                  id="subtask-note"
                  name="note"
                  value={subtaskForm.note}
                  onChange={handleChangeSubtask}
                  onBlur={handleBlurSubtask}
                  placeholder="Indicaciones adicionales para esta gestión..."
                  rows="3"
                  className="field-input field-textarea"
                />
              </div>

              {/* Botones de acción */}
              <div className="form-actions-row">
                <button
                  type="reset"
                  className="btn-sec-pro"
                  disabled={isSubmitting}
                >
                  Limpiar Formulario
                </button>
                <button
                  type="button"
                  className="btn-cancel-pro"
                  onClick={() => setShowSubtaskForm(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-submit-pro"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Gestión'}
                </button>
              </div>
            </form>
          </div>
        )}

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
