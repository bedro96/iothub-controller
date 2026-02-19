import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { connectionManager } from '@/lib/connection-manager';
import { MessageEnvelope } from '@/lib/message-envelope';

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
    const { command, payload, action } = body;

    // Support both 'command' and 'action' fields for compatibility
    const actionName = action || command;

    if (!actionName) {
      return NextResponse.json(
        { error: 'Command or action is required' },
        { status: 400 }
      );
    }

    // Generate correlation ID for message tracking
    const correlationId = crypto.randomUUID();

    // Create command record
    const deviceCommand = await prisma.deviceCommand.create({
      data: {
        command: actionName,
        payload: payload || {},
        broadcast: true,
        userId: user.id,
        status: 'sent',
        correlationId,
      },
    });

    // Create message using MessageEnvelope format
    const envelope = new MessageEnvelope({
      type: 'command',
      action: actionName,
      id: correlationId, // Use correlationId as message ID
      payload: payload || {},
      meta: {
        broadcast: true,
        source: 'api',
        commandId: deviceCommand.id, // Store ObjectId in meta for reference
      },
    });

    const sentCount = connectionManager.broadcast(envelope.toJSON());

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
