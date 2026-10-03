import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/app/store'

const TOKENS = { accessToken: 'access.jwt.token', refreshToken: 'refresh.jwt.token' }
const USER = { user_id: 7, name: 'Ada Lovelace', email: 'ada@example.com', age: 36 }

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    })
  })

  it('initializes with no token, no user and unauthenticated', () => {
    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setTokens stores both tokens and marks authenticated', () => {
    useAuthStore.getState().setTokens(TOKENS)
    const state = useAuthStore.getState()
    expect(state.accessToken).toBe(TOKENS.accessToken)
    expect(state.refreshToken).toBe(TOKENS.refreshToken)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setTokens overwrites a previous session', () => {
    useAuthStore.getState().setTokens(TOKENS)
    useAuthStore.getState().setTokens({
      accessToken: 'new.access',
      refreshToken: 'new.refresh',
    })
    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('new.access')
    expect(state.refreshToken).toBe('new.refresh')
  })

  it('setUser stores the account profile', () => {
    useAuthStore.getState().setTokens(TOKENS)
    useAuthStore.getState().setUser(USER)
    expect(useAuthStore.getState().user).toEqual(USER)
  })

  it('clearToken removes both tokens, the profile and marks unauthenticated', () => {
    useAuthStore.getState().setTokens(TOKENS)
    useAuthStore.getState().setUser(USER)
    useAuthStore.getState().clearToken()
    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('persists the session to sessionStorage and restores it', () => {
    useAuthStore.getState().setTokens(TOKENS)
    useAuthStore.getState().setUser(USER)

    const raw = sessionStorage.getItem('investment-engine-auth')
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw as string)
    expect(parsed.state.accessToken).toBe(TOKENS.accessToken)
    expect(parsed.state.refreshToken).toBe(TOKENS.refreshToken)
    expect(parsed.state.user).toEqual(USER)
    // isAuthenticated is derived on rehydrate, so it is intentionally not persisted.
    expect(parsed.state.isAuthenticated).toBeUndefined()
  })
})