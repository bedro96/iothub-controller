# WebSocket Testing Guide

This guide helps you manually test the WebSocket implementation to ensure compatibility with the Java client.

## Prerequisites

1. **Start the server**
   ```bash
   npm run dev
   ```

2. **MongoDB should be running** with the schema migrated:
   ```bash
   npm run db:generate
   ```

## Testing Steps

### 1. Test WebSocket Connection (No Auth)

Using a WebSocket client tool (e.g., `wscat`, Postman, or browser console):

```bash
# Install wscat if needed
npm install -g wscat

# Connect to WebSocket endpoint (replace {uuid} with a test UUID)
wscat -c "ws://localhost:3000/ws/test-device-uuid-12345"
```

Expected: Connection should be accepted without any authentication error.

### 2. Test Device Configuration Request

After connection, send this message:

```json
{
  "version": "1.0",
  "type": "request",
  "id": "test-device-uuid-12345",
  "correlation_id": "",
  "ts": "2026-02-19T10:41:21Z",
  "action": "",
  "status": "device need device_id",
  "payload": {
    "DEVICE_UUID": "test-device-uuid-12345"
  },
  "meta": {
    "source": "simulator"
  }
}
```

**Expected Response**:
```json
{
  "version": 1,
  "type": "response",
  "id": "<generated-uuid>",
  "correlationId": "test-device-uuid-12345",
  "ts": "<timestamp>",
  "action": "device.config.update",
  "status": "success",
  "payload": {
    "device_id": "simdevice0001",
    "IOTHUB_DEVICE_CONNECTION_STRING": "",
    "initialRetryTimeout": 30,
    "maxRetry": 10,
    "messageIntervalSeconds": 5
  },
  "meta": {}
}
```

### 3. Test Report Message

Send a telemetry report:

```json
{
  "version": "1.0",
  "type": "report",
  "id": "report-uuid-67890",
  "ts": "2026-02-19T10:45:00Z",
  "payload": {
    "temperature": 25.5,
    "humidity": 60.0
  }
}
```

**Expected Response**:
```json
{
  "version": 1,
  "type": "response",
  "id": "<generated-uuid>",
  "correlationId": "report-uuid-67890",
  "action": "none",
  "status": "received",
  "payload": {},
  "meta": {}
}
```

### 4. Test Command Broadcasting

#### 4a. Generate Device IDs First

```bash
curl -X POST http://localhost:3000/api/devices/generate/5 \
  -H "Content-Type: application/json" \
  -H "x-user-email: test@example.com"
```

Expected: Creates 5 device IDs (simdevice0001-simdevice0005)

#### 4b. Connect Multiple Devices

Connect 2-3 WebSocket clients with different UUIDs to `/ws/{uuid}`

#### 4c. Broadcast Command

```bash
curl -X POST http://localhost:3000/api/commands/broadcast \
  -H "Content-Type: application/json" \
  -H "x-user-email: test@example.com" \
  -d '{"action":"device.start","payload":{}}'
```

**Expected**: All connected devices receive:
```json
{
  "version": 1,
  "type": "command",
  "id": "<uuid>",
  "correlationId": "<uuid>",
  "ts": "<timestamp>",
  "action": "device.start",
  "status": "pending",
  "payload": {},
  "meta": {
    "commandId": "<mongodb-id>",
    "timestamp": "<timestamp>"
  }
}
```

### 5. Test Rate Limiting Bypass

#### 5a. Confirm WebSocket is NOT Rate Limited

Send 100+ messages rapidly through WebSocket connection. 

**Expected**: All messages should be processed without rate limit errors.

#### 5b. Confirm API Routes ARE Rate Limited

```bash
# Send multiple rapid requests
for i in {1..100}; do
  curl -X GET http://localhost:3000/api/clients &
done
wait
```

**Expected**: After ~60 requests, you should receive:
```json
{"error":"Too many requests, please try again later"}
```

### 6. Test CSRF Bypass

Send a POST request to WebSocket endpoint without CSRF token.

**Expected**: WebSocket connections should work without CSRF tokens.

### 7. Test Device ID Assignment

#### 7a. Clear Mappings

```bash
curl -X POST http://localhost:3000/api/devices/clear-mappings \
  -H "x-user-email: test@example.com"
```

#### 7b. Connect Device and Request Config

Connect a device and send a request message. The server should assign the first available device_id.

**Expected**: Device receives `device_id: "simdevice0001"`

