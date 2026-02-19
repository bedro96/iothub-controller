import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { connectionManager } from '@/lib/connection-manager';
import { MessageEnvelope } from '@/lib/message-envelope';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

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

    // Find device by UUID
    const device = await prisma.device.findFirst({
      where: {
        uuid,
        userId: user.id,
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Check if device is connected
    if (!connectionManager.isConnected(uuid)) {
      return NextResponse.json(
        { error: 'Device is not connected' },
        { status: 400 }
      );
    }

    // Generate correlation ID for message tracking
    const correlationId = MessageEnvelope.generateUUID();

    // Create command record
    const deviceCommand = await prisma.deviceCommand.create({
      data: {
        command: actionName,
        payload: payload || {},
        uuid,
        deviceId: device.id,
        userId: user.id,
        status: 'sent',
        broadcast: false,
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
        broadcast: false,
        source: 'api',
        targetUuid: uuid,
        commandId: deviceCommand.id, // Store ObjectId in meta for reference
      },
    });

    const sent = connectionManager.sendToDevice(uuid, envelope.toJSON());

    if (!sent) {
      // Update command status to failed
      await prisma.deviceCommand.update({
        where: { id: deviceCommand.id },
        data: { status: 'failed' },
      });

      return NextResponse.json(
        { error: 'Failed to send command to device' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Command sent successfully',
      commandId: deviceCommand.id,
      uuid,
      deviceId: device.id,
    }, { status: 200 });

  } catch (error) {
    console.error('Error sending command:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send command',
      },
      { status: 500 }
    );
  }
}
