import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import OverloadConflictModal from '../components/OverloadConflictModal'
import PostponeModal from '../components/PostponeModal'
import ProgressBar from '../components/ProgressBar'
import SubtaskEditModal from '../components/SubtaskEditModal'
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
  IconRefresh,
  IconEdit,
  IconTrash,
} from '../components/Icons'
import ConfirmDialog from '../components/ConfirmDialog'
import DateField from '../components/DateField'
import DateWarning from '../components/DateWarning'
import HoursInput from '../components/HoursInput'
import StatusMessage from '../components/StatusMessage'
import useAutoDismiss from '../components/useAutoDismiss'
import { apiFetch } from '../api/client'
import {
  formatDateFromISO,
  todayISO,
  isAfterEventDate,
  getOptionLabel,
  validateEventField,
  validateEventForm,
  validateSubtaskField,
  validateSubtaskForm,
  EVENT_TYPES,
  EVENT_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../utils/validators'

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

function buildEventFormValues(eventData) {
  return {
    name: eventData.name || '',
    event_type: eventData.event_type || '',
    contact: eventData.contact || '',
    location: eventData.location || '',
    event_date: eventData.event_date || '',
    status: eventData.status || 'planning',
    description: eventData.description || '',
  }
}

/** Fecha programada más tardía entre las gestiones del evento (ISO), o null si no hay. */
function latestSubtaskDate(subtasks) {
  return (Array.isArray(subtasks) ? subtasks : []).reduce(
    (latest, t) => (t.scheduled_date && (!latest || t.scheduled_date > latest) ? t.scheduled_date : latest),
    null
  )
}

function subtasksProgressKey(subtasks) {
  return (Array.isArray(subtasks) ? subtasks : []).map((t) => `${t.id}:${t.status}`).join(',')
}

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)

  const [conflictState, setConflictState] = useState(null)
  const [postponeState, setPostponeState] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const loadKey = `${id}|${attempt}`
  const [loadResult, setLoadResult] = useState({ key: null, error: null })

  const [subtaskForm, setSubtaskForm] = useState(INITIAL_SUBTASK_FORM_STATE)
  const [subtaskErrors, setSubtaskErrors] = useState({})
  const [subtaskTouched, setSubtaskTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK)
  const [showSubtaskForm, setShowSubtaskForm] = useState(false)

  const [isEditingEvent, setIsEditingEvent] = useState(false)
  const [eventForm, setEventForm] = useState(INITIAL_EVENT_FORM_STATE)
  const [eventErrors, setEventErrors] = useState({})
  const [eventTouched, setEventTouched] = useState({})
  const [isEventSubmitting, setIsEventSubmitting] = useState(false)
  const [eventFeedback, setEventFeedback] = useState(EMPTY_FEEDBACK)

  const [editingTask, setEditingTask] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Combinación de gestiones/estados para la que el progreso mostrado es válido
  const progressKeyRef = useRef(null)
  const [fetchedProgress, setFetchedProgress] = useState({ eventId: null, data: null })

  const eventSuccessBanner = useAutoDismiss(() => setEventFeedback(EMPTY_FEEDBACK), {
    active: eventFeedback.type === 'success',
    resetKey: eventFeedback.message,
  })
  const feedbackSuccessBanner = useAutoDismiss(() => setFeedback(EMPTY_FEEDBACK), {
    active: feedback.type === 'success',
    resetKey: feedback.message,
  })

  useEffect(() => {
    const controller = new AbortController()
    apiFetch(`/api/events/${id}/`, { signal: controller.signal })
      .then((data) => {
        progressKeyRef.current = subtasksProgressKey(data.subtasks)
        setEvent(data)
        setLoadResult({ key: loadKey, error: null })
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setLoadResult({
          key: loadKey,
          error: err.status === 404 ? 'Este evento no existe o fue eliminado.' : err.message,
        })
      })
    return () => controller.abort()
  }, [id, loadKey])

  const loading = loadResult.key !== loadKey
  const error = loadResult.error
  const fetchEvent = () => setAttempt((n) => n + 1)

  const subtasks = Array.isArray(event?.subtasks) ? event.subtasks : []

  // Progreso calculado por el backend (US-10, PI-149): el mismo número que en /progreso.
  // Llega con el evento y se vuelve a pedir cuando cambian las gestiones o sus estados.
  const progressKey = subtasksProgressKey(subtasks)
  const hasEvent = Boolean(event)

  useEffect(() => {
    if (!hasEvent || progressKey === progressKeyRef.current) return
    const controller = new AbortController()
    apiFetch('/api/progress/', { params: { event: id }, signal: controller.signal })
      .then((data) => {
        progressKeyRef.current = progressKey
        setFetchedProgress({ eventId: id, data })
      })
      .catch(() => {
        // Si falla, la barra conserva el último valor y se reintenta con el próximo cambio
      })
    return () => controller.abort()
  }, [id, hasEvent, progressKey])

  const progressData =
    (fetchedProgress.eventId === id && fetchedProgress.data) ||
    event?.progress || { total: 0, executed: 0, percentage: 0 }

  const newSubtaskDateRange = { eventDate: event?.event_date }

  const handleChangeSubtask = (e) => {
    const { name, value } = e.target
    setSubtaskForm((prev) => ({ ...prev, [name]: value }))

    if (subtaskTouched[name] || subtaskErrors[name]) {
      setSubtaskErrors((prev) => ({
        ...prev,
        [name]: validateSubtaskField(name, value, newSubtaskDateRange),
      }))
    }
  }

  const handleBlurSubtask = (e) => {
    const { name, value } = e.target
    setSubtaskTouched((prev) => ({ ...prev, [name]: true }))
    setSubtaskErrors((prev) => ({
      ...prev,
      [name]: validateSubtaskField(name, value, newSubtaskDateRange),
    }))
  }

  const handleSubmitSubtask = async (e) => {
    e.preventDefault()
    setFeedback(EMPTY_FEEDBACK)

    const allTouched = Object.keys(subtaskForm).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setSubtaskTouched(allTouched)

    const formErrors = validateSubtaskForm(subtaskForm, newSubtaskDateRange)
    setSubtaskErrors(formErrors)

    if (Object.keys(formErrors).length > 0) {
      setFeedback({
        type: 'error',
        message: 'Por favor, corrige los errores en los campos requeridos antes de guardar.',
      })
      return
    }

    setIsSubmitting(true)

    const payload = {
      name: subtaskForm.name.trim(),
      type: subtaskForm.type,
      scheduled_date: subtaskForm.scheduled_date,
      estimated_hours: Number(subtaskForm.estimated_hours),
      priority: subtaskForm.priority,
      note: subtaskForm.note.trim(),
    }

    try {
      const data = await apiFetch(`/api/events/${id}/subtasks/`, { method: 'POST', body: payload })
      setEvent((prev) => ({
        ...prev,
        subtasks: [...(Array.isArray(prev.subtasks) ? prev.subtasks : []), data],
      }))
      setFeedback({
        type: 'success',
        message: `¡Gestión "${data.name}" registrada con éxito!`,
        details: data,
      })
      setSubtaskForm(INITIAL_SUBTASK_FORM_STATE)
      setSubtaskErrors({})
      setSubtaskTouched({})
      setShowSubtaskForm(false)
    } catch (err) {
      if (err.status === 409 && err.details) {
        setConflictState({
          subtask: { ...payload, name: subtaskForm.name, event_id: id },
          conflictData: err.details,
          eventDate: event.event_date,
          isNew: true,
        })
      } else {
        setSubtaskErrors((prev) => ({ ...prev, ...(err.fieldErrors || {}) }))
        setFeedback({ type: 'error', message: err.message })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetSubtask = () => {
    setSubtaskForm(INITIAL_SUBTASK_FORM_STATE)
    setSubtaskErrors({})
    setSubtaskTouched({})
    setFeedback(EMPTY_FEEDBACK)
  }

  // Marcar subtarea individual como realizada (US-09)
  const handleMarkDone = async (task) => {
    try {
      const data = await apiFetch(`/api/subtasks/${task.id}/`, {
        method: 'PATCH',
        body: { status: 'done' },
      })
      setEvent((prev) => ({
        ...prev,
        subtasks: prev.subtasks.map((s) => (s.id === task.id ? data : s)),
      }))
      setFeedback({
        type: 'success',
        message: `Gestión "${data.name}" completada exitosamente.`,
        details: data,
      })
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'No se pudo completar la gestión.' })
    }
  }

  // Posponer con nota explicativa (US-09)
  const handleConfirmPostpone = async (task, note) => {
    const data = await apiFetch(`/api/subtasks/${task.id}/`, {
      method: 'PATCH',
      body: { status: 'postponed', note },
    })
    setEvent((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s) => (s.id === task.id ? data : s)),
    }))
    setPostponeState(null)
    setFeedback({
      type: 'success',
      message: `Gestión "${data.name}" pospuesta.`,
      details: data,
    })
  }

  const handleStartEditEvent = () => {
    setEventForm(buildEventFormValues(event))
    setEventErrors({})
    setEventTouched({})
    setEventFeedback(EMPTY_FEEDBACK)
    setIsEditingEvent(true)
  }

  const handleCancelEditEvent = () => {
    setIsEditingEvent(false)
    setEventErrors({})
    setEventTouched({})
    setEventFeedback(EMPTY_FEEDBACK)
  }

  const handleChangeEvent = (e) => {
    const { name, value } = e.target
    setEventForm((prev) => ({ ...prev, [name]: value }))

    if (eventTouched[name] || eventErrors[name]) {
      setEventErrors((prev) => ({
        ...prev,
        [name]: validateEventField(name, value, { originalDate: event.event_date }),
      }))
    }
  }

  const handleBlurEvent = (e) => {
    const { name, value } = e.target
    setEventTouched((prev) => ({ ...prev, [name]: true }))
    setEventErrors((prev) => ({
      ...prev,
      [name]: validateEventField(name, value, { originalDate: event.event_date }),
    }))
  }

  const handleSubmitEvent = async (e) => {
    e.preventDefault()
    setEventFeedback(EMPTY_FEEDBACK)

    const allTouched = Object.keys(eventForm).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setEventTouched(allTouched)

    const formErrors = validateEventForm(eventForm, { originalDate: event.event_date })
    const lastSubtaskDate = latestSubtaskDate(event.subtasks)
    if (!formErrors.event_date && lastSubtaskDate && eventForm.event_date < lastSubtaskDate) {
      formErrors.event_date = `La fecha del evento no puede quedar antes de sus gestiones; la última está programada para el ${formatDateFromISO(lastSubtaskDate)}.`
    }
    setEventErrors(formErrors)

    if (Object.keys(formErrors).length > 0) {
      setEventFeedback({
        type: 'error',
        message: 'Por favor, corrige los errores en los campos requeridos antes de guardar.',
      })
      return
    }

    setIsEventSubmitting(true)

    const payload = {
      name: eventForm.name.trim(),
      event_type: eventForm.event_type,
      contact: eventForm.contact.trim(),
      location: eventForm.location.trim(),
      event_date: eventForm.event_date,
      status: eventForm.status,
      description: eventForm.description.trim(),
    }

    try {
      const data = await apiFetch(`/api/events/${id}/`, { method: 'PATCH', body: payload })
      setEvent(data)
      setIsEditingEvent(false)
      setEventFeedback({
        type: 'success',
        message: `¡Evento "${data.name}" actualizado con éxito!`,
        details: data,
      })
    } catch (err) {
      // Los errores por campo del servidor se muestran junto a cada campo
      setEventErrors((prev) => ({ ...prev, ...(err.fieldErrors || {}) }))
      setEventFeedback({ type: 'error', message: err.message })
    } finally {
      setIsEventSubmitting(false)
    }
  }

  const handleStartEditSubtask = (task) => setEditingTask({ task })

  const handleSavedSubtask = (task, updatedTask) => {
    setEvent((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s) => (s.id === task.id ? updatedTask : s)),
    }))
    setEditingTask(null)
    setFeedback({
      type: 'success',
      message: `¡Gestión "${updatedTask.name}" actualizada con éxito!`,
      details: updatedTask,
    })
  }

  const handleEditConflict = ({ task, form, pendingChanges, conflictData }) => {
    setEditingTask(null)
    setConflictState({
      subtask: { ...task, ...form, id: task.id },
      original: task,
      pendingChanges,
      savedHours: task.estimated_hours ?? null,
      conflictData,
      eventDate: event.event_date,
      initialForm: form,
    })
  }

  const handleRequestDeleteEvent = () => {
    setFeedback(EMPTY_FEEDBACK)
    setEventFeedback(EMPTY_FEEDBACK)
    setConfirmDelete({ type: 'event', id, name: event.name })
  }

  const handleRequestDeleteSubtask = (task) => {
    setFeedback(EMPTY_FEEDBACK)
    setConfirmDelete({ type: 'subtask', id: task.id, name: task.name })
  }

  const handleCancelDelete = () => {
    if (isDeleting) return
    setConfirmDelete(null)
  }

  const handleConfirmDelete = async () => {
    if (isDeleting || !confirmDelete) return
    setIsDeleting(true)

    try {
      if (confirmDelete.type === 'event') {
        await apiFetch(`/api/events/${confirmDelete.id}/`, { method: 'DELETE' })
        setConfirmDelete(null)
        navigate('/eventos')
        return
      }

      await apiFetch(`/api/subtasks/${confirmDelete.id}/`, { method: 'DELETE' })
      setEvent((prev) => ({
        ...prev,
        subtasks: prev.subtasks.filter((s) => s.id !== confirmDelete.id),
      }))
      setConfirmDelete(null)
      setFeedback({
        type: 'success',
        message: `Gestión "${confirmDelete.name}" eliminada.`,
        details: null,
      })
    } catch (err) {
      setConfirmDelete(null)
      const msg = err.message
      if (confirmDelete.type === 'event') {
        setEventFeedback({ type: 'error', message: msg, details: null })
      } else {
        setFeedback({ type: 'error', message: msg, details: null })
      }
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return <StatusMessage variant="loading" title="Cargando el evento..." />
  }

  if (error || !event) {
    return (
      <StatusMessage
        variant="error"
        icon={<IconAlertTriangle size={28} />}
        title="No pudimos mostrar este evento"
        description={error}
      >
        <Link to="/eventos" className="btn-sec-pro">
          Ver mis eventos
        </Link>
        <button type="button" className="btn-primary-action" onClick={fetchEvent}>
          <IconRefresh size={16} />
          <span>Reintentar</span>
        </button>
      </StatusMessage>
    )
  }

  return (
    <div className="create-page-container">
      {eventFeedback.type === 'success' && (
        <div className="banner-alert banner-success" role="status" {...eventSuccessBanner}>
          <div className="banner-icon-side">
            <IconCheckCircle size={20} className="icon-emerald" />
          </div>
          <div className="banner-content">
            <strong>{eventFeedback.message}</strong>
          </div>
          <button
            type="button"
            className="btn-alert-primary"
            onClick={() => setEventFeedback(EMPTY_FEEDBACK)}
          >
            Cerrar aviso
          </button>
        </div>
      )}

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

      <div className="form-card-pro">
        <div className="form-card-header">
          <div className="form-card-header-main">
            <h2 className="form-heading">{isEditingEvent ? 'Editar evento' : event.name}</h2>
            {isEditingEvent ? (
              <p className="form-subheading">Actualiza la información principal de la ficha</p>
            ) : (
              <p className="form-subheading">
                <span className="badge-status-chip">{getOptionLabel(EVENT_STATUSES, event.status)}</span>
              </p>
            )}
          </div>

          {!isEditingEvent && (
            <div className="form-card-header-actions">
              <Link to="/eventos" className="btn-sec-pro">
                Volver a eventos
              </Link>
              <button type="button" className="btn-danger-ghost" onClick={handleRequestDeleteEvent}>
                Eliminar evento
              </button>
              <button type="button" className="btn-primary-action" onClick={handleStartEditEvent}>
                Editar evento
              </button>
            </div>
          )}
        </div>

        {isEditingEvent ? (
          <form onSubmit={handleSubmitEvent} noValidate className="form-body-pro">
            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="event-name" className="field-label">
                  Nombre del evento <span className="req-star">*</span>
                </label>
                <span className="char-counter">{eventForm.name.length}/200</span>
              </div>
              <input
                id="event-name"
                type="text"
                name="name"
                value={eventForm.name}
                onChange={handleChangeEvent}
                onBlur={handleBlurEvent}
                className={`field-input ${eventTouched.name && eventErrors.name ? 'field-input-error' : ''}`}
                required
                maxLength={200}
                aria-invalid={Boolean(eventTouched.name && eventErrors.name)}
                aria-describedby={eventTouched.name && eventErrors.name ? 'event-name-error' : undefined}
              />
              {eventTouched.name && eventErrors.name && (
                <span id="event-name-error" className="field-error-text">{eventErrors.name}</span>
              )}
            </div>

            <div className="field-row-2">
              <div className="field-group">
                <label htmlFor="event-type" className="field-label">
                  Tipo de evento <span className="req-star">*</span>
                </label>
                <select
                  id="event-type"
                  name="event_type"
                  value={eventForm.event_type}
                  onChange={handleChangeEvent}
                  onBlur={handleBlurEvent}
                  className={`field-input field-select ${eventTouched.event_type && eventErrors.event_type ? 'field-input-error' : ''}`}
                  required
                  aria-invalid={Boolean(eventTouched.event_type && eventErrors.event_type)}
                  aria-describedby={eventTouched.event_type && eventErrors.event_type ? 'event-type-error' : undefined}
                >
                  <option value="" disabled>Selecciona un tipo</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {eventTouched.event_type && eventErrors.event_type && (
                  <span id="event-type-error" className="field-error-text">{eventErrors.event_type}</span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="event-status" className="field-label">
                  Estado del evento <span className="req-star">*</span>
                </label>
                <select
                  id="event-status"
                  name="status"
                  value={eventForm.status}
                  onChange={handleChangeEvent}
                  onBlur={handleBlurEvent}
                  className={`field-input field-select ${eventTouched.status && eventErrors.status ? 'field-input-error' : ''}`}
                  required
                  aria-invalid={Boolean(eventTouched.status && eventErrors.status)}
                  aria-describedby={eventTouched.status && eventErrors.status ? 'event-status-error' : undefined}
                >
                  {EVENT_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
                {eventTouched.status && eventErrors.status && (
                  <span id="event-status-error" className="field-error-text">{eventErrors.status}</span>
                )}
              </div>
            </div>

            <div className="field-row-2">
              <div className="field-group">
                <label htmlFor="event-date" className="field-label">
                  Fecha del evento <span className="req-star">*</span>
                </label>
                <DateField
                  id="event-date"
                  name="event_date"
                  value={eventForm.event_date}
                  min={event.event_date < todayISO() ? event.event_date : todayISO()}
                  onChange={handleChangeEvent}
                  onBlur={handleBlurEvent}
                  className={`field-input ${eventTouched.event_date && eventErrors.event_date ? 'field-input-error' : ''}`}
                  required
                  aria-invalid={Boolean(eventTouched.event_date && eventErrors.event_date)}
                  aria-describedby={eventTouched.event_date && eventErrors.event_date ? 'event-date-error' : undefined}
                />
                {eventTouched.event_date && eventErrors.event_date && (
                  <span id="event-date-error" className="field-error-text">{eventErrors.event_date}</span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="event-contact" className="field-label">Cliente / contacto</label>
                <input
                  id="event-contact"
                  type="text"
                  name="contact"
                  value={eventForm.contact}
                  onChange={handleChangeEvent}
                  onBlur={handleBlurEvent}
                  maxLength={255}
                  aria-invalid={Boolean(eventTouched.contact && eventErrors.contact)}
                  aria-describedby={eventTouched.contact && eventErrors.contact ? 'event-contact-error' : undefined}
                  className="field-input"
                />
                {eventTouched.contact && eventErrors.contact && (
                  <span id="event-contact-error" className="field-error-text">{eventErrors.contact}</span>
                )}
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="event-location" className="field-label">Lugar</label>
              <input
                id="event-location"
                type="text"
                name="location"
                value={eventForm.location}
                onChange={handleChangeEvent}
                onBlur={handleBlurEvent}
                maxLength={255}
                aria-invalid={Boolean(eventTouched.location && eventErrors.location)}
                aria-describedby={eventTouched.location && eventErrors.location ? 'event-location-error' : undefined}
                className="field-input"
              />
              {eventTouched.location && eventErrors.location && (
                <span id="event-location-error" className="field-error-text">{eventErrors.location}</span>
              )}
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="event-description" className="field-label">Descripción o notas</label>
                <span className="char-counter">{eventForm.description.length}/2000</span>
              </div>
              <textarea
                id="event-description"
                name="description"
                value={eventForm.description}
                onChange={handleChangeEvent}
                onBlur={handleBlurEvent}
                rows="3"
                maxLength={2000}
                aria-invalid={Boolean(eventTouched.description && eventErrors.description)}
                aria-describedby={eventTouched.description && eventErrors.description ? 'event-description-error' : undefined}
                className="field-input field-textarea"
              />
              {eventTouched.description && eventErrors.description && (
                <span id="event-description-error" className="field-error-text">{eventErrors.description}</span>
              )}
            </div>

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
                {isEventSubmitting ? 'Guardando...' : 'Guardar cambios'}
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
          </div>
        )}
      </div>

      {/* Sección Gestiones con Barra de Progreso Integrada (US-10) */}
      <section className="events-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Gestiones del evento</h2>
            <p className="section-subtitle">Gestiones logísticas para mantener la producción en marcha</p>
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
              <span>{showSubtaskForm ? 'Cerrar formulario' : 'Nueva gestión'}</span>
            </button>
          </div>
        </div>

        {/* Barra de progreso de preparación del evento visible y reactiva */}
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '4px' }}>
            Progreso de preparación
          </strong>
          <ProgressBar
            executed={progressData.executed}
            total={progressData.total}
            percentage={progressData.percentage}
          />
        </div>

        {feedback.type === 'success' && (
          <div className="banner-alert banner-success" role="status" {...feedbackSuccessBanner}>
            <div className="banner-icon-side">
              <IconCheckCircle size={20} className="icon-emerald" />
            </div>
            <div className="banner-content">
              <strong>{feedback.message}</strong>
            </div>
            <button
              type="button"
              className="btn-alert-primary"
              onClick={() => setFeedback(EMPTY_FEEDBACK)}
            >
              Cerrar aviso
            </button>
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

        {showSubtaskForm && (
          <div className="form-card-pro">
            <div className="form-card-header">
              <div>
                <h2 className="form-heading">Nueva gestión</h2>
                <p className="form-subheading">Registro de una gestión logística del evento</p>
              </div>
            </div>

            <form
              id="subtask-form"
              onSubmit={handleSubmitSubtask}
              onReset={handleResetSubtask}
              noValidate
              className="form-body-pro"
            >
              <div className="field-group">
                <div className="field-label-row">
                  <label htmlFor="subtask-name" className="field-label">
                    Nombre de la gestión <span className="req-star">*</span>
                  </label>
                  <span className="char-counter">{subtaskForm.name.length}/200</span>
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
                  aria-invalid={Boolean(subtaskTouched.name && subtaskErrors.name)}
                  aria-describedby={subtaskTouched.name && subtaskErrors.name ? 'subtask-name-error' : undefined}
                />
                {subtaskTouched.name && subtaskErrors.name && (
                  <span id="subtask-name-error" className="field-error-text">{subtaskErrors.name}</span>
                )}
              </div>

              <div className="field-row-2">
                <div className="field-group">
                  <label htmlFor="subtask-type" className="field-label">
                    Tipo de gestión <span className="req-star">*</span>
                  </label>
                  <select
                    id="subtask-type"
                    name="type"
                    value={subtaskForm.type}
                    onChange={handleChangeSubtask}
                    onBlur={handleBlurSubtask}
                    className={`field-input field-select ${subtaskTouched.type && subtaskErrors.type ? 'field-input-error' : ''}`}
                    required
                    aria-invalid={Boolean(subtaskTouched.type && subtaskErrors.type)}
                    aria-describedby={subtaskTouched.type && subtaskErrors.type ? 'subtask-type-error' : undefined}
                  >
                    <option value="" disabled>Selecciona un tipo</option>
                    {TASK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {subtaskTouched.type && subtaskErrors.type && (
                    <span id="subtask-type-error" className="field-error-text">{subtaskErrors.type}</span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="subtask-priority" className="field-label">Prioridad</label>
                  <select
                    id="subtask-priority"
                    name="priority"
                    value={subtaskForm.priority}
                    onChange={handleChangeSubtask}
                    onBlur={handleBlurSubtask}
                    className="field-input field-select"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-row-2">
                <div className="field-group">
                  <label htmlFor="subtask-date" className="field-label">
                    Fecha objetivo <span className="req-star">*</span>
                  </label>
                  <DateField
                    id="subtask-date"
                    name="scheduled_date"
                    value={subtaskForm.scheduled_date}
                    min={todayISO()}
                    max={event.event_date}
                    onChange={handleChangeSubtask}
                    onBlur={handleBlurSubtask}
                    className={`field-input ${subtaskTouched.scheduled_date && subtaskErrors.scheduled_date ? 'field-input-error' : ''}`}
                    required
                    aria-invalid={Boolean(subtaskTouched.scheduled_date && subtaskErrors.scheduled_date)}
                    aria-describedby={subtaskTouched.scheduled_date && subtaskErrors.scheduled_date ? 'subtask-date-error' : undefined}
                  />
                  {subtaskTouched.scheduled_date && subtaskErrors.scheduled_date && (
                    <span id="subtask-date-error" className="field-error-text">{subtaskErrors.scheduled_date}</span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="subtask-hours" className="field-label">
                    Horas estimadas <span className="req-star">*</span>
                  </label>
                  <HoursInput
                    id="subtask-hours"
                    name="estimated_hours"
                    value={subtaskForm.estimated_hours}
                    onChange={handleChangeSubtask}
                    onBlur={handleBlurSubtask}
                    placeholder="Ej: 2.5"
                    className={subtaskTouched.estimated_hours && subtaskErrors.estimated_hours ? 'field-input-error' : ''}
                    required
                    aria-invalid={Boolean(subtaskTouched.estimated_hours && subtaskErrors.estimated_hours)}
                    aria-describedby={subtaskTouched.estimated_hours && subtaskErrors.estimated_hours ? 'subtask-hours-error' : undefined}
                  />
                  {subtaskTouched.estimated_hours && subtaskErrors.estimated_hours && (
                    <span id="subtask-hours-error" className="field-error-text">{subtaskErrors.estimated_hours}</span>
                  )}
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="subtask-note" className="field-label">Nota</label>
                <textarea
                  id="subtask-note"
                  name="note"
                  value={subtaskForm.note}
                  onChange={handleChangeSubtask}
                  onBlur={handleBlurSubtask}
                  placeholder="Indicaciones adicionales..."
                  rows="3"
                  className="field-input field-textarea"
                />
              </div>

              <div className="form-actions-row">
                <button type="reset" className="btn-sec-pro" disabled={isSubmitting}>
                  Limpiar formulario
                </button>
                <button
                  type="button"
                  className="btn-cancel-pro"
                  onClick={() => setShowSubtaskForm(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit-pro" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar gestión'}
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
              const afterEvent = isAfterEventDate(task, event.event_date)
              const isTaskDone = task.status === 'done'
              const isTaskPostponed = task.status === 'postponed'

              return (
                <div key={task.id} className={`event-card-item ${afterEvent ? 'card-date-warning' : ''}`} style={{ position: 'relative' }}>
                  {/* Cabecera: Badge de estado + Acciones discretas (Editar / Eliminar) */}
                  <div className="event-card-top" style={{ alignItems: 'center' }}>
                    <span className={`event-status-badge ${isTaskDone ? 'badge-complete' : ''}`}>
                      {getOptionLabel(TASK_STATUSES, task.status)}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEditSubtask(task)}
                        title="Editar gestión"
                        aria-label={`Editar gestión ${task.name}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '5px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          color: '#475569',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <IconEdit size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRequestDeleteSubtask(task)}
                        title="Eliminar gestión"
                        aria-label={`Eliminar gestión ${task.name}`}
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          padding: '5px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          color: '#e11d48',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffe4e6'
                          e.currentTarget.style.borderColor = '#fda4af'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#fff1f2'
                          e.currentTarget.style.borderColor = '#fecdd3'
                        }}
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Título de la gestión y fecha objetivo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <h3 className="event-name" style={{ margin: 0, fontSize: '16px' }}>{task.name}</h3>
                    <span className="event-date" style={{ fontSize: '13px' }}>
                      <IconCalendar size={13} />
                      <span>{task.scheduled_date ? formatDateFromISO(task.scheduled_date) : 'N/A'}</span>
                    </span>
                  </div>

                  <p className="event-client" style={{ marginTop: '4px' }}>
                    Tipo: {getOptionLabel(TASK_TYPES, task.type)}
                  </p>

                  {afterEvent && <DateWarning eventDate={event.event_date} />}

                  {/* Metadatos: Horas y Prioridad */}
                  <div className="event-details-list" style={{ marginTop: '8px' }}>
                    <div className="event-detail-row">
                      <IconClock size={14} />
                      <span>Horas: {task.estimated_hours} hrs</span>
                    </div>
                    <div className="event-detail-row">
                      <IconInfo size={14} />
                      <span>Prioridad: {getOptionLabel(TASK_PRIORITIES, task.priority)}</span>
                    </div>
                  </div>

                  {task.note && (
                    <p className="event-client" style={{ marginTop: '8px', fontStyle: 'italic', color: '#475569' }}>
                      <strong>Nota:</strong> {task.note}
                    </p>
                  )}

                  {/* Botones inferiores limpios y simétricos (Hecha / Posponer) */}
                  <div className="event-card-footer" style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-submit-pro"
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          fontSize: '13px',
                          justifyContent: 'center',
                          opacity: isTaskDone ? 0.6 : 1,
                        }}
                        onClick={() => handleMarkDone(task)}
                        disabled={isTaskDone}
                        title={isTaskDone ? 'Gestión ya completada' : 'Marcar gestión como hecha'}
                      >
                        <IconCheckCircle size={14} style={{ marginRight: '6px' }} />
                        {isTaskDone ? 'Completada' : 'Hecha'}
                      </button>

                      <button
                        type="button"
                        className="btn-sec-pro"
                        style={{
                          flex: 1,
                          padding: '6px 12px',
                          fontSize: '13px',
                          justifyContent: 'center',
                          opacity: (isTaskDone || isTaskPostponed) ? 0.6 : 1,
                        }}
                        onClick={() => setPostponeState(task)}
                        disabled={isTaskDone || isTaskPostponed}
                        title={
                          isTaskDone
                            ? 'No se puede posponer una tarea completada'
                            : isTaskPostponed
                            ? 'Ya se encuentra pospuesta'
                            : 'Posponer gestión con nota explicativa'
                        }
                      >
                        {isTaskPostponed ? 'Pospuesta' : 'Posponer'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDelete !== null}
        isDangerous
        title={confirmDelete?.type === 'event' ? 'Eliminar evento' : 'Eliminar gestión'}
        message={
          confirmDelete?.type === 'event'
            ? `¿Estás seguro de que deseas eliminar el evento "${confirmDelete.name}"? Esta acción eliminará también todas sus gestiones asociadas.`
            : `¿Eliminar la gestión '${confirmDelete?.name ?? ''}'? Esta acción no se puede deshacer.`
        }
        confirmLabel={isDeleting ? 'Eliminando...' : 'Eliminar'}
        cancelLabel="Cancelar"
        confirmDisabled={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {editingTask && (
        <SubtaskEditModal
          key={editingTask.task.id}
          task={editingTask.task}
          eventDate={event.event_date}
          initialForm={editingTask.initialForm}
          onSaved={(updatedTask) => handleSavedSubtask(editingTask.task, updatedTask)}
          onConflict={handleEditConflict}
          onCancel={() => setEditingTask(null)}
        />
      )}

      {conflictState && (
        <OverloadConflictModal
          conflictData={conflictState?.conflictData}
          subtask={conflictState?.subtask}
          eventDate={conflictState?.eventDate}
          isNew={Boolean(conflictState?.isNew)}
          pendingChanges={conflictState.pendingChanges}
          savedHours={conflictState.savedHours ?? null}
          onResolved={(resultTask, message) => {
            const wasNew = conflictState?.isNew
            setConflictState(null)
            setEditingTask(null)
            if (wasNew) {
              setEvent((prev) => ({
                ...prev,
                subtasks: [...(Array.isArray(prev.subtasks) ? prev.subtasks : []), resultTask],
              }))
              setSubtaskForm(INITIAL_SUBTASK_FORM_STATE)
              setShowSubtaskForm(false)
            } else {
              setEvent((prev) => ({
                ...prev,
                subtasks: prev.subtasks.map((s) => (s.id === resultTask.id ? resultTask : s)),
              }))
            }
            setFeedback({ type: 'success', message, details: resultTask })
          }}
          onCancel={() => {
            const state = conflictState
            setConflictState(null)
            if (!state?.isNew && state?.initialForm && state?.original) {
              setEditingTask({ task: state.original, initialForm: state.initialForm })
            }
          }}
        />
      )}

      {postponeState && (
        <PostponeModal
          subtask={postponeState}
          onConfirm={handleConfirmPostpone}
          onCancel={() => setPostponeState(null)}
        />
      )}
    </div>
  )
}