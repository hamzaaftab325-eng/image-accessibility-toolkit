import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_IMAGES = 15;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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

/**
 * Resolve the MIME type for a file, falling back from the browser-provided
 * type to an extension-based lookup.
 */
function resolveMimeType(file: File): string | null {
  // 1. Trust the browser-supplied type if it's in our allow-list
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) {
    return file.type;
  }

  // 2. Fall back to extension-based detection
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ext in EXTENSION_TO_MIME) {
    return EXTENSION_TO_MIME[ext];
  }

  return null;
}

/**
 * Convert an ArrayBuffer to a base64-encoded string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Process in chunks to avoid call-stack overflow on very large files
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Validate a single file and return either a resolved MIME type or an error.
 */
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

/**
 * Generate alt text for a single image using the VLM.
 */
async function generateAltText(
  zai: ZAI,
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
  // ── Parse FormData ───────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid or malformed FormData' },
      { status: 400 }
    );
  }

  // ── Extract image files ──────────────────────────────────────────────────
  const rawFiles = formData.getAll('images');

  if (rawFiles.length === 0) {
    return NextResponse.json(
      { error: 'No images provided. Upload up to 15 images in the "images" field.' },
      { status: 400 }
    );
  }

  // Filter out non-File entries (e.g. strings from form fields)
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

  // ── Validate each file ──────────────────────────────────────────────────
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

  // ── Process valid images in parallel ─────────────────────────────────────
  let zai: ZAI;
  try {
    zai = await ZAI.create();
  } catch {
    return NextResponse.json(
      { error: 'Failed to initialize the vision model service.' },
      { status: 500 }
    );
  }

  const processingResults = await Promise.allSettled(
    validated.map(async ({ file, mimeType }) => {
      const altText = await generateAltText(zai, file, mimeType);
      return { filename: file.name, altText } as AltTextResult;
    })
  );

  // ── Merge results ───────────────────────────────────────────────────────
  const results: AltTextResult[] = [];

  for (const settled of processingResults) {
    if (settled.status === 'fulfilled') {
      results.push(settled.value);
    } else {
      // We lost the filename inside the rejection – scan validated array by index
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

  // Append validation errors so the client knows which files were rejected
  for (const ve of validationErrors) {
    results.push({ filename: ve.filename, altText: '', error: ve.error });
  }

  return NextResponse.json({ results });
}
