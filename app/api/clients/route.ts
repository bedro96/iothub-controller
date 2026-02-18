import { NextRequest, NextResponse } from 'next/server';
import { connectionManager } from '@/lib/connection-manager';

export async function GET(request: NextRequest) {
  try {
    const clients = connectionManager.getConnectedClients();
    
    return NextResponse.json({
      total: clients.length,
      active: connectionManager.getActiveConnectionCount(),
      clients: clients,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get clients',
      },
      { status: 500 }
    );
  }
}
