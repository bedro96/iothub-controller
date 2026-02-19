import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { connectionManager } from '@/lib/connection-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ device_id: string }> }
) {
  try {
    const { device_id } = await params;

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

    // Find and verify device belongs to user
    const device = await prisma.device.findFirst({
      where: {
        id: device_id,
        userId: user.id,
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Close WebSocket connection if active
    const devUuid = (device as any).uuid
    if (devUuid) {
      connectionManager.removeConnection(devUuid);
    }

    // Delete device mappings first
    await (prisma as any).deviceMapping.deleteMany({
      where: { deviceId: device_id },
    });

    // Delete device commands
    await (prisma as any).deviceCommand.deleteMany({
      where: { deviceId: device_id },
    });

    // Delete the device
    await prisma.device.delete({
      where: { id: device_id },
    });

    return NextResponse.json({
      message: 'Device deleted successfully',
      deviceId: device_id,
    }, { status: 200 });

  } catch (error) {
    console.error('Error deleting device:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete device',
      },
      { status: 500 }
    );
  }
}
