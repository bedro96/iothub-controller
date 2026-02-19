import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { connectionManager } from '@/lib/connection-manager';

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

    // Parse request body
    const body = await request.json();
    const { command, payload } = body;

    if (!command) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      );
    }

    // Create command record
    const deviceCommand = await (prisma as any).deviceCommand.create({
      data: {
        command,
        payload: payload || {},
        broadcast: true,
        userId: user.id,
        status: 'sent',
      },
    });

    // Broadcast to all connected devices
    const message = {
      type: 'command',
      commandId: deviceCommand.id,
      command,
      payload: payload || {},
      timestamp: new Date().toISOString(),
    };

    const sentCount = connectionManager.broadcast(message);

    return NextResponse.json({
      message: 'Command broadcast successfully',
      commandId: deviceCommand.id,
      sentCount,
      totalConnections: connectionManager.getConnectionCount(),
    }, { status: 200 });

  } catch (error) {
    console.error('Error broadcasting command:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to broadcast command',
      },
      { status: 500 }
    );
  }
}
