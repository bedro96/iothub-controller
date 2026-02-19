import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './lib/auth';
import { prisma } from './lib/prisma';
import { logInfo, logError } from './lib/logger';
import { connectionManager } from './lib/connection-manager';
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
      const uuid = url.substring(4); // Extract UUID from /ws/{uuid}
      
      if (!uuid) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        // Add connection to manager
        connectionManager.addConnection(uuid, ws);

        // Send welcome message
        ws.send(JSON.stringify({
          type: 'connected',
          uuid,
          timestamp: new Date().toISOString(),
        }));

        // Update device connection status in database
        prisma.device.updateMany({
          where: { uuid },
          data: {
            connectionStatus: 'connected',
            lastSeen: new Date(),
          },
        }).then(() => {
          logInfo('Device connection status updated', { uuid });
        }).catch((error) => {
          logError(error, { context: 'Failed to update device connection status', uuid });
        });

        // Handle incoming messages
        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            logInfo('Device message received', { uuid, type: message.type });

            // Handle different message types
            switch (message.type) {
              case 'telemetry':
                // Store telemetry data (update metadata with debounce-like approach)
                // Only update database every N messages to reduce load
                await prisma.device.updateMany({
                  where: { uuid },
                  data: {
                    metadata: message,
                    lastSeen: new Date(),
                  },
                });
                logInfo('Telemetry received', { uuid, data: message.data });
                break;
              
              case 'status':
                // Update device status (always update for status changes)
                await prisma.device.updateMany({
                  where: { uuid },
                  data: {
                    status: message.status || 'online',
                    lastSeen: new Date(),
                  },
                });
                break;

              case 'response':
                // Store command response (always update for responses)
                if (message.commandId) {
                  await prisma.deviceCommand.updateMany({
                    where: {
                      id: message.commandId,
                      uuid,
                    },
                    data: {
                      status: 'completed',
                      response: message.data,
                    },
                  });
                }
                break;
              
              default:
                // For other message types, only update lastSeen
                await prisma.device.updateMany({
                  where: { uuid },
                  data: {
                    lastSeen: new Date(),
                  },
                });
            }
          } catch (error) {
            logError(error as Error, { context: 'Device message processing', uuid });
          }
        });

        // Handle connection close
        ws.on('close', async () => {
          logInfo('Device WebSocket closed', { uuid });
          
          // Update device connection status
          await prisma.device.updateMany({
            where: { uuid },
            data: {
              connectionStatus: 'disconnected',
            },
          }).catch((error) => {
            logError(error, { context: 'Failed to update device disconnection status', uuid });
          });
          
          // Remove from connection manager after database update
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
