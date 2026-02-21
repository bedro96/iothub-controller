import { EventHubConsumerClient, earliestEventPosition } from '@azure/event-hubs';
import { prisma } from './prisma';
import { logInfo, logError, logWarn } from './logger';

const CONSUMER_GROUP = process.env.IOT_EVENTHUB_CONSUMER_GROUP || '$Default';

/**
 * Parse a D2C telemetry message body received from Azure IoT Hub.
 * Supports both capitalized (Type, Status, Humidity) and lowercase field names.
 */
function parseTelemetryBody(body: unknown): {
  deviceId: string;
  type: string;
  modelId: string;
  status: string;
  temp: number;
  humidity: number;
  ts: string;
} | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const b = body as Record<string, unknown>;

  /** Return the first string value found among the given keys. */
  function str(...keys: string[]): string {
    for (const k of keys) {
      if (typeof b[k] === 'string') return b[k] as string;
    }
    return '';
  }

  /** Return the first numeric value found among the given keys, falling back to `def`. */
  function num(def: number, ...keys: string[]): number {
    for (const k of keys) {
      if (typeof b[k] === 'number') return b[k] as number;
      if (typeof b[k] === 'string') {
        const parsed = parseFloat(b[k] as string);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return def;
  }

  return {
    deviceId: str('deviceId', 'DeviceId'),
    type:     str('Type', 'type'),
    modelId:  str('modelId', 'ModelId'),
    status:   str('Status', 'status'),
    temp:     num(20, 'temp'),
    humidity: num(50, 'Humidity', 'humidity'),
    ts:       str('ts') || new Date().toISOString(),
  };
}

/**
 * Start the Azure IoT Hub D2C message consumer.
 *
 * Connects to the IoT Hub EventHub-compatible endpoint using
 * IOT_EVENTHUB_CONNECTION_STRING, subscribes to all partitions, and
 * continuously saves incoming telemetry messages to the Prisma Telemetry model.
 *
 * The returned function can be called to stop the consumer gracefully.
 */
export async function startIoTHubConsumer(): Promise<() => Promise<void>> {
  const connectionString = process.env.IOT_EVENTHUB_CONNECTION_STRING;

  if (!connectionString) {
    logWarn('IOT_EVENTHUB_CONNECTION_STRING is not set — IoT Hub D2C consumer will not start');
    return async () => {};
  }

  const client = new EventHubConsumerClient(CONSUMER_GROUP, connectionString);

  const subscription = client.subscribe(
    {
      processEvents: async (events, context) => {
        for (const event of events) {
          try {
            const body = parseTelemetryBody(event.body);
            if (!body) {
              logWarn('Received IoT Hub D2C message with unrecognized body format', {
                partition: context.partitionId,
                sequenceNumber: event.sequenceNumber,
              });
              continue;
            }

            await (prisma as any).telemetry.create({ data: body });

            logInfo('IoT Hub D2C message saved', {
              deviceId: body.deviceId,
              ts: body.ts,
              partition: context.partitionId,
              sequenceNumber: event.sequenceNumber,
            });
          } catch (error) {
            logError(error as Error, {
              context: 'Failed to save IoT Hub D2C message',
              partition: context.partitionId,
              sequenceNumber: event.sequenceNumber,
            });
          }
        }
      },
      processError: async (error, context) => {
        logError(error, {
          context: 'IoT Hub D2C consumer error',
          partition: context.partitionId,
        });
      },
    },
    { startPosition: earliestEventPosition }
  );

  logInfo('IoT Hub D2C consumer started', { consumerGroup: CONSUMER_GROUP });

  return async () => {
    await subscription.close();
    await client.close();
    logInfo('IoT Hub D2C consumer stopped');
  };
}
