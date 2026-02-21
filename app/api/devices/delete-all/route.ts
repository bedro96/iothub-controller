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

    // Get all DeviceId entries
    const deviceIdEntries = await (prisma as any).deviceId.findMany();
    const deviceIds = deviceIdEntries.map((entry: any) => entry.deviceId);

    // Close all WebSocket connections
    for (const entry of deviceIdEntries) {
      if (entry.deviceUuid) {
        connectionManager.removeConnection(entry.deviceUuid);
      }
    }

    // Delete all DeviceId entries
    await prisma.deviceId.deleteMany({});

    // // Delete all device-related data for this user
    // await prisma.deviceMapping.deleteMany({
    //   where: { userId: user.id },
    // });

    // await prisma.deviceCommand.deleteMany({
    //   where: { userId: user.id },
    // });

    // await prisma.device.deleteMany({
    //   where: { userId: user.id },
    // });

    return NextResponse.json({
      message: 'All devices deleted successfully',
      status: 'all devices deleted',
      deletedDeviceIds: deviceIds,
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
