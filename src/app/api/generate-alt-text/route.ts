import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

// ── Config ──────────────────────────────────────────────────────────────────
export const maxDuration = 60;

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_IMAGES = 15;
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

// Retry config for rate limits
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000; // Start with 2s, double each retry

// ── Types ────────────────────────────────────────────────────────────────────
interface AltTextResult {
  filename: string;
  altText: string;
  error?: string;
}

interface ValidationError {
  filename: string;
  error: string;
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

function validateFile(file: File): { mimeType: string } | { error: string } {
  if (file.size === 0) {
    return { error: 'File is empty' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  const mimeType = resolveMimeType(file);
  if (!mimeType) {
    return {
      error: `Unsupported file type. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
    };
  }
  return { mimeType };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate alt text for a single image with retry logic for rate limits (429).
 */
async function generateAltTextWithRetry(
  zai: Awaited<ReturnType<typeof getZAI>>,
  file: File,
  mimeType: string
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64Image = arrayBufferToBase64(arrayBuffer);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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
      { error: 'No images provided. Upload up to 15 images in the "images" field.' },
      { status: 400 }
    );
  }

  const files = rawFiles.filter(
    (entry): entry is File => entry instanceof File
  );

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'No valid image files found in the "images" field.' },
      { status: 400 }
    );
  }

  if (files.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Too many images. Maximum is ${MAX_IMAGES}, received ${files.length}.` },
      { status: 400 }
    );
  }

  // Validate each file
  const validated: { file: File; mimeType: string }[] = [];
  const validationErrors: ValidationError[] = [];

  for (const file of files) {
    const result = validateFile(file);
    if ('error' in result) {
      validationErrors.push({ filename: file.name || 'unknown', error: result.error });
    } else {
      validated.push({ file, mimeType: result.mimeType });
    }
  }

  // Initialize VLM
  let zai: Awaited<ReturnType<typeof getZAI>>;
  try {
    zai = await getZAI();
  } catch (err) {
    console.error('[/api/generate-alt-text] ZAI init failed:', err);
    return NextResponse.json(
      { error: 'Failed to initialize the vision model service. Please check server configuration.' },
      { status: 500 }
    );
  }

  // Process images SEQUENTIALLY to avoid rate limits (429)
  const results: AltTextResult[] = [];

  for (let i = 0; i < validated.length; i++) {
    const { file, mimeType } = validated[i];

    try {
      const altText = await generateAltTextWithRetry(zai, file, mimeType);
      results.push({ filename: file.name, altText });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error generating alt text';
      console.error(`[alt-text] Failed for ${file.name}:`, message);
      results.push({
        filename: file.name,
        altText: '',
        error: message,
      });
    }

    // Add a small delay between images to prevent rate limiting
    if (i < validated.length - 1) {
      await sleep(500);
    }
  }

  // Append validation errors
  for (const ve of validationErrors) {
    results.push({ filename: ve.filename, altText: '', error: ve.error });
  }

  return NextResponse.json({ results });
}
