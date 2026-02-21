import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, renameSync, writeFileSync } from 'fs';
import * as os from 'os';

const ENV_FILE_PATH = path.join(process.cwd(), '.env');

/**
 * Parse a .env file into a key-value record.
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const raw = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes if present
    const value =
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Update or add a key=value pair in .env file content.
 */
function updateEnvContent(content: string, variable: string, value: string): string {
  const lines = content.split('\n');
  let found = false;
  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) return line;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return line;
    const key = trimmed.slice(0, eqIndex).trim();
    if (key === variable) {
      found = true;
      return `${variable}="${value}"`;
    }
    return line;
  });
  if (!found) {
    // Ensure file ends with a newline before appending
    if (updated.length > 0 && updated[updated.length - 1] !== '') {
      updated.push('');
    }
    updated.push(`${variable}="${value}"`);
  }
  return updated.join('\n');
}

/**
 * Validate that a variable name contains only alphanumeric characters and underscores.
 */
function isValidVariableName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const variable = searchParams.get('variable');

    if (!existsSync(ENV_FILE_PATH)) {
      return NextResponse.json({ error: '.env file not found' }, { status: 404 });
    }

    const content = await fs.readFile(ENV_FILE_PATH, 'utf-8');
    const variables = parseEnvFile(content);

    if (variable !== null) {
      if (!isValidVariableName(variable)) {
        return NextResponse.json({ error: 'Invalid variable name' }, { status: 400 });
      }
      if (!(variable in variables)) {
        return NextResponse.json({ error: 'Variable not found' }, { status: 404 });
      }
      return NextResponse.json({ variable, value: variables[variable] });
    }

    return NextResponse.json({ variables });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
      }
    }
    console.error('GET /api/dotenv error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { variable, value } = body as { variable?: string; value?: string };

    if (!variable || value === undefined) {
      return NextResponse.json(
        { error: 'Both variable and value are required' },
        { status: 400 }
      );
    }

    if (!isValidVariableName(variable)) {
      return NextResponse.json({ error: 'Invalid variable name' }, { status: 400 });
    }

    if (!existsSync(ENV_FILE_PATH)) {
      return NextResponse.json({ error: '.env file not found' }, { status: 404 });
    }

    const content = await fs.readFile(ENV_FILE_PATH, 'utf-8');
    const updated = updateEnvContent(content, variable, value);

    // Atomic write: write to a temp file then rename to avoid partial writes
    const tmpPath = path.join(os.tmpdir(), `.env.tmp.${Date.now()}`);
    writeFileSync(tmpPath, updated, 'utf-8');
    renameSync(tmpPath, ENV_FILE_PATH);

    return NextResponse.json({ variable, value });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
      }
    }
    console.error('PUT /api/dotenv error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
