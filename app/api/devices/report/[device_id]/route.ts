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
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Get report data (metadata and recent activity)
    const d = device as any
    const report = {
      deviceId: d.id,
      name: d.name,
      type: d.type,
      status: d.status,
      connectionStatus: d.connectionStatus,
      uuid: d.uuid,
      metadata: d.metadata,
      lastSeen: d.lastSeen,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      isConnected: d.uuid ? connectionManager.isConnected(d.uuid) : false,
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
