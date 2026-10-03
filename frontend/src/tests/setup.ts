import '@testing-library/jest-dom'
import { afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// React 18 requires this flag for act() to know it is running inside a test.
// Without it every state update triggers an "not wrapped in act(...)" warning.
beforeAll(() => {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  scope.IS_REACT_ACT_ENVIRONMENT = true
})

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock window.location.replace (used in interceptors on auth failure)
Object.defineProperty(window, 'location', {
  value: { ...window.location, replace: vi.fn() },
  writable: true,
})

// Pin toast ids so assertions are deterministic. Only randomUUID is overridden;
// replacing the whole crypto object would strip getRandomValues and friends.
Object.defineProperty(globalThis.crypto, 'randomUUID', {
  value: () => 'test-uuid-1234',
  configurable: true,
  writable: true,
})