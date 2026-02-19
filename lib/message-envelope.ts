import { randomUUID } from 'crypto';

/**
 * Message Envelope structure for WebSocket communication
 * This matches the Python server's MessageEnvelope class
 */
export interface MessageEnvelopeData {
  version?: number;
  type: string;
  id?: string;
  correlationId?: string;
  ts?: string;
  action: string;
  status?: string;
  payload?: Record<string, any>;
  meta?: Record<string, any>;
}

export class MessageEnvelope {
  version: number;
  type: string;
  id: string;
  correlationId: string;
  ts: string;
  action: string;
  status?: string;
  payload: Record<string, any>;
  meta: Record<string, any>;

  constructor(data: MessageEnvelopeData) {
    this.version = data.version || 1;
    this.type = data.type;
    this.id = data.id || randomUUID();
    this.correlationId = data.correlationId || this.id;
    this.ts = data.ts || new Date().toISOString();
    this.action = data.action;
    this.status = data.status;
    this.payload = data.payload || {};
    this.meta = data.meta || {};
  }

  toDict(): Record<string, any> {
    const result: Record<string, any> = {
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
      result.status = this.status;
    }
    
    return result;
  }

  toJSON(): string {
    return JSON.stringify(this.toDict());
  }

  static fromDict(data: Record<string, any>): MessageEnvelope {
    return new MessageEnvelope({
      version: data.version,
      type: data.type,
      id: data.id,
      correlationId: data.correlationId,
      ts: data.ts,
      action: data.action || '',
      status: data.status,
      payload: data.payload,
      meta: data.meta,
    });
  }
}

/**
 * Helper function to generate ISO8601 timestamp
 */
export function isoNow(): string {
  return new Date().toISOString();
}
