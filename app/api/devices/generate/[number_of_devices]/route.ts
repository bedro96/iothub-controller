import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { logInfo } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ number_of_devices: string }> }
) {
  try {
    const { number_of_devices } = await params;
    const numberOfDevices = parseInt(number_of_devices, 10);

    if (isNaN(numberOfDevices) || numberOfDevices <= 0 || numberOfDevices > 1000) {
      return NextResponse.json(
        { error: 'Invalid number of devices. Must be between 1 and 1000' },
        { status: 400 }
      );
    }

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

    // Generate device IDs and create DeviceId entries (matching Python server logic)
    const generatedDeviceIds = [];
    
    for (let i = 0; i < numberOfDevices; i++) {
      const deviceId = `simdevice${String(i + 1).padStart(4, '0')}`;
      generatedDeviceIds.push(deviceId);
      
      // Create DeviceId entry (without UUID assigned yet - will be assigned on WebSocket connect)
      try {
        await prisma.deviceId.create({
          data: {
            deviceId,
            deviceUuid: null,
          },
        });
      } catch (error) {
        // If device already exists, continue
        logInfo('Device already exists, skipping', { deviceId });
      }
    }

    return NextResponse.json({
      message: `Successfully generated ${numberOfDevices} device IDs`,
      generated_device_ids: generatedDeviceIds,
    }, { status: 201 });

  } catch (error) {
    console.error('Error generating devices:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate devices',
      },
      { status: 500 }
    );
  }
}
