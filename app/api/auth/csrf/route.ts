import { NextResponse } from "next/server"
import { setCSRFToken } from "@/lib/csrf"

/**
 * GET /api/auth/csrf
 * Sets a CSRF cookie and returns the token so the client can include it
 */
export async function GET() {
  try {
    const token = await setCSRFToken()
    return NextResponse.json({ csrfToken: token })
  } catch (error) {
    console.error('CSRF token error:', error)
    return NextResponse.json({ error: 'Failed to generate CSRF token' }, { status: 500 })
  }
}
