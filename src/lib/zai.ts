import ZAI from 'z-ai-web-dev-sdk';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { homedir } from 'os';

// Singleton instance - cache across requests
let zaiInstance: ZAI | null = null;

/**
 * All possible config file locations (same as SDK's internal logic).
 */
const CONFIG_PATHS = [
  join(process.cwd(), '.z-ai-config'),
  join(homedir(), '.z-ai-config'),
  '/etc/.z-ai-config',
];

/**
 * Check if any local config file exists.
 */
function localConfigExists(): boolean {
  return CONFIG_PATHS.some((p) => existsSync(p));
}

/**
 * Initialize the ZAI SDK, supporting both local (.z-ai-config) and
 * Vercel (environment variables) deployments.
 */
export async function getZAI(): Promise<ZAI> {
  if (zaiInstance) return zaiInstance;

  // Local dev: config file exists somewhere, use default SDK initialization
  if (localConfigExists()) {
    zaiInstance = await ZAI.create();
    return zaiInstance;
  }

  // Vercel/production: use environment variables
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      'Missing ZAI configuration. Set ZAI_BASE_URL and ZAI_API_KEY environment variables on Vercel, or create a .z-ai-config file locally.'
    );
  }

  // Create a temporary config file for the SDK to read
  const config = JSON.stringify({
    baseUrl,
    apiKey,
    chatId: process.env.ZAI_CHAT_ID || '',
    userId: process.env.ZAI_USER_ID || '',
    token: process.env.ZAI_TOKEN || '',
  });

  const tmpConfigPath = join(tmpdir(), '.z-ai-config');
  writeFileSync(tmpConfigPath, config, 'utf-8');

  // Set cwd to tmpdir so the SDK finds the config
  const originalCwd = process.cwd();
  try {
    process.chdir(tmpdir());
    zaiInstance = await ZAI.create();
  } finally {
    process.chdir(originalCwd);
  }

  return zaiInstance;
}
