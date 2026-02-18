#!/usr/bin/env node

/**
 * IoT Device Simulator - WebSocket Client
 * 
 * This script simulates an IoT device connecting to the server via WebSocket
 * Usage: node scripts/test-device-connection.js <uuid>
 */

const WebSocket = require('ws');

const { randomUUID } = require('crypto');

const uuid = process.argv[2] || randomUUID();
const wsUrl = process.env.WS_URL || 'ws://localhost:3000';
const endpoint = `${wsUrl}/ws/${uuid}`;

console.log('🚀 IoT Device Simulator');
console.log('📡 Connecting to:', endpoint);
console.log('🔑 Device UUID:', uuid);
console.log('---');

const ws = new WebSocket(endpoint);

ws.on('open', () => {
  console.log('✅ Connected to server');
  
  // Send initial status
  setTimeout(() => {
    const statusMessage = {
      type: 'status',
      status: 'online',
      timestamp: new Date().toISOString(),
    };
    console.log('📤 Sending status:', statusMessage);
    ws.send(JSON.stringify(statusMessage));
  }, 1000);

  // Send telemetry every 5 seconds
  setInterval(() => {
    const telemetry = {
      type: 'telemetry',
      data: {
        temperature: 20 + Math.random() * 10,
        humidity: 40 + Math.random() * 20,
        pressure: 1000 + Math.random() * 50,
      },
      timestamp: new Date().toISOString(),
    };
    console.log('📤 Sending telemetry:', telemetry.data);
    ws.send(JSON.stringify(telemetry));
  }, 5000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📥 Received message:', message);
    
    // Handle commands
    if (message.type === 'command') {
      console.log('⚡ Processing command:', message.command);
      
      // Simulate command execution
      setTimeout(() => {
        const response = {
          type: 'response',
          commandId: message.commandId,
          status: 'success',
          data: {
            result: 'Command executed successfully',
            command: message.command,
          },
          timestamp: new Date().toISOString(),
        };
        console.log('📤 Sending command response:', response);
        ws.send(JSON.stringify(response));
      }, 1000);
    }
  } catch (error) {
    console.error('❌ Error processing message:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Disconnected from server');
  process.exit(0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  ws.close();
});
