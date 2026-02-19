import { NextRequest } from 'next/server'

/**
 * Safely extract an IP address from a NextRequest in a runtime-agnostic way.
 * Looks for runtime-provided `request.ip` (some hosts), then common proxy headers.
 */
export function getRequestIP(request: NextRequest): string | null {
  // runtime-specific property
  const runtimeIp = (request as any).ip
  if (runtimeIp) return runtimeIp

  // standard proxy headers
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  return null
}

export default getRequestIP
