# IoT Simulator Server Endpoints

This document describes the newly added IoT simulator server functionality.

## Overview

The IoT simulator provides WebSocket-based device connectivity and REST API endpoints for device management and command distribution.

## Architecture

### Database Schema

New collections:
1. **Device** (updated) - Added uuid and connectionStatus fields
2. **DeviceMapping** - Maps UUID to device records
3. **DeviceCommand** - Stores commands and responses

### ConnectionManager

Singleton class that manages WebSocket connections, handles broadcast messaging, and monitors connection lifecycle.

## Endpoints

### WebSocket: `ws://host:port/ws/{uuid}`
Devices connect using unique UUID. Server accepts connections, updates database, listens for messages, and routes commands.

### REST API (all require `x-user-email` header):

- **GET** `/api/health` - Server health and connection stats
- **GET** `/api/clients` - List connected WebSocket clients
- **POST** `/api/devices/generate/{number}` - Generate simulated devices (1-1000)
- **POST** `/api/devices/delete/{device_id}` - Delete specific device
- **POST** `/api/devices/delete-all` - Delete all user devices
- **POST** `/api/devices/clear-mappings` - Clear device mappings
- **POST** `/api/devices/report/{device_id}` - Get device report
- **POST** `/api/commands/broadcast` - Broadcast to all devices
- **POST** `/api/commands/{uuid}` - Send to specific device

## Testing

Test scripts provided:
- `scripts/test-api-endpoints.js` - API tests
- `scripts/test-device-connection.js` - Device simulator

See full documentation in this file for detailed request/response formats.
