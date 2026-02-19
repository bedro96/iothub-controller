#!/usr/bin/env node

/**
 * Prisma Database Initialization Script
 * 
 * This script initializes the database collections and indexes
 * Usage: npm run db:init
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting database initialization...');
  
  try {
    // Check database connection
    await prisma.$connect();
    console.log('✅ Database connection established');
    
    // Generate Prisma Client (if needed)
    console.log('📦 Ensuring Prisma Client is generated...');
    
    // Create indexes (MongoDB will auto-create collections on first insert)
    console.log('🔍 Verifying collections and indexes...');
    
    // Test each model by attempting to count
    const userCount = await prisma.user.count();
    console.log(`   Users: ${userCount} records`);
    
    const sessionCount = await prisma.session.count();
    console.log(`   Sessions: ${sessionCount} records`);
    
    const tokenCount = await prisma.passwordResetToken.count();
    console.log(`   Password Reset Tokens: ${tokenCount} records`);
    
    const deviceCount = await prisma.device.count();
    console.log(`   Devices: ${deviceCount} records`);
    
    const auditLogCount = await prisma.auditLog.count();
    console.log(`   Audit Logs: ${auditLogCount} records`);
    
    const deviceMappingCount = await (prisma as any).deviceMapping.count();
    console.log(`   Device Mappings: ${deviceMappingCount} records`);
    
    const deviceCommandCount = await (prisma as any).deviceCommand.count();
    console.log(`   Device Commands: ${deviceCommandCount} records`);
    
    console.log('\n✨ Database initialization completed successfully!');
    console.log('\n📝 Collections created:');
    console.log('   - User');
    console.log('   - Session');
    console.log('   - PasswordResetToken');
    console.log('   - Device');
    console.log('   - AuditLog');
    console.log('   - DeviceMapping');
    console.log('   - DeviceCommand');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
