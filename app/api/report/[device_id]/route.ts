import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Default telemetry values
const DEFAULT_TEMPERATURE = 20;
const DEFAULT_HUMIDITY = 50;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ device_id: string }> }
) {
  try {
    const { device_id } = await params;
    const body = await request.json();

    // Extract telemetry data from body
    // Support both capitalized (Type, Status, Humidity) and lowercase field names for compatibility
    const deviceId = body.deviceId || device_id;
    const type = body.Type || body.type || '';
    const modelId = body.modelId || '';
    const status = body.Status || body.status || '';
    const temp = body.temp !== undefined ? parseFloat(body.temp) : DEFAULT_TEMPERATURE;
    const humidity = body.Humidity !== undefined ? parseFloat(body.Humidity) : (body.humidity !== undefined ? parseFloat(body.humidity) : DEFAULT_HUMIDITY);
    const ts = body.ts || new Date().toISOString();

    // Store telemetry data
    await prisma.telemetry.create({
      data: {
        deviceId,
        type,
        modelId,
        status,
        temp,
        humidity,
        ts,
      },
    });

    return NextResponse.json({
      status: 'saved',
      device_id: deviceId,
    }, { status: 200 });

  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save report',
      },
      { status: 500 }
    );
  }
}
