# Deployment Checklist

This checklist helps you deploy the migrated WebSocket server to production.

## Pre-Deployment

### 1. Database Preparation

- [ ] **MongoDB is running and accessible**
  ```bash
  # Test connection
  mongosh $DATABASE_URL
  ```

- [ ] **Generate Prisma Client**
  ```bash
  npm run db:generate
  ```

- [ ] **Push schema to database** (if not using migrations)
  ```bash
  npm run db:push
  ```

- [ ] **Initialize database collections**
  ```bash
  npm run db:init
  ```

### 2. Environment Configuration

- [ ] **Copy .env.example to .env**
  ```bash
  cp .env.example .env
  ```

- [ ] **Configure required variables:**
  ```env
  DATABASE_URL="mongodb://..."
  JWT_SECRET="your-secure-secret"
  NODE_ENV="production"
  ```

- [ ] **Configure IoT Hub (if using Azure IoT Hub):**
  ```env
  IOT_CONNECTION_STRING="HostName=..."
  IOT_PRIMARY_KEY_DEVICE="..."
  INITIAL_RETRY_TIMEOUT="30"
  MAX_RETRY="10"
  MESSAGE_INTERVAL_SECONDS="5"
  ```

### 3. Dependencies

- [ ] **Install production dependencies**
  ```bash
  npm ci --production
  ```

- [ ] **Verify TypeScript compilation**
  ```bash
  npx tsc --noEmit
  ```

### 4. Build

- [ ] **Build for production**
  ```bash
  npm run build
  ```

- [ ] **Verify build output**
  ```bash
  ls -la .next/
  ```

## Deployment

### Option 1: Production Server

```bash
# Start production server
npm start
```

**Verify:**
- Server starts on configured PORT (default: 3000)
- WebSocket endpoints are accessible
- API endpoints respond correctly

### Option 2: Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build Docker image
docker build -t iothub-controller .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="mongodb://..." \
  -e JWT_SECRET="..." \
  iothub-controller
```

### Option 3: Process Manager (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start npm --name "iothub-controller" -- start

# Save PM2 configuration
pm2 save

# Setup auto-restart on system reboot
pm2 startup
```

## Post-Deployment Verification

### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok"}
```

### 2. WebSocket Connection Test

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c "ws://localhost:3000/ws/test-uuid-12345"
```

Expected: Connection accepted without authentication errors

### 3. Device ID Generation

```bash
curl -X POST http://localhost:3000/api/devices/generate/10 \
  -H "Content-Type: application/json" \
  -H "x-user-email: admin@example.com"
```

Expected: 10 device IDs created (simdevice0001-simdevice0010)

### 4. Connected Clients

```bash
curl http://localhost:3000/api/clients
```

Expected: List of connected WebSocket clients

### 5. Database Verification

```bash
# Connect to MongoDB
mongosh $DATABASE_URL

# Check collections
use iothub-controller
db.getCollectionNames()

# Verify deviceids collection
db.deviceids.countDocuments()

# Verify telemetries collection
db.telemetries.countDocuments()
```

## Security Checklist

### Production Security

- [ ] **JWT_SECRET is strong** (minimum 32 characters, random)
- [ ] **HTTPS/WSS is enabled** (use reverse proxy like nginx)
- [ ] **CORS is configured** (update allowed origins in server.ts)
- [ ] **Rate limiting is active** (verified on API endpoints)
- [ ] **Database credentials are secure** (not exposed in logs)
- [ ] **Logs directory has proper permissions** (only server can write)

### Reverse Proxy Configuration (nginx example)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # WebSocket upgrade headers
    location /ws/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Regular HTTP endpoints
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring

### 1. Log Files

Monitor application logs:
```bash
# Application logs
tail -f logs/application-*.log

# Error logs
tail -f logs/error-*.log

# HTTP logs
tail -f logs/http-*.log
```

### 2. Process Monitoring

With PM2:
```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs iothub-controller

# Restart if needed
pm2 restart iothub-controller
```

### 3. Database Monitoring

```bash
# MongoDB connection count
mongosh $DATABASE_URL --eval "db.serverStatus().connections"

# Database size
mongosh $DATABASE_URL --eval "db.stats()"
```

