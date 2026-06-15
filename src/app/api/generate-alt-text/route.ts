import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

// ── Config ──────────────────────────────────────────────────────────────────
export const maxDuration = 60; // Allow up to 60s for Vercel Pro; hobby = 10s cap

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_IMAGES = 15;
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB (Vercel body limit is ~4.5MB)
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

async function generateAltText(
  zai: Awaited<ReturnType<typeof getZAI>>,
  file: File,
  mimeType: string
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64Image = arrayBufferToBase64(arrayBuffer);

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

  // Process images in parallel
  const processingResults = await Promise.allSettled(
    validated.map(async ({ file, mimeType }) => {
      const altText = await generateAltText(zai, file, mimeType);
      return { filename: file.name, altText } as AltTextResult;
    })
  );

  const results: AltTextResult[] = [];

  for (const settled of processingResults) {
    if (settled.status === 'fulfilled') {
      results.push(settled.value);
    } else {
      const idx = processingResults.indexOf(settled);
      const failedFile = validated[idx];
      results.push({
        filename: failedFile?.file.name ?? 'unknown',
        altText: '',
        error:
          settled.reason instanceof Error
            ? settled.reason.message
            : 'Unknown error generating alt text',
      });
    }
  }

  for (const ve of validationErrors) {
    results.push({ filename: ve.filename, altText: '', error: ve.error });
  }

  return NextResponse.json({ results });
}
