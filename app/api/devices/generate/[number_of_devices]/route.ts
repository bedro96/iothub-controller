import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCSRFToken } from '@/lib/csrf';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ number_of_devices: string }> }
) {
  try {
    const token = await getCSRFToken()
    if(!token) {
      return NextResponse.json(
        { error: 'CSRF token missing or invalid' },
        { status: 403 }
      )
    }
    const { number_of_devices } = await params;
    const numberOfDevices = parseInt(number_of_devices, 10);

    if (isNaN(numberOfDevices) || numberOfDevices <= 0 || numberOfDevices > 1000) {
      return NextResponse.json(
        { error: 'Invalid number of devices. Must be between 1 and 1000' },
        { status: 400 }
      );
    }
    
    const generatedDeviceIds: string[] = [];
    
    const data = Array.from({ length: numberOfDevices }, (_, i) => {
      const n = String(i + 1).padStart(4, "0"); // 0001~0010
      generatedDeviceIds.push(`simdevice${n}`);
      return {
        deviceId: `simdevice${n}`,
        deviceUuid: null, // No UUID assigned yet - will be assigned on WebSocket connect when device claims an ID
      };
    });

    await prisma.deviceId.createMany({ data });
    
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
