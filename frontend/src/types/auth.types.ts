export interface LoginPayload {
  email: string
  password: string
}

/**
 * Wire format for a signup request. The form-level type (schemas/auth.schema)
 * adds `confirmPassword`, which is validated client-side and stripped before the
 * request is sent.
 */
export interface SignUpPayload {
  name: string
  email: string
  password: string
  age: number
}

/** The backend returns both tokens; the refresh token drives silent re-auth. */
export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export type AuthResponse = AuthTokens

/** The authenticated account, as returned by GET /me. */
export interface AuthUser {
  user_id: number
  name: string
  email: string
  age: number
}