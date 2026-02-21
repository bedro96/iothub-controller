"use client"

import { useCallback, useState } from 'react'

type FetchWithCsrf = (input: RequestInfo, init?: RequestInit) => Promise<Response>

export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  const fetchToken = useCallback(async (): Promise<string | null> => {
    if (csrfToken) return csrfToken
    try {
      const resp = await fetch('/api/auth/csrf', { credentials: 'include' })
      if (!resp.ok) return null
      const data = await resp.json()
      const token = data?.csrfToken || null
      setCsrfToken(token)
      return token
    } catch {
      return null
    }
  }, [csrfToken])

  const ensureCsrf = useCallback(async (): Promise<string | null> => {
    return await fetchToken()
  }, [fetchToken])

  const fetchWithCsrf: FetchWithCsrf = useCallback(async (input, init = {}) => {
    let token = csrfToken
    if (!token) token = await fetchToken()

    const headers = new Headers(init.headers as HeadersInit | undefined)
    if (token) headers.set('x-csrf-token', token)
    // preserve provided credentials or default to include
    const credentials = (init.credentials as RequestCredentials) || 'include'

    return fetch(input, { ...init, headers, credentials })
  }, [csrfToken, fetchToken])

  return { csrfToken, setCsrfToken, ensureCsrf, fetchWithCsrf }
}

export default useCsrf
