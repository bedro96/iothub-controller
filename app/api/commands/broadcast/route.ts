import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { connectionManager } from '@/lib/connection-manager';
import { MessageEnvelope } from '@/lib/message-envelope';

export async function POST(request: NextRequest) {
  try {

    // Parse request body
    const body = await request.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Create command record
    const deviceCommand = await (prisma as any).deviceCommand.create({
      data: {
        command: action,
        payload: payload || {},
        broadcast: true,
        userId: user.id,
        status: 'sent',
      },
    });

    // Create MessageEnvelope for broadcast
    const envelope = new MessageEnvelope({
      version: 1,
      type: 'command',
      action,
      payload: payload || {},
      status: 'pending',
      meta: {
        commandId: deviceCommand.id,
        timestamp: new Date().toISOString(),
      },
    });

    const sentCount = connectionManager.broadcast(envelope.toDict());

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
