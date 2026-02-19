import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { connectionManager } from '@/lib/connection-manager';

export async function GET(request: NextRequest) {
  try {
    // Check database connection (MongoDB-friendly)
    await prisma.user.count();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        websocket: 'active',
      },
      connections: {
        total: connectionManager.getConnectionCount(),
        active: connectionManager.getActiveConnectionCount(),
      },
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
