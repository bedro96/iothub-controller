import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/telemetry
 *
 * Returns the most recent Device-to-Cloud (D2C) telemetry records saved by
 * the IoT Hub consumer. Optionally filter by deviceId and control the result
 * count with the `limit` query parameter (default 50, max 200).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') || undefined;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      200
    );

    const where = deviceId ? { deviceId } : {};

    const records = await (prisma as any).telemetry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ telemetry: records });
  } catch (error) {
    console.error('Error fetching telemetry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch telemetry' },
      { status: 500 }
    );
  }
}
