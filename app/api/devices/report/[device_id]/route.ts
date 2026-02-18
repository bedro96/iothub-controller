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

    // Find device
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

    // Get report data (metadata and recent activity)
    const report = {
      deviceId: device.id,
      name: device.name,
      type: device.type,
      status: device.status,
      connectionStatus: device.connectionStatus,
      uuid: device.uuid,
      metadata: device.metadata,
      lastSeen: device.lastSeen,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      isConnected: device.uuid ? connectionManager.isConnected(device.uuid) : false,
    };

    return NextResponse.json(report, { status: 200 });

  } catch (error) {
    console.error('Error getting device report:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get device report',
      },
      { status: 500 }
    );
  }
}
