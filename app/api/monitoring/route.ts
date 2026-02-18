import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import fs from 'fs/promises'
import path from 'path'

/**
 * GET /api/monitoring/logs
 * Get recent logs
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    
    const { searchParams } = new URL(request.url)
    const logType = searchParams.get('type') || 'application'
    const lines = parseInt(searchParams.get('lines') || '100', 10)
    
    const logsDir = path.join(process.cwd(), 'logs')
    const today = new Date().toISOString().split('T')[0]
    
    let filename: string
    switch (logType) {
      case 'error':
        filename = `error-${today}.log`
        break
      case 'http':
        filename = `http-${today}.log`
        break
      default:
        filename = `application-${today}.log`
    }
    
    const logPath = path.join(logsDir, filename)
    
    try {
      const content = await fs.readFile(logPath, 'utf-8')
      const logLines = content.split('\n').filter(line => line.trim())
      const recentLogs = logLines.slice(-lines)
      
      return NextResponse.json({
        logs: recentLogs.map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return { message: line }
          }
        })
      })
    } catch {
      // Log file doesn't exist yet
      return NextResponse.json({ logs: [] })
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }
    console.error("Get logs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/monitoring/stats
 * Get system statistics
 */
export async function POST() {
  try {
    await requireAdmin()
    
    // Get database stats
    const [userCount, sessionCount, deviceCount, auditLogCount] = await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.device.count(),
      prisma.auditLog.count(),
    ])
    
    // Get recent audit logs
    const recentAuditLogs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    })
    
    return NextResponse.json({
      stats: {
        users: userCount,
        sessions: sessionCount,
        devices: deviceCount,
        auditLogs: auditLogCount,
      },
      recentAuditLogs,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }
    console.error("Get stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
