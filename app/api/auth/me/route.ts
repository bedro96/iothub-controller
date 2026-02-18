import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

/**
 * GET /api/auth/me
 * Get current user session
 */
export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    
    return NextResponse.json({
      user: {
        userId: session.userId,
        email: session.email,
        role: session.role,
      },
    })
  } catch (error) {
    console.error("Get session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
