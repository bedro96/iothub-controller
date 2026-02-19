import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './lib/auth';
import { prisma } from './lib/prisma';
import { logInfo, logError } from './lib/logger';
import { connectionManager } from './lib/connection-manager';
import { MessageEnvelope } from './lib/message-envelope';
import { randomUUID } from 'crypto';
// Start Node-only background tasks (rate-limit cleanup)
import './lib/rate-limit-node';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      
      // Handle device WebSocket upgrade requests for /ws/{uuid}
      if (req.url?.startsWith('/ws/') && req.headers.upgrade?.toLowerCase() === 'websocket') {
        // Let the WebSocket server handle this
        return;
      }
      
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO
  const io = new SocketIOServer(server, {
    path: '/socket',
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXTAUTH_URL 
        : 'http://localhost:3000',
      credentials: true,
    },
  });

  // WebSocket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const payload = await verifyToken(token);
      
      if (!payload) {
        return next(new Error('Invalid token'));
      }

      // Attach user info to socket
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      socket.data.role = payload.role;
      
      logInfo('WebSocket client authenticated', { userId: payload.userId, socketId: socket.id });
      next();
    } catch (error) {
      logError(error as Error, { context: 'WebSocket authentication' });
      next(new Error('Authentication error'));
    }
  });

  // WebSocket connection handler
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    logInfo('WebSocket client connected', { userId, socketId: socket.id });

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle device status updates
    socket.on('device:status', async (data) => {
      try {
        const { deviceId, status } = data;
        
        // Verify device belongs to user
        const device = await prisma.device.findFirst({
          where: {
            id: deviceId,
            userId,
          },
        });

        if (!device) {
          socket.emit('error', { message: 'Device not found' });
          return;
        }

        // Update device status
        await prisma.device.update({
          where: { id: deviceId },
          data: {
            status,
            lastSeen: new Date(),
          },
        });

        // Broadcast to user's room
        io.to(`user:${userId}`).emit('device:status:updated', {
          deviceId,
          status,
          lastSeen: new Date(),
        });

        logInfo('Device status updated', { userId, deviceId, status });
      } catch (error) {
        logError(error as Error, { context: 'Device status update', userId });
        socket.emit('error', { message: 'Failed to update device status' });
      }
    });

    // Handle device data
    socket.on('device:data', async (data) => {
      try {
        const { deviceId, payload } = data;
        
        // Verify device belongs to user
        const device = await prisma.device.findFirst({
          where: {
            id: deviceId,
            userId,
          },
        });

        if (!device) {
          socket.emit('error', { message: 'Device not found' });
          return;
        }

        // Update device metadata and lastSeen
        await prisma.device.update({
          where: { id: deviceId },
          data: {
            metadata: payload,
            lastSeen: new Date(),
          },
        });

        // Broadcast to user's room
        io.to(`user:${userId}`).emit('device:data:received', {
          deviceId,
          payload,
          timestamp: new Date(),
        });

        logInfo('Device data received', { userId, deviceId });
      } catch (error) {
        logError(error as Error, { context: 'Device data', userId });
        socket.emit('error', { message: 'Failed to process device data' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logInfo('WebSocket client disconnected', { userId, socketId: socket.id });
    });
  });

  // Initialize WebSocket server for device connections
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade for device connections
  server.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    
    // Check if this is a device WebSocket connection (/ws/{uuid})
    if (url.startsWith('/ws/')) {
      const uuid = url.substring(4).split('?')[0]; // Extract UUID from /ws/{uuid}, ignore query params
      
      if (!uuid) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        // Add connection to manager (no authentication required for device WebSocket)
        connectionManager.addConnection(uuid, ws);
        logInfo('Device WebSocket connected', { uuid });

        // Helper function to assign device ID to UUID
        async function assignDeviceId(messageId: string): Promise<string> {
          try {
            // Query for an available device_id where device_uuid is null
            const availableDevice = await (prisma as any).deviceId.findFirst({
              where: { deviceUuid: null },
              orderBy: { deviceId: 'asc' },
            });

            if (!availableDevice) {
              throw new Error('No available device IDs to assign');
            }

            // Update the device with the UUID
            await (prisma as any).deviceId.update({
              where: { id: availableDevice.id },
              data: { deviceUuid: messageId },
            });

            logInfo('Assigned device ID to UUID', { deviceId: availableDevice.deviceId, uuid: messageId });
            return availableDevice.deviceId;
          } catch (error) {
            logError(error as Error, { context: 'Failed to assign device ID', uuid: messageId });
            throw error;
          }
        }

        // Handle incoming messages
        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            logInfo('Device message received', {
              uuid,
              type: message.type,
              id: message.id,
              correlationId: message.correlationId,
              action: message.action,
              status: message.status,
            });

            // Handle different message types based on Python server logic
            if (message.type === 'request') {
              // Client is requesting device ID assignment
              try {
                const assignedDeviceId = await assignDeviceId(message.id || uuid);
                
                // Generate IoT Hub connection string (if environment variables are set)
                const iotHubConnectionString = process.env.IOT_CONNECTION_STRING 
                  ? `HostName=${process.env.IOT_CONNECTION_STRING.split(';')[0].split('=')[1]};DeviceId=${assignedDeviceId};SharedAccessKey=${process.env.IOT_PRIMARY_KEY_DEVICE || ''}`
                  : '';

                const envelope = new MessageEnvelope({
                  version: 1,
                  type: 'response',
                  id: randomUUID(),
                  correlationId: message.id || '',
                  action: 'device.config.update',
                  payload: {
                    device_id: assignedDeviceId,
                    IOTHUB_DEVICE_CONNECTION_STRING: iotHubConnectionString,
                    initialRetryTimeout: parseInt(process.env.INITIAL_RETRY_TIMEOUT || '30', 10),
                    maxRetry: parseInt(process.env.MAX_RETRY || '10', 10),
                    messageIntervalSeconds: parseInt(process.env.MESSAGE_INTERVAL_SECONDS || '5', 10),
                  },
                  status: 'success',
                });

                ws.send(envelope.toJSON());
                logInfo('Device config sent', {
                  uuid,
                  type: envelope.type,
                  id: envelope.id,
                  correlationId: envelope.correlationId,
                  action: envelope.action,
                  status: envelope.status,
                });
              } catch (error) {
                // Send error envelope on failure
                const errorEnvelope = new MessageEnvelope({
                  action: message.action || 'unknown',
                  type: 'error',
                  id: randomUUID(),
                  correlationId: message.id || '',
                  payload: {},
                  status: 'failure',
                  meta: { error: (error as Error).message },
                });
                
                ws.send(errorEnvelope.toJSON());
                logError(error as Error, { context: 'Failed to process request', uuid });
              }
            } else if (message.type === 'report') {
              // Client is sending telemetry/status report
              const envelope = new MessageEnvelope({
                version: 1,
                type: 'response',
                action: 'none',
                id: randomUUID(),
                correlationId: message.id || '',
                status: 'received',
              });

              ws.send(envelope.toJSON());
              logInfo('Report acknowledged', {
                uuid,
                correlationId: envelope.correlationId,
                type: envelope.type,
                status: envelope.status,
              });
            }

            // Update device lastSeen timestamp if device exists
            await prisma.device.updateMany({
              where: { uuid } as any,
              data: {
                lastSeen: new Date(),
                connectionStatus: 'connected',
              } as any,
            }).catch((error) => {
              // Ignore errors if device doesn't exist yet
              logInfo('Device not found in database (may not be created yet)', { uuid });
            });

          } catch (error) {
            logError(error as Error, { context: 'Device message processing', uuid });
          }
        });

        // Handle connection close
        ws.on('close', async () => {
          logInfo('Device WebSocket closed', { uuid });
          
          // Update device connection status
          await prisma.device.updateMany({
            where: { uuid } as any,
            data: {
              connectionStatus: 'disconnected',
            } as any,
          }).catch((error) => {
            logInfo('Device not found when disconnecting', { uuid });
          });
          
          // Remove from connection manager
          connectionManager.removeConnection(uuid);
        });

        // Handle errors
        ws.on('error', (error) => {
          logError(error, { context: 'Device WebSocket error', uuid });
        });
      });
    } else {
      // Not a device WebSocket, destroy the connection
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  });

  server.listen(port, () => {
    logInfo(`Server started`, { 
      port, 
      env: process.env.NODE_ENV,
      url: `http://${hostname}:${port}`,
    });
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket ready on ws://${hostname}:${port}/socket`);
    console.log(`> Device WebSocket ready on ws://${hostname}:${port}/ws/{uuid}`);
  });
});
