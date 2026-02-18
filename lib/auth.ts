import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Create a new JWT token
 */
export async function createToken(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    const payload = verified.payload;
    
    // Validate that payload has required fields
    if (
      typeof payload.userId === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.role === 'string'
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a new session and store it in database
 */
export async function createSession(userId: string, email: string, role: string) {
  const payload: SessionPayload = { userId, email, role };
  const token = await createToken(payload);
  
  // Store session in database
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
  
  // Set HTTP-only cookie
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
  
  return token;
}

/**
 * Get current session from cookie
 */
export async function getSession(): Promise<SessionPayload | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie) {
    return null;
  }
  
  // Verify token
  const payload = await verifyToken(sessionCookie.value);
  if (!payload) {
    return null;
  }
  
  // Check if session exists in database
  const session = await prisma.session.findUnique({
    where: { token: sessionCookie.value },
  });
  
  if (!session || session.expiresAt < new Date()) {
    // Session expired or doesn't exist
    await destroySession();
    return null;
  }
  
  return payload;
}

/**
 * Destroy current session
 */
export async function destroySession() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (sessionCookie) {
    // Delete from database
    try {
      await prisma.session.delete({
        where: { token: sessionCookie.value },
      });
    } catch {
      // Session might not exist in DB, ignore error
    }
    
    // Remove cookie
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}

/**
 * Create password reset token
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  
  if (!user) {
    return null;
  }
  
  // Generate random token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });
  
  return token;
}

/**
 * Verify password reset token
 */
export async function verifyPasswordResetToken(token: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });
  
  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return null;
  }
  
  return resetToken;
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const resetToken = await verifyPasswordResetToken(token);
  
  if (!resetToken) {
    return false;
  }
  
  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  // Update password
  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { password: hashedPassword },
  });
  
  // Mark token as used
  await prisma.passwordResetToken.update({
    where: { token },
    data: { used: true },
  });
  
  return true;
}

/**
 * Require authentication (for use in API routes)
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  return session;
}

/**
 * Require admin role (for use in API routes)
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth();
  
  if (session.role !== 'admin') {
    throw new Error('Forbidden - Admin access required');
  }
  
  return session;
}
