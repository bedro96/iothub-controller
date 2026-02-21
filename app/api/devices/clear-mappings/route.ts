import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCSRFToken } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    const token = await getCSRFToken()
    if(!token) {
      return NextResponse.json(
        { error: 'CSRF token missing or invalid' },
        { status: 403 }
      )
    }


    // Clear device UUID mappings (set deviceUuid to null)
    await (prisma as any).deviceId.updateMany({
      data: {
        deviceUuid: null,
      },
    });

    return NextResponse.json({
      message: 'All device mappings cleared successfully',
      status: 'all mappings cleared',
    }, { status: 200 });

  } catch (error) {
    console.error('Error clearing mappings:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to clear mappings',
      },
      { status: 500 }
    );
  }
}
