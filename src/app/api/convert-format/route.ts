import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversionResult {
  filename: string;
  convertedFilename: string;
  originalSize: number;
  convertedSize: number;
  data: string;
  mimeType: string;
}

interface FormatConfig {
  format: keyof sharp.FormatEnum;
  options?: object;
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILES = 15;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const SUPPORTED_FORMATS: Record<string, FormatConfig> = {
  webp: { format: 'webp', options: { quality: 80 }, mimeType: 'image/webp' },
  png: { format: 'png', mimeType: 'image/png' },
  jpeg: { format: 'jpeg', options: { quality: 80 }, mimeType: 'image/jpeg' },
  avif: { format: 'avif', options: { quality: 65 }, mimeType: 'image/avif' },
  tiff: { format: 'tiff', mimeType: 'image/tiff' },
  gif: { format: 'gif', mimeType: 'image/gif' },
  // sharp does not support BMP output – fall back to PNG
  bmp: { format: 'png', mimeType: 'image/png' },
};

const DEFAULT_FORMAT = 'webp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function changeExtension(filename: string, newExt: string): string {
  const lastDot = filename.lastIndexOf('.');
  const baseName = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  return `${baseName}.${newExt}`;
}

async function convertImage(
  file: File,
  targetFormat: string,
): Promise<ConversionResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const originalSize = buffer.length;

  if (originalSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File "${file.name}" exceeds the 10 MB size limit (${(originalSize / 1024 / 1024).toFixed(2)} MB).`,
    );
  }

  const formatConfig = SUPPORTED_FORMATS[targetFormat];

  let sharpInstance = sharp(buffer);

  if (formatConfig.options) {
    sharpInstance = sharpInstance.toFormat(formatConfig.format, formatConfig.options);
  } else {
    sharpInstance = sharpInstance.toFormat(formatConfig.format);
  }

  const convertedBuffer = await sharpInstance.toBuffer();

  const extension = targetFormat === 'bmp' ? 'png' : targetFormat;

  return {
    filename: file.name,
    convertedFilename: changeExtension(file.name, extension),
    originalSize,
    convertedSize: convertedBuffer.length,
    data: convertedBuffer.toString('base64'),
    mimeType: formatConfig.mimeType,
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ---- Parse form data ------------------------------------------------
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid or malformed FormData in request body.' },
        { status: 400 },
      );
    }

    // ---- Validate format -------------------------------------------------
    const formatRaw = formData.get('format');
    const targetFormat = typeof formatRaw === 'string' ? formatRaw.toLowerCase() : DEFAULT_FORMAT;

    if (!(targetFormat in SUPPORTED_FORMATS)) {
      return NextResponse.json(
        {
          error: `Unsupported format "${targetFormat}". Supported formats: ${Object.keys(SUPPORTED_FORMATS).join(', ')}.`,
        },
        { status: 400 },
      );
    }

    // ---- Collect image files ---------------------------------------------
    const imageFiles: File[] = [];

    // FormData.getAll handles multiple files under the same field name
    const allImages = formData.getAll('images');

    for (const entry of allImages) {
      if (entry instanceof File) {
        imageFiles.push(entry);
      }
    }

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: 'No images provided. Upload up to 15 images via the "images" field.' },
        { status: 400 },
      );
    }

    if (imageFiles.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many images. Maximum is ${MAX_FILES}, but ${imageFiles.length} were received.` },
        { status: 400 },
      );
    }

    // ---- Convert in parallel (tolerate individual failures) ---------------
    const settled = await Promise.allSettled(
      imageFiles.map((file) => convertImage(file, targetFormat)),
    );

    const results: ConversionResult[] = [];
    const errors: string[] = [];

    settled.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        const fileName = imageFiles[index]?.name ?? `file-${index}`;
        const reason =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        errors.push(`Failed to convert "${fileName}": ${reason}`);
      }
    });

    // If every image failed, return a 422 so the caller knows nothing succeeded
    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'All images failed to convert.', details: errors },
        { status: 422 },
      );
    }

    return NextResponse.json({
      results,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    });
  } catch (error) {
    // Unexpected / unhandled errors
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';

    console.error('[/api/convert-format] Unhandled error:', error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
