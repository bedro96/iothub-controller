import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { connectionManager } from '@/lib/connection-manager';

export async function POST(request: NextRequest) {
  try {
    // Get user email from header for authorization
    const userEmail = request.headers.get('x-user-email');
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email required' },
        { status: 401 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all user's devices
    const devices = await prisma.device.findMany({
      where: { userId: user.id },
    });

    // Close all WebSocket connections for these devices
    for (const device of devices) {
      const uuid = (device as any).uuid
      if (uuid) {
        connectionManager.removeConnection(uuid)
      }
    }

    // Delete all device mappings for this user
    await (prisma as any).deviceMapping.deleteMany({
      where: { userId: user.id },
    });

    // Delete all device commands for this user
    await (prisma as any).deviceCommand.deleteMany({
      where: { userId: user.id },
    });

    // Delete all devices for this user
    const result = await prisma.device.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
      message: 'All devices deleted successfully',
      deletedCount: result.count,
    }, { status: 200 });

  } catch (error) {
    console.error('Error deleting all devices:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete devices',
      },
      { status: 500 }
    );
  }
}
