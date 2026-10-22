import { useCallback, useEffect, useRef } from 'react'

const DEFAULT_DURATION_MS = 6000

/**
 * Cierra un aviso pasado un tiempo, pausándose mientras el puntero o el foco
 * estén sobre él (criterio WCAG de tiempo ajustable).
 *
 * Devuelve los manejadores que hay que aplicar al contenedor del aviso:
 * `onMouseEnter`, `onMouseLeave`, `onFocus` y `onBlur`.
 *
 * @param {Function} onDismiss - Se llama cuando se cumple el tiempo.
 * @param {Object} [options]
 * @param {number} [options.duration=6000]
 * @param {boolean} [options.active=true] - Con false no se programa el cierre.
 * @param {string|number} [options.resetKey] - Al cambiar, reinicia el temporizador.
 * @returns {Object} Props para el elemento que muestra el aviso.
 */
export default function useAutoDismiss(
  onDismiss,
  { duration = DEFAULT_DURATION_MS, active = true, resetKey } = {}
) {
  const onDismissRef = useRef(onDismiss)
  const timeoutRef = useRef(null)
  const remainingRef = useRef(duration)
  const startedAtRef = useRef(0)
  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)

  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  const clearTimer = useCallback(() => {
    if (timeoutRef.current === null) return
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  const startTimer = useCallback(
    (ms) => {
      clearTimer()
      const safeMs = Math.max(0, ms)
      remainingRef.current = safeMs
      startedAtRef.current = Date.now()
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        onDismissRef.current?.()
      }, safeMs)
    },
    [clearTimer]
  )

  const pauseTimer = useCallback(() => {
    if (timeoutRef.current === null) return
    clearTimer()
    const elapsed = Date.now() - startedAtRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
  }, [clearTimer])

  const resumeTimer = useCallback(() => {
    if (hoveredRef.current || focusedRef.current) return
    if (timeoutRef.current !== null) return
    startTimer(remainingRef.current)
  }, [startTimer])

  useEffect(() => {
    if (!active) {
      clearTimer()
      remainingRef.current = duration
      return undefined
    }

    remainingRef.current = duration
    if (hoveredRef.current || focusedRef.current) {
      clearTimer()
      return undefined
    }

    startTimer(duration)
    return clearTimer
  }, [active, duration, resetKey, startTimer, clearTimer])

  const handleMouseEnter = useCallback(() => {
    hoveredRef.current = true
    pauseTimer()
  }, [pauseTimer])

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = false
    resumeTimer()
  }, [resumeTimer])

  const handleFocus = useCallback(() => {
    focusedRef.current = true
    pauseTimer()
  }, [pauseTimer])

  const handleBlur = useCallback(
    (event) => {
      if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return
      focusedRef.current = false
      resumeTimer()
    },
    [resumeTimer]
  )

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
  }
}
