import { NextRequest, NextResponse } from 'next/server';
import { getZAI, generateAltTextDirect, isVercel } from '@/lib/zai';

// Vercel Hobby tier default is 10s — no explicit maxDuration needed

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/avif',
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  avif: 'image/avif',
};

const ALT_TEXT_PROMPT =
  "Generate a concise, descriptive alt text for this image that would be suitable for web accessibility. The alt text should describe what's visually present in the image in 1-2 sentences. Be specific about objects, people, actions, and context. Do not start with 'Image of' or 'Picture of'.";

// Retry config for rate limits (keep within 10s Vercel Hobby limit)
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1500;

// ── Types ────────────────────────────────────────────────────────────────────
interface AltTextResult {
  filename: string;
  altText: string;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveMimeType(file: File): string | null {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) {
    return file.type;
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ext in EXTENSION_TO_MIME) {
    return EXTENSION_TO_MIME[ext];
  }
  return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate alt text for a single image with retry logic for rate limits (429).
 * Uses SDK locally, direct fetch on Vercel.
 */
async function generateAltTextWithRetry(
  file: File,
  mimeType: string
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64Image = arrayBufferToBase64(arrayBuffer);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // On Vercel, use direct API call to avoid filesystem issues
      if (isVercel()) {
        const altText = await generateAltTextDirect(
          base64Image,
          mimeType,
          ALT_TEXT_PROMPT
        );
        return altText;
      }

      // Local: use ZAI SDK
      const zai = await getZAI();
      const response = await zai.chat.completions.createVision({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: ALT_TEXT_PROMPT,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      });

      const altText = response.choices[0]?.message?.content;
      if (!altText || typeof altText !== 'string') {
        throw new Error('VLM returned an empty or invalid response');
      }
      return altText.trim();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const is429 =
        lastError.message.includes('429') ||
        lastError.message.toLowerCase().includes('too many requests');

      if (is429 && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(
          `[alt-text] Rate limited on attempt ${attempt + 1}/${MAX_RETRIES} for ${file.name}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Failed after all retries');
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid or malformed FormData' },
      { status: 400 }
    );
  }

  const rawFiles = formData.getAll('images');

  if (rawFiles.length === 0) {
    return NextResponse.json(
      { error: 'No images provided.' },
      { status: 400 }
    );
  }

  // Get valid files
  const files = rawFiles.filter(
    (entry): entry is File => entry instanceof File
  );

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'No valid image files found.' },
      { status: 400 }
    );
  }

  // Process each file (supports both single and batch)
  const results: AltTextResult[] = [];

  for (const file of files) {
    // Validate
    if (file.size === 0) {
      results.push({ filename: file.name, altText: '', error: 'File is empty' });
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      results.push({ filename: file.name, altText: '', error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` });
      continue;
    }

    const mimeType = resolveMimeType(file);
    if (!mimeType) {
      results.push({ filename: file.name, altText: '', error: 'Unsupported file type' });
      continue;
    }

    // Generate alt text with retry
    try {
      const altText = await generateAltTextWithRetry(file, mimeType);
      results.push({ filename: file.name, altText });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error generating alt text';
      console.error(`[alt-text] Failed for ${file.name}:`, message);
      results.push({ filename: file.name, altText: '', error: message });
    }
  }

  return NextResponse.json({ results });
}
