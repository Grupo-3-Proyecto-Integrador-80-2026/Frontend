import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContext'
import { apiFetch, setCsrfToken, setUnauthorizedHandler } from '../api/client'

/**
 * Mantiene la sesión del organizador (US-11).
 *
 * - Al cargar la app consulta /api/auth/me/ para saber si la cookie de sesión sigue viva.
 * - Login y registro guardan el usuario y el token CSRF que devuelve el backend.
 * - Si cualquier petición responde 401, la sesión se marca como expirada y las
 *   rutas protegidas redirigen a /login.
 */
export default function AuthProvider({ children }) {
  const [session, setSession] = useState({ status: 'checking', user: null, expired: false })

  const startSession = useCallback((data) => {
    setCsrfToken(data.csrf_token)
    setSession({ status: 'authenticated', user: data.user, expired: false })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setCsrfToken(null)
      setSession((prev) =>
        prev.status === 'authenticated'
          ? { status: 'anonymous', user: null, expired: true }
          : prev
      )
    })

    apiFetch('/api/auth/me/', { notifyUnauthorized: false })
      .then(startSession)
      .catch(() => setSession({ status: 'anonymous', user: null, expired: false }))

    return () => setUnauthorizedHandler(null)
  }, [startSession])

  const login = useCallback(
    async (email, password) => {
      const data = await apiFetch('/api/auth/login/', {
        method: 'POST',
        body: { email, password },
        notifyUnauthorized: false,
      })
      startSession(data)
    },
    [startSession]
  )

  const register = useCallback(
    async (values) => {
      const data = await apiFetch('/api/auth/register/', { method: 'POST', body: values })
      startSession(data)
    },
    [startSession]
  )

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout/', { method: 'POST', notifyUnauthorized: false })
    } finally {
      // Aunque falle la red, en este navegador la sesión se da por cerrada
      setCsrfToken(null)
      setSession({ status: 'anonymous', user: null, expired: false })
    }
  }, [])

  const value = useMemo(
    () => ({ ...session, login, register, logout }),
    [session, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