#### 7c. Connect Another Device

Connect a second device and request config.

**Expected**: Device receives `device_id: "simdevice0002"` (next available)

### 8. Test Java Client Integration

If you have the Java client (`SimulatorWSClient.java`):

1. **Compile and run the Java client**:
   ```bash
   cd reference/client
   javac -cp ".:gson-2.8.9.jar:javax.websocket-api-1.1.jar" SimulatorWSClient.java
   java -cp ".:gson-2.8.9.jar:javax.websocket-api-1.1.jar:tyrus-standalone-client-1.17.jar" SimulatorWSClient
   ```

2. **Expected behavior**:
   - Client connects to server successfully
   - Client receives device configuration
   - Client can receive commands (start/stop/restart)
   - Client can send reports
   - No authentication errors

## Verification Checklist

- [ ] WebSocket connects without authentication
- [ ] Device receives configuration response with proper MessageEnvelope format
- [ ] Device ID is assigned from DeviceId pool
- [ ] Correlation IDs are maintained correctly
- [ ] Report messages are acknowledged
- [ ] Broadcast commands reach all connected devices
- [ ] Individual commands reach specific device
- [ ] WebSocket bypasses rate limiting
- [ ] WebSocket bypasses CSRF protection
- [ ] API routes still enforce authentication
- [ ] Multiple devices can connect simultaneously
- [ ] Device IDs are assigned in order (simdevice0001, 0002, etc.)
- [ ] Clear mappings allows device IDs to be reassigned
- [ ] Java client can connect and communicate successfully

## Troubleshooting

### Connection Refused
- Check if server is running: `curl http://localhost:3000/api/health`
- Check MongoDB connection: Verify DATABASE_URL in .env

### Device ID Assignment Fails
- Generate device IDs first: `POST /api/devices/generate/10`
- Check DeviceId collection in MongoDB: `db.deviceids.find()`

### Commands Not Received
- Verify device is connected: `GET /api/clients`
- Check server logs for errors
- Verify MessageEnvelope format matches protocol

### CORS Errors
- Server allows all origins in development
- Check CORS configuration in server.ts if needed

## Logs

Monitor server logs for debugging:

```bash
tail -f logs/application-*.log
tail -f logs/error-*.log
```

## Database Inspection

Check MongoDB collections:

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/iothub-controller

# View device IDs
db.deviceids.find()

# View telemetry
db.telemetries.find()

# View device commands
db.DeviceCommand.find()
```

## Expected Database State After Testing

After completing all tests:

1. **deviceids collection**: Contains device IDs with some assigned UUIDs
2. **telemetries collection**: Contains telemetry reports from devices
3. **DeviceCommand collection**: Contains command records with broadcast and device-specific commands

## API Testing with curl

### Get Connected Clients
```bash
curl http://localhost:3000/api/clients
```

### Send Command to Specific Device
```bash
curl -X POST http://localhost:3000/api/commands/test-device-uuid-12345 \
  -H "Content-Type: application/json" \
  -H "x-user-email: test@example.com" \
  -d '{"action":"device.restart","payload":{}}'
```

### Store Telemetry Report
```bash
curl -X POST http://localhost:3000/api/report/simdevice0001 \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "simdevice0001",
    "Type": "telemetry",
    "status": "online",
    "temp": 25.5,
    "Humidity": 60.0,
    "ts": "2026-02-19T10:41:21Z"
  }'
```

### Delete All Devices
```bash
curl -X POST http://localhost:3000/api/devices/delete-all \
  -H "x-user-email: test@example.com"
```

## Success Criteria

The implementation is successful if:

1. ✅ Java client can connect without modification
2. ✅ All MessageEnvelope fields are correctly formatted
3. ✅ Device ID assignment works as expected
4. ✅ Commands can be sent to devices
5. ✅ Reports are acknowledged
6. ✅ No authentication errors on `/ws/` endpoints
7. ✅ Rate limiting and CSRF are bypassed for WebSocket
8. ✅ API endpoints remain protected with authentication

## Next Steps

After successful testing:

1. Deploy to staging environment
2. Test with actual IoT devices or Java client
3. Monitor logs for any issues
4. Configure Azure IoT Hub environment variables
5. Test with real IoT Hub connection strings

## Support

For issues or questions, refer to:
- `/MIGRATIONREVIEW.md` - Complete migration documentation
- `/README.md` - API documentation
- Server logs in `/logs/` directory
