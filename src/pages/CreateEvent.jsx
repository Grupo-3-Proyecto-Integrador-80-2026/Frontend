import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconPlus,
  IconCheckCircle,
  IconAlertTriangle,
  IconClock,
  IconCalendar,
  IconUser,
  IconMapPin,
  IconX,
} from '../components/Icons'
import {
  validateEventField,
  validateEventForm,
  autoFormatDateInput,
  formatDateToISO,
  formatDateFromISO,
} from '../utils/validators'

const EVENT_TYPES = [
  { value: 'wedding', label: 'Boda' },
  { value: 'social', label: 'Social' },
  { value: 'corporate', label: 'Corporativo' },
  { value: 'birthday', label: 'Cumpleaños' },
  { value: 'other', label: 'Otro' },
]

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planificación' },
  { value: 'in_progress', label: 'En Producción' },
  { value: 'finished', label: 'Finalizado' },
]

const INITIAL_FORM_STATE = {
  name: '',
  event_type: 'wedding',
  contact: '',
  location: '',
  event_date: '',
  status: 'planning',
  description: '',
}

export default function CreateEvent() {
  const navigate = useNavigate()

  // Estado controlado del formulario
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ type: null, message: '', details: null })

  const limitHours = 6.0
  const consumedHours = 3.5

  // Manejador de cambios con formateo DD/MM/AAAA y re-validación inmediata
  const handleChange = (e) => {
    const { name, value } = e.target

    // Auto-formatear fecha a DD/MM/AAAA mientras el usuario escribe
    const finalValue = name === 'event_date' ? autoFormatDateInput(value) : value

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }))

    // Si el campo ya fue visitado o ya tenía error, re-validamos en tiempo real
    if (touched[name] || errors[name]) {
      const fieldError = validateEventField(name, finalValue)
      setErrors((prev) => ({
        ...prev,
        [name]: fieldError,
      }))
    }
  }

  // Manejador de pérdida de foco (onBlur) para validación inline
  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }))

    const fieldError = validateEventField(name, value)
    setErrors((prev) => ({
      ...prev,
      [name]: fieldError,
    }))
  }

  // Manejador del envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback({ type: null, message: '', details: null })

    // Marcar todos los campos como tocados al intentar enviar
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setTouched(allTouched)

    // Validar todos los campos
    const formErrors = validateEventForm(formData)
    setErrors(formErrors)

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
    const isoEventDate = formatDateToISO(formData.event_date)

    const payload = {
      name: formData.name.trim(),
      event_type: formData.event_type,
      contact: formData.contact.trim(),
      location: formData.location.trim(),
      event_date: isoEventDate,
      status: formData.status,
      description: formData.description.trim(),
    }

    try {
      const response = await fetch(`${baseUrl}/api/events/`, {
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
          (data.details ? JSON.stringify(data.details) : 'Error al guardar el evento en el servidor.')
        )
      }

      const formattedDisplayDate = formatDateFromISO(data.event_date)

      setFeedback({
        type: 'success',
        message: `¡Evento "${data.name}" registrado con éxito en el sistema!`,
        details: {
          ...data,
          display_date: formattedDisplayDate,
        },
      })
      setFormData(INITIAL_FORM_STATE)
      setErrors({})
      setTouched({})
    } catch (err) {
      console.error(err)
      setFeedback({
        type: 'error',
        message: err.message || 'Error de conexión con el servidor. Inténtalo nuevamente.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Restablecer formulario y estados de validación
  const handleReset = () => {
    setFormData(INITIAL_FORM_STATE)
    setErrors({})
    setTouched({})
    setFeedback({ type: null, message: '', details: null })
  }

  return (
    <div className="create-page-container">
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
                ID asignado: #{feedback.details.id} &bull; Tipo: {feedback.details.event_type} &bull; Fecha: {feedback.details.display_date || feedback.details.event_date}
              </p>
            )}
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="btn-alert-outline"
              onClick={() => navigate('/')}
            >
              Ir al Inicio
            </button>
            <button
              type="button"
              className="btn-alert-primary"
              onClick={() => setFeedback({ type: null, message: '', details: null })}
            >
              Crear otro
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

      <div className="create-layout-grid">
        {/* Formulario Estilo Card Prototipo */}
        <div className="form-card-pro">
          <div className="form-card-header">
            <div className="header-icon-box">
              <IconPlus size={18} />
            </div>
            <div>
              <h2 className="form-heading">Ficha de Nuevo Evento</h2>
              <p className="form-subheading">Planificador y registro en cartera de operaciones</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} onReset={handleReset} noValidate className="form-body-pro">
            {/* Nombre del Evento */}
            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="name" className="field-label">
                  Nombre del Evento <span className="req-star">*</span>
                </label>
                <span className="char-counter">
                  {formData.name.length}/200
                </span>
              </div>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: Aniversario Corporativo 25 Años"
                className={`field-input ${touched.name && errors.name ? 'field-input-error' : ''}`}
                required
                maxLength={200}
                aria-invalid={touched.name && !!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {touched.name && errors.name && (
                <span id="name-error" className="field-error-text">
                  {errors.name}
                </span>
              )}
            </div>

            {/* Fila: Tipo y Estado */}
            <div className="field-row-2">
              <div className="field-group">
                <label htmlFor="event_type" className="field-label">
                  Tipo de Evento <span className="req-star">*</span>
                </label>
                <select
                  id="event_type"
                  name="event_type"
                  value={formData.event_type}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`field-input field-select ${touched.event_type && errors.event_type ? 'field-input-error' : ''}`}
                  required
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {touched.event_type && errors.event_type && (
                  <span className="field-error-text">{errors.event_type}</span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="status" className="field-label">
                  Estado Inicial <span className="req-star">*</span>
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`field-input field-select ${touched.status && errors.status ? 'field-input-error' : ''}`}
                  required
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                {touched.status && errors.status && (
                  <span className="field-error-text">{errors.status}</span>
                )}
              </div>
            </div>

            {/* Fila: Fecha Prevista (DD/MM/AAAA) y Contacto */}
            <div className="field-row-2">
              <div className="field-group">
                <label htmlFor="event_date" className="field-label">
                  Fecha Prevista (DD/MM/AAAA) <span className="req-star">*</span>
                </label>
                <input
                  id="event_date"
                  type="text"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="DD/MM/AAAA (ej. 28/10/2026)"
                  maxLength={10}
                  className={`field-input ${touched.event_date && errors.event_date ? 'field-input-error' : ''}`}
                  required
                  aria-invalid={touched.event_date && !!errors.event_date}
                  aria-describedby={errors.event_date ? 'date-error' : 'date-hint'}
                />
                <small id="date-hint" className="field-hint">
                  Formato: <strong>DD/MM/AAAA</strong> (Día/Mes/Año)
                </small>
                {touched.event_date && errors.event_date && (
                  <span id="date-error" className="field-error-text">
                    {errors.event_date}
                  </span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="contact" className="field-label">
                  Cliente / Contacto
                </label>
                <input
                  id="contact"
                  type="text"
                  name="contact"
                  value={formData.contact}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ej: Grupo Financiero Andino"
                  maxLength={255}
                  className={`field-input ${touched.contact && errors.contact ? 'field-input-error' : ''}`}
                />
                {touched.contact && errors.contact && (
                  <span className="field-error-text">{errors.contact}</span>
                )}
              </div>
            </div>

            {/* Lugar / Recinto */}
            <div className="field-group">
              <label htmlFor="location" className="field-label">
                Lugar / Recinto
              </label>
              <input
                id="location"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej: Club Campestre Central, Salón Principal"
                maxLength={255}
                className={`field-input ${touched.location && errors.location ? 'field-input-error' : ''}`}
              />
              {touched.location && errors.location && (
                <span className="field-error-text">{errors.location}</span>
              )}
            </div>

            {/* Descripción / Notas */}
            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="description" className="field-label">
                  Descripción o Alcance Técnico
                </label>
                <span className="char-counter">
                  {formData.description.length}/2000
                </span>
              </div>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Notas para el montaje, requerimientos logísticos o acuerdos con el cliente..."
                rows="3"
                maxLength={2000}
                className={`field-input field-textarea ${touched.description && errors.description ? 'field-input-error' : ''}`}
              />
              {touched.description && errors.description && (
                <span className="field-error-text">{errors.description}</span>
              )}
            </div>

            {/* Impacto en Capacidad Diaria */}
            <div className="capacity-impact-box">
              <IconClock size={16} className="text-brand-icon" />
              <span className="impact-text">
                Capacidad disponible de la jornada: <strong>{(limitHours - consumedHours).toFixed(1)} hrs</strong> libres de <strong>{limitHours.toFixed(1)} hrs</strong> límite.
              </span>
            </div>

            {/* Botones de acción */}
            <div className="form-actions-row">
              <button
                type="button"
                onClick={handleReset}
                className="btn-sec-pro"
                disabled={isSubmitting}
              >
                Limpiar Formulario
              </button>
              <Link to="/" className="btn-cancel-pro">
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn-submit-pro"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Dar de Alta Evento'}
              </button>
            </div>
          </form>
        </div>

        {/* Panel lateral: Vista Previa en Vivo */}
        <aside className="preview-card-pro">
          <div className="preview-card-header">
            <h3>Vista Previa del Estado</h3>
            <span className="badge-preview-tag">React State</span>
          </div>

          <p className="preview-intro">
            Los valores se sincronizan en tiempo real mediante el formulario controlado:
          </p>

          <div className="preview-details-box">
            <div className="preview-item">
              <span className="p-label">
                <IconUser size={13} />
                <span>Evento:</span>
              </span>
              <span className="p-value font-bold">
                {formData.name || <em className="muted">Sin definir</em>}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">Categoría:</span>
              <span className="badge-preview-chip">
                {EVENT_TYPES.find((t) => t.value === formData.event_type)?.label}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">
                <IconCalendar size={13} />
                <span>Fecha:</span>
              </span>
              <span className="p-value">
                {formData.event_date || <em className="muted">DD/MM/AAAA</em>}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">Estado:</span>
              <span className="badge-status-chip">
                {STATUS_OPTIONS.find((s) => s.value === formData.status)?.label}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">Cliente:</span>
              <span className="p-value">
                {formData.contact || <em className="muted">N/A</em>}
              </span>
            </div>

            <div className="preview-item">
              <span className="p-label">
                <IconMapPin size={13} />
                <span>Ubicación:</span>
              </span>
              <span className="p-value">
                {formData.location || <em className="muted">N/A</em>}
              </span>
            </div>

            <div className="preview-item full-desc">
              <span className="p-label">Descripción:</span>
              <p className="p-desc-box">
                {formData.description || <em className="muted">Sin descripción detallada</em>}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
