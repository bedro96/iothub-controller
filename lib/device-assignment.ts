import { prisma } from './prisma';
import { logInfo, logError } from './logger';

/**
 * Device ID Assignment Logic
 * 
 * This module handles assigning device IDs to IoT devices when they connect.
 * It matches the Python server's assign_device_id functionality.
 */

/**
 * Assign a device ID to a connecting device based on its UUID
 * 
 * This function finds an available device (one without a UUID assigned yet)
 * and assigns the given UUID to it. This matches the Python server's behavior
 * where devices are pre-created and then assigned to connecting clients.
 * 
 * @param deviceUuid - The UUID from the connecting device (from WebSocket path)
 * @returns The assigned device_id string (device name)
 * @throws Error if no available devices found
 */
export async function assignDeviceId(deviceUuid: string): Promise<string> {
  try {
    // Find a device that doesn't have a UUID assigned yet
    // This is similar to the Python server's query:
    // SELECT device_id FROM deviceids WHERE device_uuid IS NULL ORDER BY device_id ASC LIMIT 1
    
    const availableDevice = await prisma.device.findFirst({
      where: {
        OR: [
          { uuid: null },
          { uuid: '' },
        ],
      },
      orderBy: {
        createdAt: 'asc', // Assign oldest devices first
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!availableDevice) {
      throw new Error('No available device IDs to assign');
    }

    // Update the device to assign the UUID
    await prisma.device.update({
      where: {
        id: availableDevice.id,
      },
      data: {
        uuid: deviceUuid,
        connectionStatus: 'connected',
        lastSeen: new Date(),
      },
    });

    logInfo('Assigned device ID to UUID', { 
      deviceId: availableDevice.id, 
      deviceName: availableDevice.name,
      uuid: deviceUuid,
    });

    // Return the device name as the device_id (similar to Python's simdevice0001 format)
    return availableDevice.name;
  } catch (error) {
    logError(error as Error, { 
      context: 'Failed to assign device ID', 
      deviceUuid,
    });
    throw error;
  }
}

/**
 * Get device configuration for a given device ID
 * 
 * @param deviceId - The device ID (device name)
 * @returns Configuration object with connection details
 */
export async function getDeviceConfiguration(deviceId: string): Promise<{
  device_id: string;
  IOTHUB_DEVICE_CONNECTION_STRING: string;
  initialRetryTimeout: number;
  maxRetry: number;
  messageIntervalSeconds: number;
}> {
  // In the Python server, these values are global constants
  // For now, we'll use default values. In production, these could be:
  // - Stored in environment variables
  // - Stored per-device in the database
  // - Configured via an admin API
  
  const initialRetryTimeout = parseInt(process.env.INITIAL_RETRY_TIMEOUT || '30', 10);
  const maxRetry = parseInt(process.env.MAX_RETRY || '10', 10);
  const messageIntervalSeconds = parseInt(process.env.MESSAGE_INTERVAL_SECONDS || '5', 10);

  // Generate IoT Hub connection string
  // This matches the Python server's generate_iothub_connection_string function
  const connectionString = generateIoTHubConnectionString(deviceId);

  return {
    device_id: deviceId,
    IOTHUB_DEVICE_CONNECTION_STRING: connectionString,
    initialRetryTimeout,
    maxRetry,
    messageIntervalSeconds,
  };
}

/**
 * Generate IoT Hub connection string for a device
 * 
 * This matches the Python server's generate_iothub_connection_string function
 * Format: HostName={host};DeviceId={device_id};SharedAccessKey={key}
 * 
 * @param deviceId - The device ID
 * @returns IoT Hub connection string
 */
function generateIoTHubConnectionString(deviceId: string): string {
  const iotConnectionString = process.env.IOT_CONNECTION_STRING;
  const iotPrimaryKeyDevice = process.env.IOT_PRIMARY_KEY_DEVICE;

  if (!iotConnectionString) {
    throw new Error('IOT_CONNECTION_STRING environment variable not set');
  }

  if (!iotPrimaryKeyDevice) {
    throw new Error('IOT_PRIMARY_KEY_DEVICE environment variable not set');
  }

  // Extract hostname from connection string
  // Example IOT_CONNECTION_STRING: "HostName=myhub.azure-devices.net;SharedAccessKeyName=..."
  const hostNameMatch = iotConnectionString.match(/HostName=([^;]+)/);
  
  if (!hostNameMatch) {
    throw new Error('Invalid IOT_CONNECTION_STRING format');
  }

  const hostName = hostNameMatch[1];

  // Build device connection string
  return `HostName=${hostName};DeviceId=${deviceId};SharedAccessKey=${iotPrimaryKeyDevice}`;
}

/**
 * Clear all device UUID mappings
 * This matches the Python server's /clear_mappings endpoint
 */
export async function clearAllDeviceMappings(): Promise<void> {
  try {
    await prisma.device.updateMany({
      where: {
        uuid: {
          not: null,
        },
      },
      data: {
        uuid: null,
        connectionStatus: 'disconnected',
      },
    });

    logInfo('Cleared all device UUID mappings');
  } catch (error) {
    logError(error as Error, { context: 'Failed to clear device mappings' });
    throw error;
  }
}

/**
 * Get device by UUID
 */
export async function getDeviceByUuid(uuid: string) {
  try {
    const device = await prisma.device.findFirst({
      where: {
        uuid,
      },
    });

    return device;
  } catch (error) {
    logError(error as Error, { context: 'Failed to get device by UUID', uuid });
    return null;
  }
}
