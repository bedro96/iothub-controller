import { WebSocket } from 'ws';
import { logInfo, logError } from './logger';

interface DeviceConnection {
  uuid: string;
  ws: WebSocket;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * ConnectionManager - Manages WebSocket connections for IoT devices
 * 
 * This class handles:
 * - Device connection tracking by UUID
 * - Message broadcasting to all connected devices
 * - Targeted message sending to specific devices
 * - Connection lifecycle management
 */
export class ConnectionManager {
  private connections: Map<string, DeviceConnection>;

  constructor() {
    this.connections = new Map();
  }

  /**
   * Add a new device connection
   */
  addConnection(uuid: string, ws: WebSocket, userId?: string): void {
    const connection: DeviceConnection = {
      uuid,
      ws,
      userId,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.connections.set(uuid, connection);
    logInfo('Device connected', { uuid, userId, totalConnections: this.connections.size });

    // Handle connection close
    ws.on('close', () => {
      this.removeConnection(uuid);
    });

    // Handle errors
    ws.on('error', (error) => {
      logError(error, { context: 'WebSocket error', uuid });
      this.removeConnection(uuid);
    });

    // Update last activity on message
    ws.on('message', () => {
      const conn = this.connections.get(uuid);
      if (conn) {
        conn.lastActivity = new Date();
      }
    });
  }

  /**
   * Remove a device connection
   */
  removeConnection(uuid: string): void {
    const connection = this.connections.get(uuid);
    if (connection) {
      try {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
      } catch (error) {
        logError(error as Error, { context: 'Error closing WebSocket', uuid });
      }
      this.connections.delete(uuid);
      logInfo('Device disconnected', { uuid, totalConnections: this.connections.size });
    }
  }

  /**
   * Get a specific connection by UUID
   */
  getConnection(uuid: string): DeviceConnection | undefined {
    return this.connections.get(uuid);
  }

  /**
   * Check if a device is connected
   */
  isConnected(uuid: string): boolean {
    const connection = this.connections.get(uuid);
    return connection !== undefined && connection.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send a message to a specific device
   */
  sendToDevice(uuid: string, message: any): boolean {
    const connection = this.connections.get(uuid);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      logError(new Error('Device not connected'), { uuid });
      return false;
    }

    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      connection.ws.send(payload);
      connection.lastActivity = new Date();
      logInfo('Message sent to device', { uuid });
      return true;
    } catch (error) {
      logError(error as Error, { context: 'Failed to send message to device', uuid });
      return false;
    }
  }

  /**
   * Broadcast a message to all connected devices
   */
  broadcast(message: any, excludeUuid?: string): number {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    let sentCount = 0;

    this.connections.forEach((connection, uuid) => {
      if (excludeUuid && uuid === excludeUuid) {
        return;
      }

      if (connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(payload);
          connection.lastActivity = new Date();
          sentCount++;
        } catch (error) {
          logError(error as Error, { context: 'Failed to broadcast to device', uuid });
        }
      }
    });

    logInfo('Broadcast message sent', { sentCount, totalConnections: this.connections.size });
    return sentCount;
  }

  /**
   * Broadcast to devices of a specific user
   */
  broadcastToUser(userId: string, message: any): number {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    let sentCount = 0;

    this.connections.forEach((connection) => {
      if (connection.userId === userId && connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(payload);
          connection.lastActivity = new Date();
          sentCount++;
        } catch (error) {
          logError(error as Error, { context: 'Failed to broadcast to user device', userId });
        }
      }
    });

    logInfo('User broadcast message sent', { userId, sentCount });
    return sentCount;
  }

  /**
   * Get all connected clients with their info
   */
  getConnectedClients(): Array<{
    uuid: string;
    userId?: string;
    connectedAt: Date;
    lastActivity: Date;
    state: string;
  }> {
    const clients: Array<{
      uuid: string;
      userId?: string;
      connectedAt: Date;
      lastActivity: Date;
      state: string;
    }> = [];

    this.connections.forEach((connection) => {
      clients.push({
        uuid: connection.uuid,
        userId: connection.userId,
        connectedAt: connection.connectedAt,
        lastActivity: connection.lastActivity,
        state: this.getWebSocketState(connection.ws.readyState),
      });
    });

    return clients;
  }

  /**
   * Get total number of connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get active connection count (only OPEN connections)
   */
  getActiveConnectionCount(): number {
    let count = 0;
    this.connections.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        count++;
      }
    });
    return count;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    logInfo('Closing all connections', { count: this.connections.size });
    this.connections.forEach((connection, uuid) => {
      try {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
      } catch (error) {
        logError(error as Error, { context: 'Error closing connection', uuid });
      }
    });
    this.connections.clear();
  }

  /**
   * Helper to convert WebSocket state to string
   */
  private getWebSocketState(readyState: number): string {
    switch (readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
