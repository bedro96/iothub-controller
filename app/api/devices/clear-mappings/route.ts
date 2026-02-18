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

    // Delete all device mappings for this user
    const result = await prisma.deviceMapping.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
      message: 'All device mappings cleared successfully',
      deletedCount: result.count,
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