### 4. WebSocket Connections

```bash
# API endpoint to check connected devices
curl http://localhost:3000/api/clients
```

## Troubleshooting

### Connection Refused

**Problem:** Cannot connect to server

**Solutions:**
1. Check if server is running: `ps aux | grep node`
2. Verify port is not in use: `lsof -i :3000`
3. Check firewall rules: `sudo ufw status`
4. Review error logs: `tail logs/error-*.log`

### Authentication Errors on WebSocket

**Problem:** Devices cannot connect to `/ws/{uuid}`

**Solutions:**
1. Verify middleware bypass: Check `middleware.ts` line 8
2. Test with wscat: `wscat -c "ws://localhost:3000/ws/test"`
3. Check server logs for WebSocket errors

### Device ID Assignment Fails

**Problem:** "No available device IDs to assign"

**Solutions:**
1. Generate device IDs: `POST /api/devices/generate/{number}`
2. Clear existing mappings: `POST /api/devices/clear-mappings`
3. Check deviceids collection: `db.deviceids.find()`

### Database Connection Issues

**Problem:** "Cannot connect to MongoDB"

**Solutions:**
1. Verify MongoDB is running: `systemctl status mongodb`
2. Check connection string: `.env` DATABASE_URL
3. Test connection: `mongosh $DATABASE_URL`
4. Check network/firewall: `telnet localhost 27017`

### Memory Leaks

**Problem:** Server memory usage keeps growing

**Solutions:**
1. Monitor with PM2: `pm2 monit`
2. Check for zombie connections: Review connection manager
3. Restart server periodically: `pm2 restart iothub-controller`
4. Increase memory limit: `NODE_OPTIONS="--max-old-space-size=4096"`

## Performance Optimization

### 1. Database Indexes

Ensure indexes are created (automatic with Prisma):
- DeviceId: deviceId (unique), deviceUuid (unique)
- Telemetry: deviceId, createdAt
- Device: uuid, userId

### 2. Connection Pooling

MongoDB connection pooling is handled by Prisma. Configure in `lib/prisma.ts` if needed.

### 3. Log Rotation

Winston automatically rotates logs. Configure retention in `lib/logger.ts`:
- Application logs: 14 days
- Error logs: 30 days
- HTTP logs: 7 days

### 4. WebSocket Performance

- Connection timeout: Configured in server.ts
- Message size limit: Default unlimited (add validation if needed)
- Heartbeat: Not implemented (add if connections drop frequently)

## Rollback Plan

If issues occur after deployment:

### 1. Quick Rollback

```bash
# With PM2
pm2 stop iothub-controller
pm2 delete iothub-controller

# Checkout previous version
git checkout <previous-commit>
npm install
npm run build
pm2 start npm --name "iothub-controller" -- start
```

### 2. Database Rollback

```bash
# Drop new collections
mongosh $DATABASE_URL
use iothub-controller
db.deviceids.drop()
db.telemetries.drop()
```

**Note:** Device and User collections are unchanged, so no data loss for existing functionality.

### 3. Re-enable Authentication (if needed)

Edit `middleware.ts` and `server.ts` to remove WebSocket bypass.

## Support Contacts

- **Technical Issues:** Check logs and MIGRATIONREVIEW.md
- **Java Client Issues:** Reference SimulatorWSClient.java
- **Protocol Questions:** See docs/WEBSOCKET_TESTING.md

## Success Criteria

Deployment is successful when:

- ✅ Server starts without errors
- ✅ WebSocket connections work without authentication
- ✅ Device ID assignment functions correctly
- ✅ Commands can be sent to devices
- ✅ Telemetry reports are stored
- ✅ No security vulnerabilities introduced
- ✅ Existing APIs continue to work
- ✅ Java client connects successfully

## Production Readiness

Before going to production:

- [ ] All tests in WEBSOCKET_TESTING.md pass
- [ ] Java client tested successfully
- [ ] Performance tested with expected device count
- [ ] Security review completed
- [ ] Backup procedures in place
- [ ] Monitoring and alerting configured
- [ ] Documentation reviewed and updated
- [ ] Team trained on new features

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-19  
**Status:** Ready for Deployment
