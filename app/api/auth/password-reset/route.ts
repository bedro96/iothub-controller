import { NextRequest, NextResponse } from "next/server"
import { createPasswordResetToken, resetPassword } from "@/lib/auth"
import { logAudit, logInfo } from "@/lib/logger"
import { getRequestIP } from '@/lib/request'

/**
 * POST /api/auth/password-reset
 * Request a password reset token
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Always return success to prevent email enumeration
    const token = await createPasswordResetToken(email)
    
    if (token) {
      const ip = getRequestIP(request)
      logInfo('Password reset requested', { email })
      await logAudit('user.password_reset_requested', null, {
        userEmail: email,
        ipAddress: ip,
      })
      
      // In production, send email with reset link
      // For now, just return the token (remove this in production!)
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          message: "Password reset email sent",
          token, // Only for development
        })
      }
    }

    return NextResponse.json({
      message: "If an account with that email exists, a password reset link has been sent",
    })
  } catch (error) {
    console.error("Password reset request error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/auth/password-reset
 * Reset password using token
 */
export async function PATCH(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json()

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    const success = await resetPassword(token, newPassword)

    if (!success) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      )
    }

    const ip2 = getRequestIP(request)
    logInfo('Password reset completed', { token })
    await logAudit('user.password_reset_completed', null, {
      ipAddress: ip2,
    })

    return NextResponse.json({
      message: "Password reset successful",
    })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
