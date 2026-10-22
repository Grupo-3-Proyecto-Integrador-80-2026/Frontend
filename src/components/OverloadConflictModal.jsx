import { useId, useMemo, useState } from 'react'
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconCalendar,
  IconX,
} from './Icons'
import DateField from './DateField'
import HoursInput from './HoursInput'
import { formatDateFromISO, todayISO } from '../utils/validators'
import { apiFetch } from '../api/client'
import useDialogFocus from './useDialogFocus'

/**
 * Modal de resolución del conflicto por sobrecarga diaria (US-07, US-08).
 * Quien lo usa lo monta solo cuando hay un conflicto, así cada conflicto
 * arranca con su propio estado (fecha sugerida, horas) y los hooks se
 * ejecutan siempre en el mismo orden.
 *
 * - `pendingChanges`: los demás cambios del formulario que originó el conflicto
 *   (nombre, nota, prioridad...). Se envían junto con la resolución para no perderlos.
 * - `savedHours`: horas que la gestión tiene guardadas; "Reducir horas" solo
 *   envía resolution=reduce_hours cuando de verdad quedan por debajo de ellas.
 */
export default function OverloadConflictModal({
  conflictData,
  subtask,
  eventDate,
  isNew = false,
  pendingChanges = {},
  savedHours = null,
  onResolved,
  onCancel,
}) {
  const limitHours = conflictData.limit_hours ?? 6
  const plannedHours = conflictData.planned_hours ?? 0
  const attemptedHours = Number(conflictData.subtask_hours || subtask?.estimated_hours || 1)
  const maxAllowedSameDay = Math.max(0, limitHours - plannedHours)

  const taskExceedsLimitEntirely = attemptedHours > limitHours

  const [selectedAction, setSelectedAction] = useState(taskExceedsLimitEntirely ? 'reduce' : 'move')
  const [targetDate, setTargetDate] = useState(
    conflictData.suggested_dates?.[0] || conflictData.date || todayISO()
  )

  const defaultSuggestedHours =
    maxAllowedSameDay > 0
      ? String(Math.round(maxAllowedSameDay * 10) / 10)
      : String(Math.round(Math.max(0.5, attemptedHours - 0.5) * 10) / 10)

  const [reducedHours, setReducedHours] = useState(defaultSuggestedHours)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const titleId = useId()
  const descriptionId = useId()

  // Foco atrapado y Escape para cerrar (no mientras se guarda)
  const dialogRef = useDialogFocus({ onClose: onCancel, closeOnEscape: !isSubmitting })

  const liveCalculation = useMemo(() => {
    if (selectedAction === 'move') {
      if (taskExceedsLimitEntirely) {
        return {
          date: targetDate,
          hours: attemptedHours,
          projected: attemptedHours,
          isOverloaded: true,
          message: `Esta gestión dura ${attemptedHours}h y supera tu límite total (${limitHours}h/día).`,
        }
      }

      const isSameDate = targetDate === conflictData.date
      const projected = isSameDate ? plannedHours + attemptedHours : attemptedHours
      const isOverloaded = isSameDate ? projected > limitHours : false

      return {
        date: targetDate,
        hours: attemptedHours,
        projected,
        isOverloaded,
        message: isSameDate
          ? `Carga resultante: ${projected}h (supera las ${limitHours}h permitidas)`
          : `Carga asignada: ${attemptedHours}h para el ${formatDateFromISO(targetDate)}`,
      }
    } else {
      const numHours = Number(reducedHours) || 0
      const projected = plannedHours + numHours
      const isOverloaded = projected > limitHours || numHours <= 0 || numHours > attemptedHours

      return {
        date: conflictData.date,
        hours: numHours,
        projected,
        isOverloaded,
        message: isOverloaded
          ? `Carga resultante: ${projected}h (excede el límite de ${limitHours}h)`
          : `Carga viable: ${projected}h de ${limitHours}h permitidas`,
      }
    }
  }, [
    selectedAction,
    targetDate,
    reducedHours,
    conflictData,
    plannedHours,
    attemptedHours,
    limitHours,
    taskExceedsLimitEntirely,
  ])

  const saveSubtask = async (body) => {
    if (isNew) {
      const eventId = subtask?.event_id
      const payload = {
        name: subtask?.name,
        type: subtask?.type || 'other',
        priority: subtask?.priority || 'medium',
        note: subtask?.note || '',
        ...pendingChanges,
        ...body,
      }
      return await apiFetch(`/api/events/${eventId}/subtasks/`, {
        method: 'POST',
        body: payload,
      })
    } else {
      return await apiFetch(`/api/subtasks/${subtask.id}/`, {
        method: 'PATCH',
        body: { ...pendingChanges, ...body },
      })
    }
  }

  const handleResolveByMove = async (dateToUse) => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await saveSubtask({
        scheduled_date: dateToUse,
        estimated_hours: attemptedHours,
      })
      onResolved(
        result,
        `Gestión programada para el ${formatDateFromISO(dateToUse)} (${attemptedHours}h).`
      )
    } catch (err) {
      if (err.status === 409 && err.details) {
        setErrorMessage(`La fecha elegida también excede tu disponibilidad. ${err.message}`)
      } else {
        setErrorMessage(`No se pudo mover la gestión. ${err.message}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResolveByReduce = async () => {
    const numHours = Number(reducedHours)
    if (numHours <= 0) {
      setErrorMessage('Las horas deben ser mayores a 0.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const payload = {
      scheduled_date: conflictData.date,
      estimated_hours: numHours,
    }

    // El backend exige que reduce_hours deje menos horas de las guardadas. Si el
    // conflicto vino de subir las horas (p. ej. 1h → 3h y se reduce a 2h), se
    // guarda como un cambio normal y el backend vuelve a validar la sobrecarga.
    if (!isNew && savedHours !== null && numHours < Number(savedHours)) {
      payload.resolution = 'reduce_hours'
    }

    try {
      const result = await saveSubtask(payload)
      onResolved(
        result,
        `Horas ajustadas a ${numHours}h para el ${formatDateFromISO(conflictData.date)}.`
      )
    } catch (err) {
      setErrorMessage(`No se pudo ajustar las horas. ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePostpone = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await saveSubtask({
        scheduled_date: conflictData.date,
        estimated_hours: attemptedHours,
        status: 'postponed',
      })
      onResolved(result, 'Gestión marcada como pospuesta.')
    } catch (err) {
      setErrorMessage(`No se pudo posponer la gestión. ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForceSave = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await saveSubtask({
        scheduled_date: conflictData.date,
        estimated_hours: attemptedHours,
        confirm_overload: true,
      })
      onResolved(
        result,
        `Gestión guardada para el ${formatDateFromISO(conflictData.date)} asumiendo la sobrecarga.`
      )
    } catch (err) {
      setErrorMessage(`No se pudo guardar la gestión. ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="confirm-dialog-overlay">
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={{ maxWidth: '480px', textAlign: 'left', padding: '24px', borderRadius: '16px' }}
      >
        
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div className="confirm-dialog-icon confirm-dialog-icon-danger" style={{ margin: 0, width: '38px', height: '38px' }}>
            <IconAlertTriangle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 id={titleId} className="confirm-dialog-title" style={{ margin: 0, fontSize: '18px' }}>
              Sobrecarga de horas detectada
            </h2>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {subtask?.name || 'Gestión en curso'}
            </span>
          </div>
          <button
            type="button"
            className="btn-cancel-pro btn-small"
            style={{ padding: '6px', borderRadius: '50%' }}
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cerrar"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Banner de explicación */}
        <div
          id={descriptionId}
          style={{
            margin: '0 0 16px 0',
            borderRadius: '10px',
            padding: '12px 14px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            fontSize: '13px',
            color: '#92400e',
            lineHeight: 1.45,
          }}
        >
          {conflictData.message && (
            <strong style={{ display: 'block', marginBottom: '4px' }}>{conflictData.message}</strong>
          )}
          El <strong>{formatDateFromISO(conflictData.date)}</strong> ya cuenta con <strong>{plannedHours}h</strong> planificadas. Si sumas las <strong>{attemptedHours}h</strong> de esta tarea, acumularás <strong>{plannedHours + attemptedHours}h</strong> (tu límite diario es de {limitHours}h).
        </div>

        {errorMessage && (
          <div className="banner-alert banner-error" role="alert" style={{ marginBottom: '14px' }}>
            <IconAlertTriangle size={16} className="icon-rose" />
            <span style={{ fontSize: '13px', flex: 1 }}>{errorMessage}</span>
          </div>
        )}

        {/* Pestañas de resolución */}
        <div style={{ marginBottom: '14px' }}>
          <span className="field-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 600, textAlign: 'center' }}>
            ¿Qué solución prefieres aplicar?
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              className={selectedAction === 'move' ? 'btn-submit-pro btn-small' : 'btn-sec-pro btn-small'}
              style={{ justifyContent: 'center', padding: '8px' }}
              onClick={() => setSelectedAction('move')}
              disabled={isSubmitting}
              aria-pressed={selectedAction === 'move'}
            >
              1. Mover a otra fecha
            </button>
            <button
              type="button"
              className={selectedAction === 'reduce' ? 'btn-submit-pro btn-small' : 'btn-sec-pro btn-small'}
              style={{ justifyContent: 'center', padding: '8px' }}
              onClick={() => setSelectedAction('reduce')}
              disabled={isSubmitting}
              aria-pressed={selectedAction === 'reduce'}
            >
              2. Reducir horas
            </button>
          </div>

          {selectedAction === 'move' && (
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {taskExceedsLimitEntirely ? (
                <div style={{ color: '#b45309', fontSize: '12px', lineHeight: 1.4 }}>
                  Esta gestión necesita <strong>{attemptedHours}h</strong>, superando el límite diario de <strong>{limitHours}h</strong>. Pasa a <em>"2. Reducir horas"</em> para ajustarla.
                </div>
              ) : (
                <>
                  <label className="field-label" style={{ fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    Días sugeridos con espacio para tus <strong>{attemptedHours}h</strong>:
                  </label>

                  {conflictData.suggested_dates && conflictData.suggested_dates.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {conflictData.suggested_dates.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={targetDate === d ? 'btn-submit-pro btn-small' : 'btn-sec-pro btn-small'}
                          style={{ fontSize: '12px', padding: '5px 10px' }}
                          onClick={() => setTargetDate(d)}
                          disabled={isSubmitting}
                          aria-pressed={targetDate === d}
                        >
                          <IconCalendar size={13} style={{ marginRight: '4px' }} />
                          {formatDateFromISO(d)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="field-hint" style={{ margin: '4px 0 8px 0' }}>
                      No encontramos días inmediatos con espacio. Selecciona una fecha:
                    </p>
                  )}

                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="conflict-target-date" className="field-label" style={{ fontSize: '12px' }}>
                      O selecciona otra fecha manual:
                    </label>
                    <DateField
                      id="conflict-target-date"
                      name="target_date"
                      value={targetDate}
                      min={todayISO()}
                      max={eventDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {selectedAction === 'reduce' && (
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reduced-hours-input" className="field-label" style={{ fontSize: '12px' }}>
                  Ajustar horas estimadas para este día:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HoursInput
                    id="reduced-hours-input"
                    name="reduced_hours"
                    value={reducedHours}
                    onChange={(e) => setReducedHours(e.target.value)}
                    style={{ maxWidth: '110px' }}
                    disabled={isSubmitting}
                  />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>horas de trabajo</span>
                </div>
                <small className="field-hint" style={{ marginTop: '6px', display: 'block' }}>
                  {maxAllowedSameDay > 0 ? (
                    <>Recomendación: con <strong>{maxAllowedSameDay}h</strong> la jornada queda en el límite exacto ({limitHours}h).</>
                  ) : (
                    <>Este día ya está al tope con otras actividades.</>
                  )}
                </small>
              </div>
            </div>
          )}
        </div>

        {/* Barra de viabilidad */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            background: liveCalculation.isOverloaded ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${liveCalculation.isOverloaded ? '#fecaca' : '#bbf7d0'}`,
            color: liveCalculation.isOverloaded ? '#991b1b' : '#166534',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            {liveCalculation.isOverloaded ? (
              <IconAlertTriangle size={16} style={{ flexShrink: 0 }} />
            ) : (
              <IconCheckCircle size={16} style={{ flexShrink: 0 }} />
            )}
            <span style={{ lineHeight: 1.3 }}>{liveCalculation.message}</span>
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: '11.5px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: liveCalculation.isOverloaded ? '#fee2e2' : '#dcfce7',
              whiteSpace: 'nowrap',
            }}
          >
            {liveCalculation.isOverloaded ? 'Conflicto activo' : 'Solución viable'}
          </span>
        </div>

        {/* BLOQUE DE ACCIONES ALINEADO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', width: '100%' }}>
          
          {/* Fila 1: Opciones secundarias (50% cada una, alineadas con los bordes de abajo) */}
          <div style={{ display: 'flex', gap: '9px', width: '100%' }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '9px 12px',
                fontSize: '13.5px',
                fontWeight: 500,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = '#f8fafc'
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = '#ffffff'
              }}
              onClick={handlePostpone}
              disabled={isSubmitting}
            >
              Posponer
            </button>

            <button
              type="button"
              style={{
                flex: 1,
                padding: '9px 12px',
                fontSize: '13.5px',
                fontWeight: 500,
                background: '#ffffff',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = '#fef2f2'
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = '#ffffff'
              }}
              onClick={handleForceSave}
              disabled={isSubmitting}
              title="Guarda la tarea ignorando el límite diario de horas"
            >
              Forzar sobrecarga
            </button>
          </div>

          {/* Fila 2: Aplicar solución (Acción primaria a ancho completo) */}
          <button
            type="button"
            disabled={liveCalculation.isOverloaded || isSubmitting}
            onClick={() => {
              if (selectedAction === 'move') {
                handleResolveByMove(targetDate)
              } else {
                handleResolveByReduce()
              }
            }}
            style={{
              width: '100%',
              padding: '11px',
              fontSize: '14.5px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              background: liveCalculation.isOverloaded || isSubmitting ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              cursor: liveCalculation.isOverloaded || isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: liveCalculation.isOverloaded ? 'none' : '0 1px 3px rgba(37, 99, 235, 0.25)',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!liveCalculation.isOverloaded && !isSubmitting) {
                e.currentTarget.style.backgroundColor = '#1d4ed8'
              }
            }}
            onMouseLeave={(e) => {
              if (!liveCalculation.isOverloaded && !isSubmitting) {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }
            }}
          >
            {isSubmitting ? 'Guardando...' : 'Aplicar solución'}
          </button>

          {/* Fila 3: Cancelar (Acción de escape a ancho completo, visualmente neutra) */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '9px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#64748b',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#f8fafc'
                e.currentTarget.style.color = '#334155'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.color = '#64748b'
              }
            }}
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  )
}