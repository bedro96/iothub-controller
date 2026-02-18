import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from './lib/auth';
import { prisma } from './lib/prisma';
import { logInfo, logError } from './lib/logger';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
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

  server.listen(port, () => {
    logInfo(`Server started`, { 
      port, 
      env: process.env.NODE_ENV,
      url: `http://${hostname}:${port}`,
    });
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket ready on ws://${hostname}:${port}/socket`);
  });
});
