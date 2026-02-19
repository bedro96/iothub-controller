# Migration Review: Python Server to TypeScript Server

## Overview
This document details the differences between the reference Python server (`/reference/server/iot_simulator_server.py`) and the current TypeScript implementation (`server.ts`), along with necessary changes to align them for proper communication with the Java client (`/reference/client/SimulatorWSClient.java`).

## 1. WebSocket Endpoint Comparison

### Python Server (`iot_simulator_server.py`)
- **Endpoint**: `/ws/{uuid}`
- **Authentication**: Optional Bearer token via header or query parameter (only if `API_BEARER_TOKEN` is set)
- **Rate Limiting**: None
- **CORS**: Enabled with `allow_origins=["*"]`
- **Message Format**: Uses `MessageEnvelope` class with specific field structure

### Current TypeScript Server (`server.ts`)
- **Endpoint**: `/ws/{uuid}` ✅ (Matches)
- **Authentication**: None currently ✅ (Correct for IoT devices)
- **Rate Limiting**: Applied via middleware ❌ (Should be removed for `/ws/*`)
- **Message Format**: Generic JSON handling ❌ (Should match MessageEnvelope)

### Required Changes
1. ✅ Endpoint path matches
2. ❌ Need to exclude `/ws/*` from rate limiting in middleware
3. ❌ Need to exclude `/ws/*` from CSRF protection in middleware
4. ❌ Need to implement MessageEnvelope format handling

## 2. Message Structure Comparison

### Python MessageEnvelope Fields
```python
{
  "version": 1,                      # Protocol version (int)
  "type": "command|request|response|report|error|event",
  "id": "uuid",                      # Message unique ID
  "correlationId": "uuid",           # Request-response correlation
  "ts": "2025-11-28T05:15:37Z",     # ISO8601 timestamp
  "action": "device.config.update",  # Action name
  "status": "success|failure|...",   # Optional status
  "payload": {},                     # Data object
  "meta": {}                         # Optional metadata
}
```

### Java Client Message Fields
```java
{
  "version": "1.0",                  # String version
  "type": "request|response|event|error",
  "id": "DEVICE_UUID",               # Device UUID
  "correlation_id": "",              # Note: underscore not camelCase!
  "ts": "ISO8601",
  "action": "",
  "status": "status_text",
  "payload": {"DEVICE_UUID": "..."},
  "meta": {"source": "simulator"}
}
```

### Current TypeScript Implementation
```typescript
{
  "type": "telemetry|status|response|connected",
  // No standardized envelope structure
}
```

### Critical Differences
1. ❌ **Field naming**: Java client uses `correlation_id` (underscore) but Python server uses `correlationId` (camelCase)
   - **Impact**: Field mismatch will cause communication issues
   - **Resolution**: TypeScript server should accept both formats for compatibility

2. ❌ **Message types**: TypeScript uses different type names
   - Python/Java: `request`, `response`, `report`, `event`, `error`
   - TypeScript: `telemetry`, `status`, `response`, `connected`
   
3. ❌ **Required fields**: TypeScript doesn't enforce envelope structure
   - Need: `version`, `type`, `id`, `correlationId`, `ts`, `action`, `payload`, `meta`

## 3. WebSocket Message Handling

### Python Server Logic

#### On `type: "request"`:
1. Receives request from client (device needs configuration)
2. Calls `assign_device_id()` to allocate a device ID from database
3. Generates IoT Hub connection string
4. Sends response with:
   - `type: "response"`
   - `action: "device.config.update"`
   - `payload`: Contains `device_id`, `IOTHUB_DEVICE_CONNECTION_STRING`, `initialRetryTimeout`, `maxRetry`, `messageIntervalSeconds`
   - `correlationId`: Set to the request's `id`

#### On `type: "report"`:
1. Receives status/telemetry report from client
2. Sends acknowledgment with:
   - `type: "response"`
   - `action: "none"`
   - `status: "received"`
   - `correlationId`: Set to the report's `id`

