import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { logAudit } from "@/lib/logger"

/**
 * GET /api/devices
 * Get all devices for the current user
 */
export async function GET() {
  try {
    const session = await requireAuth()

    const devices = await prisma.device.findMany({
      where: {
        userId: session.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ devices })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
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
        userId: session.userId,
      },
    })

    await logAudit('device.created', session.userId, {
      deviceId: device.id,
      deviceName: name,
      ipAddress: request.ip,
    })

    return NextResponse.json({ device }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    console.error("Create device error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/devices
 * Update a device
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { id, name, type, status, metadata } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      )
    }

    // Check if device belongs to user
    const existingDevice = await prisma.device.findUnique({
      where: { id },
    })

    if (!existingDevice || existingDevice.userId !== session.userId) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      )
    }

    const device = await prisma.device.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(status && { status }),
        ...(metadata && { metadata }),
      },
    })

    await logAudit('device.updated', session.userId, {
      deviceId: device.id,
      ipAddress: request.ip,
    })

    return NextResponse.json({ device })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    console.error("Update device error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/devices
 * Delete a device
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("id")

    if (!deviceId) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      )
    }

    // Check if device belongs to user
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    })

    if (!device || device.userId !== session.userId) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      )
    }

    await prisma.device.delete({
      where: { id: deviceId },
    })

    await logAudit('device.deleted', session.userId, {
      deviceId,
      ipAddress: request.ip,
    })

    return NextResponse.json({ message: "Device deleted successfully" })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    console.error("Delete device error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
