import { NextRequest, NextResponse } from "next/server"
import { destroySession, getSession } from "@/lib/auth"
import { logAudit, logInfo } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (session) {
      logInfo('User logged out', { userId: session.userId, email: session.email })
      await logAudit('user.logout', session.userId, {
        userEmail: session.email,
        ipAddress: request.ip,
      })
    }
    
    await destroySession()
    
    return NextResponse.json({ message: "Logged out successfully" })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