### Current TypeScript Implementation
- ❌ No specific handling for `request` type messages
- ❌ No device ID assignment flow
- ❌ No configuration response with device credentials
- ❌ Generic message handling without envelope structure
- ✅ Has `telemetry`, `status`, `response` handlers (but different structure)

### Required Changes
1. Implement `request` type handler with device ID assignment
2. Implement `report` type handler with acknowledgment
3. Add device configuration response logic
4. Maintain envelope structure in all responses

## 4. Database Schema Comparison

### Python Server Database (SQLAlchemy)
```python
DeviceId:
  - device_id (string, primary key)
  - device_uuid (string, nullable) # Maps UUID to device ID
```

### Current Prisma Schema
```prisma
Device:
  - id (ObjectId, primary key)
  - name (String)
  - type (String)
  - status (String)
  - userId (ObjectId)
  - uuid (String?, unique)
  - connectionStatus (String)
  - metadata (Json?)
  - lastSeen (DateTime?)

DeviceMapping:
  - id (ObjectId)
  - uuid (String, unique)
  - deviceId (ObjectId)
  - userId (ObjectId)
  - metadata (Json?)
```

### Differences
1. ❌ Python uses simple `device_id` (string) vs TypeScript uses ObjectId
2. ❌ Python has `device_uuid` field directly in DeviceId table
3. ❌ TypeScript has separate `DeviceMapping` table
4. ✅ Both support UUID to device ID mapping concept

### Required Changes
- Need to add logic to support device ID assignment similar to Python's `assign_device_id()`
- Consider adding a pool of pre-generated device IDs or use existing Device records
- Update assignment logic to match Python behavior

## 5. REST API Endpoints Comparison

### Python Server Endpoints
| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/ws/{uuid}` | WebSocket | Optional* | Device WebSocket connection |
| `/generate_device/{number_of_devices}` | POST | Yes | Generate device credentials |
| `/delete_device/{device_id}` | POST | Yes | Delete single device |
| `/delete_all_devices` | POST | Yes | Delete all devices |
| `/clear_mappings` | POST | Yes | Clear UUID mappings |
| `/command/broadcast` | POST | Yes | Broadcast command to all devices |
| `/command/{uuid}` | POST | Yes | Send command to specific device |
| `/report/{device_id}` | POST | Yes | Receive device report (telemetry) |
| `/clients` | GET | Yes | List connected clients |
| `/api/health` | GET | No | Health check |

*Authentication is optional and only enforced if `API_BEARER_TOKEN` environment variable is set

### Current TypeScript API Endpoints
Based on repository structure, need to verify:
- Device generation API
- Device command APIs
- Broadcast API
- Device listing API

### Required Changes
1. Verify all management endpoints have authentication
2. Verify all management endpoints have rate limiting
3. Ensure `/ws/{uuid}` has NO authentication/rate limiting
4. Add any missing endpoints from Python reference

## 6. Middleware Configuration

### Current Middleware (`middleware.ts`)
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```
- Applies to all routes except static files
- ❌ This means `/ws/*` paths will be processed by middleware

### Required Changes
1. Modify `shouldBypassRateLimit()` to return `true` for paths starting with `/ws/`
2. Modify `shouldBypassCSRF()` to return `true` for paths starting with `/ws/`
3. Or update middleware matcher to exclude `/ws/*` paths entirely

## 7. Authentication Comparison

### Python Server
- Uses simple Bearer token authentication
- Token checked via middleware for HTTP endpoints
- WebSocket authentication optional (only if `API_BEARER_TOKEN` is set)
- Exempt paths: `/api/health`, `/docs`, `/openapi.json`, `/redoc`

### Current TypeScript Server
- JWT-based authentication system
- Session management with MongoDB
- WebSocket (Socket.IO) uses JWT token authentication
- ❌ Device WebSocket (`/ws/{uuid}`) should NOT require authentication

### Required Changes
1. ✅ Ensure `/ws/{uuid}` has no authentication check
2. ✅ Keep authentication for management APIs
3. ✅ Keep Socket.IO authentication for frontend WebSocket

