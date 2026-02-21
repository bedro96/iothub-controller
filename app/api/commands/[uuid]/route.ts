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

    // Parse request body
    const body = await request.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Find device by UUID
    const device = await prisma.device.findFirst({
      where: ({
        uuid,
        userId: user.id,
      } as any),
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

    // Create command record
    const deviceCommand = await (prisma as any).deviceCommand.create({
      data: {
        command: action,
        payload: payload || {},
        uuid,
        deviceId: device.id,
        userId: user.id,
        status: 'sent',
        broadcast: false,
      },
    });

    // Create MessageEnvelope for command
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

    const sent = connectionManager.sendToDevice(uuid, envelope.toDict());

    if (!sent) {
      // Update command status to failed
      await (prisma as any).deviceCommand.update({
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
