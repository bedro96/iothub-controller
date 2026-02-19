/**
 * MessageEnvelope - Standard message format for IoT device communication
 * 
 * This structure matches the Python server's MessageEnvelope class and
 * ensures compatibility with the Java client (SimulatorWSClient.java)
 */

export type MessageType = 'command' | 'request' | 'response' | 'report' | 'error' | 'event' | 'ack' | 'heartbeat';

export type MessageStatus = 'success' | 'failure' | 'pending' | 'received' | string;

export interface MessageEnvelopeData {
  version?: number;
  type: MessageType;
  id: string;
  correlationId?: string;
  ts?: string;
  action: string;
  status?: MessageStatus;
  payload?: Record<string, any>;
  meta?: Record<string, any>;
}

/**
 * MessageEnvelope class for structured IoT communication
 * 
 * Follows the format:
 * {
 *   "version": 1,
 *   "type": "command",
 *   "id": "uuid",
 *   "correlationId": "uuid",
 *   "ts": "2025-11-28T05:15:37Z",
 *   "action": "device.config.update",
 *   "status": "success",
 *   "payload": {},
 *   "meta": {}
 * }
 */
export class MessageEnvelope {
  version: number;
  type: MessageType;
  id: string;
  correlationId: string;
  ts: string;
  action: string;
  status?: MessageStatus;
  payload: Record<string, any>;
  meta: Record<string, any>;

  constructor(data: MessageEnvelopeData) {
    this.version = data.version || 1;
    this.type = data.type;
    this.id = data.id || this.generateUUID();
    this.correlationId = data.correlationId || this.id;
    this.ts = data.ts || this.getISOTimestamp();
    this.action = data.action;
    this.status = data.status;
    this.payload = data.payload || {};
    this.meta = data.meta || {};
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON(): Record<string, any> {
    const obj: Record<string, any> = {
      version: this.version,
      type: this.type,
      id: this.id,
      correlationId: this.correlationId,
      ts: this.ts,
      action: this.action,
      payload: this.payload,
      meta: this.meta,
    };

    if (this.status !== undefined) {
      obj.status = this.status;
    }

    return obj;
  }

  /**
   * Convert to JSON string
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Create MessageEnvelope from incoming message data
   * Handles both camelCase and snake_case field names for compatibility
   */
  static fromJSON(data: any): MessageEnvelope {
    // Handle both correlationId (camelCase) and correlation_id (snake_case)
    // Java client sends correlation_id, Python server uses correlationId
    const correlationId = data.correlationId || data.correlation_id;

    return new MessageEnvelope({
      version: data.version,
      type: data.type,
      id: data.id,
      correlationId,
      ts: data.ts,
      action: data.action,
      status: data.status,
      payload: data.payload,
      meta: data.meta,
    });
  }

  /**
   * Create a response envelope for a given request
   */
  static createResponse(
    request: MessageEnvelope | any,
    action: string,
    payload: Record<string, any>,
    status: MessageStatus = 'success'
  ): MessageEnvelope {
    const requestId = request.id || request.correlationId || request.correlation_id;
    
    return new MessageEnvelope({
      type: 'response',
      id: MessageEnvelope.generateUUID(),
      correlationId: requestId,
      action,
      payload,
      status,
    });
  }

  /**
   * Create an error envelope
   */
  static createError(
    request: MessageEnvelope | any,
    message: string,
    details?: Record<string, any>
  ): MessageEnvelope {
    const requestId = request.id || request.correlationId || request.correlation_id;
    
    return new MessageEnvelope({
      type: 'error',
      id: MessageEnvelope.generateUUID(),
      correlationId: requestId,
      action: request.action || 'unknown',
      payload: {},
      status: 'failure',
      meta: {
        error: message,
        ...details,
      },
    });
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return MessageEnvelope.generateUUID();
  }

  static generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Get ISO 8601 timestamp
   */
  private getISOTimestamp(): string {
    return new Date().toISOString();
  }
}

/**
 * Helper function to safely parse incoming WebSocket message
 */
export function parseMessage(data: string | Buffer): MessageEnvelope | null {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
    return MessageEnvelope.fromJSON(parsed);
  } catch (error) {
    console.error('Failed to parse message:', error);
    return null;
  }
}
