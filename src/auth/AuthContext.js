import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/**
 * Sesión del organizador: { status, user, login, register, logout }.
 * `status` es 'checking' mientras se consulta /api/auth/me/, luego
 * 'authenticated' o 'anonymous'.
 */
export function useAuth() {
  return useContext(AuthContext)
}
