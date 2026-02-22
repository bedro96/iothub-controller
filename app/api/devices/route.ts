import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { logAudit } from "@/lib/logger"
import { getRequestIP } from '@/lib/request'

/**
 * GET /api/devices
 * Get all devices for the current user
 */
export async function GET() {
  try {


    const devices = await prisma.device.findMany({
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ devices })
  } catch (error) {

    
  console.error("Get devices error:", error)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  )
  }
}


/**
 * POST /api/devices
 * Create a new device
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { name, type, metadata } = await request.json()

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      )
    }

    const device = await prisma.device.create({
      data: {
        name,
        type,
        metadata: metadata || {},
      },
    })

    }
  catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
  } 
}

/**
 * PATCH /api/devices
 * Update a device
 */


/**
 * DELETE /api/devices
 * Delete a device
 */

