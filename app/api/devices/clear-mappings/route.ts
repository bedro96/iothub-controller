import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
