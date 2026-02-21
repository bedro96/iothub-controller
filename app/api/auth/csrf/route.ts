import { NextResponse } from "next/server"
import { setCSRFToken, getCSRFToken } from "@/lib/csrf"

/**
 * GET /api/auth/csrf
 * Gets a CSRF cookie and returns the token so the client can include it
 */
export async function GET() {
  try {
    const token = await getCSRFToken()
    return NextResponse.json({ csrfToken: token })
  } catch (error) {
    console.error('CSRF token error:', error)
    return NextResponse.json({ error: 'Failed to get CSRF token' }, { status: 500 })
  }
}

/**
 *  POST /api/auth/csrf
 *  Sets a CSRF cookie and returns the token
 */
export async function POST() {
  try {
    const token = await setCSRFToken()
    return NextResponse.json({ csrfToken: token })
  } catch (error) {
    console.error('CSRF token error:', error)
    return NextResponse.json({ error: 'Failed to set CSRF token' }, { status: 500 })
  }
}

