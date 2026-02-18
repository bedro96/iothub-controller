#!/usr/bin/env node

/**
 * IoT Simulator API Test Script
 * 
 * Tests all the newly created API endpoints
 * Usage: node scripts/test-api-endpoints.js
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const USER_EMAIL = process.env.USER_EMAIL || 'test@example.com';

// Helper function to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': USER_EMAIL,
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 IoT Simulator API Test Suite');
  console.log('🌐 Base URL:', BASE_URL);
  console.log('👤 User Email:', USER_EMAIL);
  console.log('---\n');

  let testsPassed = 0;
  let testsFailed = 0;
  let deviceIds = [];
  let deviceUuids = [];

  // Test 1: Health Check
  try {
    console.log('Test 1: GET /api/health');
    const result = await makeRequest('GET', '/api/health');
    if (result.status === 200 && result.data.status === 'healthy') {
      console.log('✅ Health check passed');
      testsPassed++;
    } else {
      console.log('❌ Health check failed:', result);
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 2: Get Connected Clients (should be empty initially)
  try {
    console.log('Test 2: GET /api/clients');
    const result = await makeRequest('GET', '/api/clients');
    if (result.status === 200 && typeof result.data.total === 'number') {
      console.log(`✅ Clients endpoint working (${result.data.total} clients connected)`);
      testsPassed++;
    } else {
      console.log('❌ Clients endpoint failed:', result);
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Clients endpoint error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 3: Generate Devices
  try {
    console.log('Test 3: POST /api/devices/generate/5');
    const result = await makeRequest('POST', '/api/devices/generate/5');
    if (result.status === 201 && result.data.count === 5) {
      console.log('✅ Device generation passed');
      deviceIds = result.data.devices.map(d => d.id);
      deviceUuids = result.data.devices.map(d => d.uuid).filter(u => u);
      console.log(`   Generated ${deviceIds.length} devices`);
      testsPassed++;
    } else {
      console.log('❌ Device generation failed:', result);
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Device generation error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 4: Get Device Report
  if (deviceIds.length > 0) {
    try {
      console.log(`Test 4: POST /api/devices/report/${deviceIds[0]}`);
      const result = await makeRequest('POST', `/api/devices/report/${deviceIds[0]}`);
      if (result.status === 200 && result.data.deviceId === deviceIds[0]) {
        console.log('✅ Device report passed');
        console.log(`   Device: ${result.data.name} (${result.data.status})`);
        testsPassed++;
      } else {
        console.log('❌ Device report failed:', result);
        testsFailed++;
      }
    } catch (error) {
      console.log('❌ Device report error:', error.message);
      testsFailed++;
    }
    console.log('');
  }

  // Test 5: Broadcast Command
  try {
    console.log('Test 5: POST /api/commands/broadcast');
    const result = await makeRequest('POST', '/api/commands/broadcast', {
      command: 'test_command',
      payload: { test: true },
    });
    if (result.status === 200 && result.data.commandId) {
      console.log('✅ Broadcast command passed');
      console.log(`   Sent to ${result.data.sentCount} devices`);
      testsPassed++;
    } else {
      console.log('❌ Broadcast command failed:', result);
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Broadcast command error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 6: Send Command to Specific Device (will fail if device not connected)
  if (deviceUuids.length > 0) {
    try {
      console.log(`Test 6: POST /api/commands/${deviceUuids[0]}`);
      const result = await makeRequest('POST', `/api/commands/${deviceUuids[0]}`, {
        command: 'specific_command',
        payload: { deviceSpecific: true },
      });
      // This test is expected to fail if device is not connected
      if (result.status === 200) {
        console.log('✅ Specific command sent');
        testsPassed++;
      } else if (result.status === 400 && result.data.error.includes('not connected')) {
        console.log('⚠️  Specific command expected failure (device not connected)');
        testsPassed++;
      } else {
        console.log('❌ Specific command unexpected result:', result);
        testsFailed++;
      }
    } catch (error) {
      console.log('❌ Specific command error:', error.message);
      testsFailed++;
    }
    console.log('');
  }

  // Test 7: Clear Device Mappings
  try {
    console.log('Test 7: POST /api/devices/clear-mappings');
    const result = await makeRequest('POST', '/api/devices/clear-mappings');
    if (result.status === 200) {
      console.log('✅ Clear mappings passed');
      console.log(`   Cleared ${result.data.deletedCount} mappings`);
      testsPassed++;
    } else {
      console.log('❌ Clear mappings failed:', result);
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Clear mappings error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 8: Delete Specific Device
  if (deviceIds.length > 0) {
    try {
      console.log(`Test 8: POST /api/devices/delete/${deviceIds[0]}`);
      const result = await makeRequest('POST', `/api/devices/delete/${deviceIds[0]}`);
      if (result.status === 200) {
        console.log('✅ Device deletion passed');
        testsPassed++;
      } else {
        console.log('❌ Device deletion failed:', result);
        testsFailed++;
      }
    } catch (error) {
      console.log('❌ Device deletion error:', error.message);
      testsFailed++;
    }
    console.log('');
  }

  // Test 9: Delete All Devices
  try {
    console.log('Test 9: POST /api/devices/delete-all');
    const result = await makeRequest('POST', '/api/devices/delete-all');
    if (result.status === 200) {
      console.log('✅ Delete all devices passed');
      console.log(`   Deleted ${result.data.deletedCount} devices`);
      testsPassed++;
    } else {
      console.log('❌ Delete all devices failed:', result);
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Delete all devices error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Summary
  console.log('---');
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📝 Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});
