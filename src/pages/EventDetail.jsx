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
  validateEventField,
  validateEventForm,
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

const INITIAL_EVENT_FORM_STATE = {
  name: '',
  event_type: '',
  contact: '',
  location: '',
  event_date: '',
  status: 'planning',
  description: '',
}

const INITIAL_SUBTASK_FORM_STATE = {
  name: '',
  type: '',
  scheduled_date: '',
  estimated_hours: '',
  priority: 'medium',
  note: '',
}

const EMPTY_FEEDBACK = { type: null, message: '', details: null }

// Traduce el valor crudo del backend a su etiqueta en español
function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || 'No especificado'
}

// Precarga el formulario de edición del evento con los valores actuales (fecha en DD/MM/AAAA)
function buildEventFormValues(eventData) {
  return {
    name: eventData.name || '',
    event_type: eventData.event_type || '',
    contact: eventData.contact || '',
    location: eventData.location || '',
    event_date: eventData.event_date ? formatDateFromISO(eventData.event_date) : '',
    status: eventData.status || 'planning',
    description: eventData.description || '',
  }
}

// Precarga el formulario de edición de una gestión con sus valores actuales
function buildSubtaskFormValues(task) {
  const hours = task.estimated_hours
  return {
    name: task.name || '',
    type: task.type || '',
    scheduled_date: task.scheduled_date ? formatDateFromISO(task.scheduled_date) : '',
    estimated_hours: hours != null && hours !== '' ? String(hours) : '',
    priority: task.priority || 'medium',
    note: task.note || '',
    status: task.status || 'pending',
  }
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
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK)
  const [showSubtaskForm, setShowSubtaskForm] = useState(false)

  // Estado controlado de la edición del evento
  const [isEditingEvent, setIsEditingEvent] = useState(false)
  const [eventForm, setEventForm] = useState(INITIAL_EVENT_FORM_STATE)
  const [eventErrors, setEventErrors] = useState({})
  const [eventTouched, setEventTouched] = useState({})
  const [isEventSubmitting, setIsEventSubmitting] = useState(false)
  const [eventFeedback, setEventFeedback] = useState(EMPTY_FEEDBACK)

  // Formularios de edición de gestiones, indexados por id de subtarea:
  // cada uno tiene su propio feedback y su propio isSubmitting,
  // de modo que editar una gestión no bloquea a otra ni al formulario del evento.
  const [editingSubtasks, setEditingSubtasks] = useState({})

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
    setFeedback(EMPTY_FEEDBACK)

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
    setFeedback(EMPTY_FEEDBACK)
  }

  /* ===================== Edición del evento (PATCH) ===================== */

  // Activa el modo edición precargando el formulario con los datos actuales
  const handleStartEditEvent = () => {
    setEventForm(buildEventFormValues(event))
    setEventErrors({})
    setEventTouched({})
    setEventFeedback(EMPTY_FEEDBACK)
    setIsEditingEvent(true)
  }

  // Cancela la edición y vuelve a la vista de solo lectura
  const handleCancelEditEvent = () => {
    setIsEditingEvent(false)
    setEventErrors({})
    setEventTouched({})
    setEventFeedback(EMPTY_FEEDBACK)
  }

  const handleChangeEvent = (e) => {
    const { name, value } = e.target

    // Auto-formatear fecha a DD/MM/AAAA mientras el usuario escribe
    const finalValue = name === 'event_date' ? autoFormatDateInput(value) : value

    setEventForm((prev) => ({
      ...prev,
      [name]: finalValue,
    }))

    // Si el campo ya fue visitado o ya tenía error, re-validamos en tiempo real
    if (eventTouched[name] || eventErrors[name]) {
      const fieldError = validateEventField(name, finalValue)
      setEventErrors((prev) => ({
        ...prev,
        [name]: fieldError,
      }))
    }
  }

  const handleBlurEvent = (e) => {
    const { name, value } = e.target
    setEventTouched((prev) => ({
      ...prev,
      [name]: true,
    }))

    const fieldError = validateEventField(name, value)
    setEventErrors((prev) => ({
      ...prev,
      [name]: fieldError,
    }))
  }

  const handleSubmitEvent = async (e) => {
    e.preventDefault()
    setEventFeedback(EMPTY_FEEDBACK)

    // Marcar todos los campos como tocados al intentar enviar
    const allTouched = Object.keys(eventForm).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setEventTouched(allTouched)

    // Validar todos los campos
    const formErrors = validateEventForm(eventForm)
    setEventErrors(formErrors)

    if (Object.keys(formErrors).length > 0) {
      setEventFeedback({
        type: 'error',
        message: 'Por favor, corrige los errores en los campos requeridos antes de guardar.',
      })
      return
    }

    setIsEventSubmitting(true)

    const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

    // Convertir la fecha DD/MM/AAAA al formato ISO AAAA-MM-DD esperado por Django REST Framework
    const payload = {
      name: eventForm.name.trim(),
      event_type: eventForm.event_type,
      contact: eventForm.contact.trim(),
      location: eventForm.location.trim(),
      event_date: formatDateToISO(eventForm.event_date),
      status: eventForm.status,
      description: eventForm.description.trim(),
    }

    try {
      const response = await fetch(`${baseUrl}/api/events/${id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          (data.details ? JSON.stringify(data.details) : 'Error al guardar el evento en el servidor.')
        )
      }

      // El PATCH devuelve el evento completo (incluye subtasks): se reemplaza
      // el estado local sin volver a hacer GET y se regresa a la vista de solo lectura
      setEvent(data)
      setIsEditingEvent(false)
      setEventErrors({})
      setEventTouched({})
      setEventFeedback({
        type: 'success',
        message: `¡Evento "${data.name}" actualizado con éxito!`,
        details: data,
      })
    } catch (err) {
      // En un fallo de conexión no se cierra el formulario: lo escrito se conserva
      console.error(err)
      setEventFeedback({
        type: 'error',
        message:
          err instanceof TypeError || !err.message
            ? 'Error de conexión con el servidor. Inténtalo nuevamente.'
            : err.message,
      })
    } finally {
      setIsEventSubmitting(false)
    }
  }

  /* =================== Edición de gestiones (PATCH) =================== */

  // Actualiza parcialmente el formulario de edición de una gestión
  const updateEditingSubtask = (subtaskId, patch) => {
    setEditingSubtasks((prev) =>
      prev[subtaskId] ? { ...prev, [subtaskId]: { ...prev[subtaskId], ...patch } } : prev
    )
  }

  const handleStartEditSubtask = (task) => {
    setEditingSubtasks((prev) => ({
      ...prev,
      [task.id]: {
        form: buildSubtaskFormValues(task),
        errors: {},
        touched: {},
        isSubmitting: false,
        feedback: EMPTY_FEEDBACK,
      },
    }))
  }

  const handleCancelEditSubtask = (subtaskId) => {
    setEditingSubtasks((prev) => {
      const next = { ...prev }
      delete next[subtaskId]
      return next
    })
  }

  const handleChangeSubtaskEdit = (subtaskId, e) => {
    const { name, value } = e.target

    // Auto-formatear fecha a DD/MM/AAAA mientras el usuario escribe
    const finalValue = name === 'scheduled_date' ? autoFormatDateInput(value) : value

    setEditingSubtasks((prev) => {
      const entry = prev[subtaskId]
      if (!entry) return prev

      const nextEntry = {
        ...entry,
        form: { ...entry.form, [name]: finalValue },
      }

      // Si el campo ya fue visitado o ya tenía error, re-validamos en tiempo real
      if (entry.touched[name] || entry.errors[name]) {
        nextEntry.errors = {
          ...entry.errors,
          [name]: validateSubtaskField(name, finalValue),
        }
      }

      return { ...prev, [subtaskId]: nextEntry }
    })
  }

  const handleBlurSubtaskEdit = (subtaskId, e) => {
    const { name, value } = e.target

    setEditingSubtasks((prev) => {
      const entry = prev[subtaskId]
      if (!entry) return prev

      return {
        ...prev,
        [subtaskId]: {
          ...entry,
          touched: { ...entry.touched, [name]: true },
          errors: { ...entry.errors, [name]: validateSubtaskField(name, value) },
        },
      }
    })
  }

  const handleSubmitSubtaskEdit = async (subtaskId, e) => {
    e.preventDefault()

    const entry = editingSubtasks[subtaskId]
    if (!entry) return

    // Marcar todos los campos como tocados al intentar enviar
    const allTouched = Object.keys(entry.form).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})

    // Validar todos los campos
    const formErrors = validateSubtaskForm(entry.form)
    const hasErrors = Object.keys(formErrors).length > 0

    setEditingSubtasks((prev) => {
      const current = prev[subtaskId]
      if (!current) return prev

      return {
        ...prev,
        [subtaskId]: {
          ...current,
          touched: allTouched,
          errors: formErrors,
          feedback: hasErrors
            ? {
                type: 'error',
                message: 'Por favor, corrige los errores en los campos requeridos antes de guardar.',
                details: null,
              }
            : EMPTY_FEEDBACK,
        },
      }
    })

    if (hasErrors) return

    updateEditingSubtask(subtaskId, { isSubmitting: true })

    const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

    // Convertir la fecha DD/MM/AAAA al formato ISO AAAA-MM-DD esperado por Django REST Framework
    const payload = {
      name: entry.form.name.trim(),
      type: entry.form.type,
      scheduled_date: formatDateToISO(entry.form.scheduled_date),
      estimated_hours: Number(entry.form.estimated_hours),
      priority: entry.form.priority,
      note: entry.form.note.trim(),
      status: entry.form.status,
    }

    try {
      const response = await fetch(`${baseUrl}/api/subtasks/${subtaskId}/`, {
        method: 'PATCH',
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

      // Reemplaza solo esa gestión dentro de event.subtasks buscándola por id,
      // sin volver a pedir el evento completo al backend
      setEvent((prev) => ({
        ...prev,
        subtasks: (Array.isArray(prev.subtasks) ? prev.subtasks : []).map((subtask) =>
          subtask.id === subtaskId ? data : subtask
        ),
      }))

      handleCancelEditSubtask(subtaskId)

      setFeedback({
        type: 'success',
        message: `¡Gestión "${data.name}" actualizada con éxito!`,
        details: data,
      })
    } catch (err) {
      // En un fallo de conexión no se cierra el formulario: lo escrito se conserva
      console.error(err)
      updateEditingSubtask(subtaskId, {
        feedback: {
          type: 'error',
          message:
            err instanceof TypeError || !err.message
              ? 'Error de conexión con el servidor. Inténtalo nuevamente.'
              : err.message,
          details: null,
        },
      })
    } finally {
      updateEditingSubtask(subtaskId, { isSubmitting: false })
    }
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
      {/* Feedback de la edición del evento (éxito tras guardar) */}
      {eventFeedback.type === 'success' && (
        <div className="banner-alert banner-success" role="alert">
          <div className="banner-icon-side">
            <IconCheckCircle size={20} className="icon-emerald" />
          </div>
          <div className="banner-content">
            <strong>{eventFeedback.message}</strong>
            {eventFeedback.details?.event_date && (
              <p className="banner-subtext">
                Tipo: {getOptionLabel(EVENT_TYPES, eventFeedback.details.event_type)} &bull; Fecha:{' '}
                {formatDateFromISO(eventFeedback.details.event_date)}
              </p>
            )}
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="btn-alert-primary"
              onClick={() => setEventFeedback(EMPTY_FEEDBACK)}
            >
              Cerrar aviso
            </button>
          </div>
        </div>
      )}

      <div className="form-card-pro">
        <div className="form-card-header">
          <div>
            <h2 className="form-heading">{isEditingEvent ? 'Editar Evento' : event.name}</h2>
            {isEditingEvent ? (
              <p className="form-subheading">Actualiza la información principal de la ficha</p>
            ) : (
              <p className="form-subheading">
                <span className="badge-status-chip">{getOptionLabel(EVENT_STATUSES, event.status)}</span>{' '}
                • Tipo: {getOptionLabel(EVENT_TYPES, event.event_type)}
              </p>
            )}
          </div>
        </div>

        {isEditingEvent ? (
          <form onSubmit={handleSubmitEvent} noValidate className="form-body-pro">
            {/* Feedback de error de la edición del evento */}
            {eventFeedback.type === 'error' && (
              <div className="banner-alert banner-error" role="alert">
                <div className="banner-icon-side">
                  <IconAlertTriangle size={20} className="icon-rose" />
                </div>
                <div className="banner-content">
                  <strong>Atención:</strong> {eventFeedback.message}
                </div>
                <button
                  type="button"
                  className="btn-close-alert"
                  aria-label="Cerrar alerta"
                  onClick={() => setEventFeedback(EMPTY_FEEDBACK)}
                >
                  <IconX size={16} />
                </button>
              </div>
            )}

            {/* Nombre del Evento */}
            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="event-name" className="field-label">
                  Nombre del Evento <span className="req-star">*</span>
                </label>
                <span className="char-counter">
                  {eventForm.name.length}/200
                </span>
              </div>
              <input
                id="event-name"
                type="text"
                name="name"
                value={eventForm.name}
                onChange={handleChangeEvent}
                onBlur={handleBlurEvent}
                placeholder="Ej: Aniversario Corporativo 25 Años"
                className={`field-input ${eventTouched.name && eventErrors.name ? 'field-input-error' : ''}`}
                required
                maxLength={200}
                aria-invalid={eventTouched.name && !!eventErrors.name}
                aria-describedby={eventErrors.name ? 'event-name-error' : undefined}
              />
              {eventTouched.name && eventErrors.name && (
                <span id="event-name-error" className="field-error-text">
                  {eventErrors.name}
                </span>
              )}
            </div>

            {/* Fila: Tipo y Estado */}
            <div className="field-row-2">
              <div className="field-group">
                <label htmlFor="event-type" className="field-label">
                  Tipo de Evento <span className="req-star">*</span>
                </label>
                <select
                  id="event-type"
                  name="event_type"
                  value={eventForm.event_type}
                  onChange={handleChangeEvent}
                  onBlur={handleBlurEvent}
                  className={`field-input field-select ${eventTouched.event_type && eventErrors.event_type ? 'field-input-error' : ''}`}
                  required
                >
                  <option value="" disabled>
                    Selecciona un tipo
                  </option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {eventTouched.event_type && eventErrors.event_type && (
                  <span className="field-error-text">{eventErrors.event_type}</span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="event-status" className="field-label">
                  Estado del Evento <span className="req-star">*</span>
                </label>
                <select
                  id="event-status"
                  name="status"
                  value={eventForm.status}
                  onChange={handleChangeEvent}
                  onBlur={handleBlurEvent}
                  className={`field-input field-select ${eventTouched.status && eventErrors.status ? 'field-input-error' : ''}`}
                  required
                >
                  {EVENT_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                {eventTouched.status && eventErrors.status && (
                  <span className="field-error-text">{eventErrors.status}</span>
                )}
              </div>
            </div>

            {/* Fila: Fecha Prevista (DD/MM/AAAA) y Contacto */}
            <div className="field-row-2">
              <div className="field-group">
                <label htmlFor="event-date" className="field-label">
                  Fecha Prevista (DD/MM/AAAA) <span className="req-star">*</span>
                </label>
                <input
                  id="event-date"
                  type="text"
                  name="event_date"
                  value={eventForm.event_date}
                  onChange={handleChangeEvent}
                  onBlur={handleBlurEvent}
                  placeholder="DD/MM/AAAA (ej. 28/10/2026)"
                  maxLength={10}
                  className={`field-input ${eventTouched.event_date && eventErrors.event_date ? 'field-input-error' : ''}`}
                  required
                  aria-invalid={eventTouched.event_date && !!eventErrors.event_date}
                  aria-describedby={eventErrors.event_date ? 'event-date-error' : 'event-date-hint'}
                />
                <small id="event-date-hint" className="field-hint">
                  Formato: <strong>DD/MM/AAAA</strong> (Día/Mes/Año)
                </small>
                {eventTouched.event_date && eventErrors.event_date && (
                  <span id="event-date-error" className="field-error-text">
                    {eventErrors.event_date}
                  </span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="event-contact" className="field-label">
                  Cliente / Contacto
                </label>
                <input
                  id="event-contact"
                  type="text"
                  name="contact"
                  value={eventForm.contact}
                  onChange={handleChangeEvent}
                  onBlur={handleBlurEvent}
                  placeholder="Ej: Grupo Financiero Andino"
                  maxLength={255}
                  className={`field-input ${eventTouched.contact && eventErrors.contact ? 'field-input-error' : ''}`}
                />
                {eventTouched.contact && eventErrors.contact && (
                  <span className="field-error-text">{eventErrors.contact}</span>
                )}
              </div>
            </div>

            {/* Lugar / Recinto */}
            <div className="field-group">
              <label htmlFor="event-location" className="field-label">
                Lugar / Recinto
              </label>
              <input
                id="event-location"
                type="text"
                name="location"
                value={eventForm.location}
                onChange={handleChangeEvent}
                onBlur={handleBlurEvent}
                placeholder="Ej: Club Campestre Central, Salón Principal"
                maxLength={255}
                className={`field-input ${eventTouched.location && eventErrors.location ? 'field-input-error' : ''}`}
              />
              {eventTouched.location && eventErrors.location && (
                <span className="field-error-text">{eventErrors.location}</span>
              )}
            </div>

            {/* Descripción / Notas */}
            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="event-description" className="field-label">
                  Descripción o Alcance Técnico
                </label>
                <span className="char-counter">
                  {eventForm.description.length}/2000
                </span>
              </div>
              <textarea
                id="event-description"
                name="description"
                value={eventForm.description}
                onChange={handleChangeEvent}
                onBlur={handleBlurEvent}
                placeholder="Notas para el montaje, requerimientos logísticos o acuerdos con el cliente..."
                rows="3"
                maxLength={2000}
                className={`field-input field-textarea ${eventTouched.description && eventErrors.description ? 'field-input-error' : ''}`}
              />
              {eventTouched.description && eventErrors.description && (
                <span className="field-error-text">{eventErrors.description}</span>
              )}
            </div>

            {/* Botones de acción */}
            <div className="form-actions-row">
              <button
                type="button"
                className="btn-cancel-pro"
                onClick={handleCancelEditEvent}
                disabled={isEventSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-submit-pro"
                disabled={isEventSubmitting}
              >
                {isEventSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        ) : (
          <div className="form-body-pro">
            <div className="event-detail-row">
              <IconCalendar size={18} className="text-brand-icon" />
              <span><strong>Fecha:</strong> {event.event_date ? formatDateFromISO(event.event_date) : 'N/A'}</span>
            </div>

            <div className="event-detail-row">
              <IconUser size={18} className="text-brand-icon" />
              <span><strong>Cliente/Contacto:</strong> {event.contact || 'No especificado'}</span>
            </div>

            <div className="event-detail-row">
              <IconMapPin size={18} className="text-brand-icon" />
              <span><strong>Lugar:</strong> {event.location || 'No especificado'}</span>
            </div>

            <div className="field-group">
              <span className="field-label">Descripción</span>
              <p className="detail-desc-text">
                {event.description || <em className="muted">Sin descripción detallada.</em>}
              </p>
            </div>

            <div className="form-actions-row">
              <Link to="/" className="btn-sec-pro">
                Volver al Listado
              </Link>
              <button type="button" className="btn-primary-action" onClick={handleStartEditEvent}>
                Editar Evento
              </button>
            </div>
          </div>
        )}
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
                onClick={() => setFeedback(EMPTY_FEEDBACK)}
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
              onClick={() => setFeedback(EMPTY_FEEDBACK)}
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
            {subtasks.map((task) => {
              const editEntry = editingSubtasks[task.id]

              // Tarjeta en modo edición: formulario inline precargado
              if (editEntry) {
                return (
                  <div key={task.id} className="event-card-item">
                    <div className="event-card-top">
                      <span className="event-status-badge">Editando Gestión</span>
                      <span className="event-date">
                        <IconCalendar size={13} />
                        <span>
                          {task.scheduled_date ? formatDateFromISO(task.scheduled_date) : 'N/A'}
                        </span>
                      </span>
                    </div>

                    <form
                      className="event-edit-form"
                      onSubmit={(e) => handleSubmitSubtaskEdit(task.id, e)}
                      noValidate
                    >
                      {/* Feedback de error de esta edición */}
                      {editEntry.feedback.type === 'error' && (
                        <div className="banner-alert banner-error" role="alert">
                          <div className="banner-icon-side">
                            <IconAlertTriangle size={20} className="icon-rose" />
                          </div>
                          <div className="banner-content">
                            <strong>Atención:</strong> {editEntry.feedback.message}
                          </div>
                          <button
                            type="button"
                            className="btn-close-alert"
                            aria-label="Cerrar alerta"
                            onClick={() => updateEditingSubtask(task.id, { feedback: EMPTY_FEEDBACK })}
                          >
                            <IconX size={16} />
                          </button>
                        </div>
                      )}

                      {/* Nombre de la Gestión */}
                      <div className="field-group">
                        <div className="field-label-row">
                          <label htmlFor={`edit-subtask-${task.id}-name`} className="field-label">
                            Nombre de la Gestión <span className="req-star">*</span>
                          </label>
                          <span className="char-counter">
                            {editEntry.form.name.length}/200
                          </span>
                        </div>
                        <input
                          id={`edit-subtask-${task.id}-name`}
                          type="text"
                          name="name"
                          value={editEntry.form.name}
                          onChange={(e) => handleChangeSubtaskEdit(task.id, e)}
                          onBlur={(e) => handleBlurSubtaskEdit(task.id, e)}
                          placeholder="Ej: Reservar el salón principal"
                          className={`field-input ${editEntry.touched.name && editEntry.errors.name ? 'field-input-error' : ''}`}
                          required
                          maxLength={200}
                          aria-invalid={editEntry.touched.name && !!editEntry.errors.name}
                          aria-describedby={editEntry.errors.name ? `edit-subtask-${task.id}-name-error` : undefined}
                        />
                        {editEntry.touched.name && editEntry.errors.name && (
                          <span id={`edit-subtask-${task.id}-name-error`} className="field-error-text">
                            {editEntry.errors.name}
                          </span>
                        )}
                      </div>

                      {/* Tipo de Gestión */}
                      <div className="field-group">
                        <label htmlFor={`edit-subtask-${task.id}-type`} className="field-label">
                          Tipo de Gestión <span className="req-star">*</span>
                        </label>
                        <select
                          id={`edit-subtask-${task.id}-type`}
                          name="type"
                          value={editEntry.form.type}
                          onChange={(e) => handleChangeSubtaskEdit(task.id, e)}
                          onBlur={(e) => handleBlurSubtaskEdit(task.id, e)}
                          className={`field-input field-select ${editEntry.touched.type && editEntry.errors.type ? 'field-input-error' : ''}`}
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
                        {editEntry.touched.type && editEntry.errors.type && (
                          <span className="field-error-text">{editEntry.errors.type}</span>
                        )}
                      </div>

                      {/* Fecha Programada */}
                      <div className="field-group">
                        <label htmlFor={`edit-subtask-${task.id}-date`} className="field-label">
                          Fecha Programada (DD/MM/AAAA) <span className="req-star">*</span>
                        </label>
                        <input
                          id={`edit-subtask-${task.id}-date`}
                          type="text"
                          name="scheduled_date"
                          value={editEntry.form.scheduled_date}
                          onChange={(e) => handleChangeSubtaskEdit(task.id, e)}
                          onBlur={(e) => handleBlurSubtaskEdit(task.id, e)}
                          placeholder="DD/MM/AAAA (ej. 28/10/2026)"
                          maxLength={10}
                          className={`field-input ${editEntry.touched.scheduled_date && editEntry.errors.scheduled_date ? 'field-input-error' : ''}`}
                          required
                          aria-invalid={editEntry.touched.scheduled_date && !!editEntry.errors.scheduled_date}
                          aria-describedby={editEntry.errors.scheduled_date ? `edit-subtask-${task.id}-date-error` : undefined}
                        />
                        {editEntry.touched.scheduled_date && editEntry.errors.scheduled_date && (
                          <span id={`edit-subtask-${task.id}-date-error`} className="field-error-text">
                            {editEntry.errors.scheduled_date}
                          </span>
                        )}
                      </div>

                      {/* Horas Estimadas */}
                      <div className="field-group">
                        <label htmlFor={`edit-subtask-${task.id}-hours`} className="field-label">
                          Horas Estimadas <span className="req-star">*</span>
                        </label>
                        <input
                          id={`edit-subtask-${task.id}-hours`}
                          type="number"
                          name="estimated_hours"
                          value={editEntry.form.estimated_hours}
                          onChange={(e) => handleChangeSubtaskEdit(task.id, e)}
                          onBlur={(e) => handleBlurSubtaskEdit(task.id, e)}
                          placeholder="Ej: 2.5"
                          min="0"
                          step="0.1"
                          className={`field-input ${editEntry.touched.estimated_hours && editEntry.errors.estimated_hours ? 'field-input-error' : ''}`}
                          required
                          aria-invalid={editEntry.touched.estimated_hours && !!editEntry.errors.estimated_hours}
                          aria-describedby={editEntry.errors.estimated_hours ? `edit-subtask-${task.id}-hours-error` : undefined}
                        />
                        {editEntry.touched.estimated_hours && editEntry.errors.estimated_hours && (
                          <span id={`edit-subtask-${task.id}-hours-error`} className="field-error-text">
                            {editEntry.errors.estimated_hours}
                          </span>
                        )}
                      </div>

                      {/* Prioridad y Estado */}
                      <div className="field-group">
                        <label htmlFor={`edit-subtask-${task.id}-priority`} className="field-label">
                          Prioridad
                        </label>
                        <select
                          id={`edit-subtask-${task.id}-priority`}
                          name="priority"
                          value={editEntry.form.priority}
                          onChange={(e) => handleChangeSubtaskEdit(task.id, e)}
                          onBlur={(e) => handleBlurSubtaskEdit(task.id, e)}
                          className="field-input field-select"
                        >
                          {TASK_PRIORITIES.map((priority) => (
                            <option key={priority.value} value={priority.value}>
                              {priority.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field-group">
                        <label htmlFor={`edit-subtask-${task.id}-status`} className="field-label">
                          Estado
                        </label>
                        <select
                          id={`edit-subtask-${task.id}-status`}
                          name="status"
                          value={editEntry.form.status}
                          onChange={(e) => handleChangeSubtaskEdit(task.id, e)}
                          onBlur={(e) => handleBlurSubtaskEdit(task.id, e)}
                          className="field-input field-select"
                        >
                          {SUBTASK_STATUS.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Nota */}
                      <div className="field-group">
                        <label htmlFor={`edit-subtask-${task.id}-note`} className="field-label">
                          Nota
                        </label>
                        <textarea
                          id={`edit-subtask-${task.id}-note`}
                          name="note"
                          value={editEntry.form.note}
                          onChange={(e) => handleChangeSubtaskEdit(task.id, e)}
                          onBlur={(e) => handleBlurSubtaskEdit(task.id, e)}
                          placeholder="Indicaciones adicionales para esta gestión..."
                          rows="3"
                          className="field-input field-textarea"
                        />
                      </div>

                      {/* Botones de acción */}
                      <div className="form-actions-row">
                        <button
                          type="button"
                          className="btn-cancel-pro"
                          onClick={() => handleCancelEditSubtask(task.id)}
                          disabled={editEntry.isSubmitting}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="btn-submit-pro"
                          disabled={editEntry.isSubmitting}
                        >
                          {editEntry.isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                      </div>
                    </form>
                  </div>
                )
              }

              // Tarjeta en modo solo lectura, con su botón de edición
              return (
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

                  <div className="event-card-footer">
                    <button
                      type="button"
                      className="btn-manage-event"
                      onClick={() => handleStartEditSubtask(task)}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
