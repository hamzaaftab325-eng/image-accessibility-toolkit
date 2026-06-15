import ZAI from 'z-ai-web-dev-sdk';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { tmpdir } from 'os';

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
 *
 * On Vercel, we write a temp config to /tmp and temporarily chdir
 * so the SDK finds it via its loadConfig() logic.
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

  // Create a temporary config file in /tmp (writable on Vercel)
  const config = JSON.stringify({
    baseUrl,
    apiKey,
    chatId: process.env.ZAI_CHAT_ID || '',
    userId: process.env.ZAI_USER_ID || '',
    token: process.env.ZAI_TOKEN || '',
  });

  const tmpConfigPath = join(tmpdir(), '.z-ai-config');
  try {
    writeFileSync(tmpConfigPath, config, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to write temp ZAI config: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Temporarily change cwd so the SDK finds the config at process.cwd()/.z-ai-config
  const originalCwd = process.cwd();
  try {
    process.chdir(tmpdir());
    zaiInstance = await ZAI.create();
  } catch (err) {
    // Reset singleton on failure so next attempt can retry
    zaiInstance = null;
    throw new Error(`Failed to initialize ZAI SDK: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    process.chdir(originalCwd);
  }

  return zaiInstance;
}

/**
 * Direct API call helper for Vercel environments.
 * Bypasses the ZAI SDK entirely and calls the VLM API using fetch.
 * Use this as a fallback when the SDK approach fails.
 */
export async function generateAltTextDirect(
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;
  const chatId = process.env.ZAI_CHAT_ID || '';
  const userId = process.env.ZAI_USER_ID || '';
  const token = process.env.ZAI_TOKEN || '';

  if (!baseUrl || !apiKey) {
    throw new Error('Missing ZAI_BASE_URL or ZAI_API_KEY environment variables');
  }

  const url = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-Z-AI-From': 'Z',
  };

  if (chatId) headers['X-Chat-Id'] = chatId;
  if (userId) headers['X-User-Id'] = userId;
  if (token) headers['X-Token'] = token;

  const body = {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new Error('429 Too Many Requests - Rate limited');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`VLM API error: ${response.status} ${response.statusText} ${text}`.slice(0, 300));
  }

  const data = await response.json();
  const altText = data.choices?.[0]?.message?.content;

  if (!altText || typeof altText !== 'string') {
    throw new Error('VLM returned an empty or invalid response');
  }

  return altText.trim();
}

/**
 * Is this running on Vercel?
 */
export function isVercel(): boolean {
  return !!process.env.VERCEL;
}