## 8. Connection Management

### Python Server
```python
class ConnectionManager:
  - active_connections: Dict[uuid, WebSocket]
  - connect(uuid, websocket)
  - disconnect(uuid)
  - send_command(uuid, command)
  - broadcast(command)
```

### TypeScript Server
```typescript
class ConnectionManager:
  - connections: Map<uuid, DeviceConnection>
  - addConnection(uuid, ws, userId?)
  - removeConnection(uuid)
  - sendToDevice(uuid, message)
  - broadcast(message, excludeUuid?)
  - broadcastToUser(userId, message)
```

### Comparison
- ✅ Both have similar structure
- ✅ Both support UUID-based connection tracking
- ✅ Both support broadcast and targeted sending
- TypeScript has additional user-based broadcasting (OK for additional features)

## 9. Key Issues to Fix

### Critical (Breaking Communication)
1. **Field Name Mismatch**: Java client sends `correlation_id` but server may expect `correlationId`
2. **Missing Request Handler**: No handler for initial device configuration request
3. **Middleware Blocking**: Rate limiting/CSRF may block WebSocket connections
4. **Message Envelope**: Current implementation doesn't follow envelope structure

### Important (Feature Gaps)
1. **Device ID Assignment**: No automatic device ID allocation logic
2. **Configuration Response**: No logic to send device credentials
3. **Report Acknowledgment**: No acknowledgment for device reports

### Nice to Have (Enhancements)
1. **API Endpoint Parity**: Ensure all Python endpoints exist in TypeScript
2. **Telemetry Storage**: Python stores reports in database (optional for TypeScript)

## 10. Recommended Implementation Order

1. **Phase 1: Middleware Fixes** (Unblock WebSocket)
   - Exclude `/ws/*` from rate limiting
   - Exclude `/ws/*` from CSRF protection

2. **Phase 2: Message Envelope** (Enable Communication)
   - Create TypeScript MessageEnvelope type/class
   - Update WebSocket message handling to use envelope
   - Support both `correlationId` and `correlation_id` fields

3. **Phase 3: Request Handlers** (Core Functionality)
   - Implement `request` type handler with device ID assignment
   - Implement `report` type handler with acknowledgment
   - Add device configuration response logic

4. **Phase 4: Database Updates** (If needed)
   - Update Prisma schema if device ID assignment requires changes
   - Add migration for schema changes

5. **Phase 5: API Endpoints** (Management Features)
   - Verify/add missing REST endpoints
   - Ensure proper authentication/rate limiting on APIs

6. **Phase 6: Testing**
   - Test with Java client
   - Verify message exchange
   - Test device control commands

## Summary of Changes Needed

### server.ts
- ✅ WebSocket endpoint path is correct
- ❌ Need to add MessageEnvelope structure
- ❌ Need to add request/report handlers
- ❌ Need to add device ID assignment logic
- ❌ Need to handle both `correlationId` and `correlation_id`

### middleware.ts
- ❌ Add `/ws/*` bypass for rate limiting
- ❌ Add `/ws/*` bypass for CSRF protection

### lib/rate-limit.ts
- ❌ Update `shouldBypassRateLimit()` to check for `/ws/` prefix

### lib/csrf.ts
- ❌ Update `shouldBypassCSRF()` to check for `/ws/` prefix

### prisma/schema.prisma
- ⚠️ May need updates depending on device ID assignment strategy

### New Files Needed
- ❌ `lib/message-envelope.ts` - TypeScript version of MessageEnvelope
- ❌ `lib/device-assignment.ts` - Device ID assignment logic

## Compatibility Notes

### Python Server Flexibility
The Python server has several features that make it flexible:
- Authentication is optional (only if `API_BEARER_TOKEN` is set)
- Can accept both header and query param authentication
- Handles errors gracefully and continues listening

### TypeScript Server Should Match
- Make authentication optional or remove from `/ws/{uuid}` entirely
- Focus on matching message structure exactly
- Prioritize communication reliability over security for device connections
- Apply security to management APIs instead
