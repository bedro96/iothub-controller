import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ device_id: string }> }
) {
  try {
    const { device_id } = await params;
    const body = await request.json();

    // Extract telemetry data from body
    const deviceId = body.deviceId || device_id;
    const type = body.Type || body.type || '';
    const modelId = body.modelId || '';
    const status = body.Status || body.status || '';
    const temp = body.temp !== undefined ? parseFloat(body.temp) : 20;
    const humidity = body.Humidity !== undefined ? parseFloat(body.Humidity) : 50;
    const ts = body.ts || new Date().toISOString();

    // Store telemetry data
    await (prisma as any).telemetry.create({
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
