import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

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

    // Generate devices
    const devices = [];
    const mappings = [];

    for (let i = 0; i < numberOfDevices; i++) {
      const uuid = randomUUID();
      const deviceName = `Device-${uuid.substring(0, 8)}`;
      
      devices.push({
        name: deviceName,
        type: 'simulated',
        status: 'offline',
        userId: user.id,
        uuid: uuid,
        connectionStatus: 'disconnected',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create devices in batch
    const createdDevices = await prisma.$transaction(
      devices.map(device => 
        prisma.device.create({
          data: device,
        })
      )
    );

    // Create mappings in batch
    const mappingData = createdDevices
      .filter(device => device.uuid)
      .map(device => ({
        uuid: device.uuid!,
        deviceId: device.id,
        userId: user.id,
      }));

    await prisma.deviceMapping.createMany({
      data: mappingData,
    });

    return NextResponse.json({
      message: `Successfully generated ${numberOfDevices} devices`,
      count: createdDevices.length,
      devices: createdDevices,
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
