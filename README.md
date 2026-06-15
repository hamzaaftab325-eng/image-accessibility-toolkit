# AltForge - AI Alt Text & Image Format Converter

> AI-powered image accessibility toolkit. Generate descriptive alt text for web accessibility and convert image formats instantly.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![shadcn/ui](https://img.shields.io/badge/shadcn/ui-New_York-black)

## Features

### AI Alt Text Generator
- Upload up to **15 images** at once (drag & drop or browse)
- AI automatically generates descriptive alt text for **web accessibility & SEO**
- One-click copy for individual or all alt texts
- Supports: PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF

### Image Format Converter
- Convert between **7 formats**: WebP, PNG, JPEG, AVIF, TIFF, GIF, BMP
- Bulk conversion (up to 15 files at once)
- File size comparison with savings percentage
- Download converted images instantly

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **AI**: z-ai-web-dev-sdk (VLM - Vision Language Model)
- **Image Processing**: Sharp
- **Animations**: Framer Motion

## Getting Started

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Open http://localhost:3000
```

## Usage

1. **Generate Alt Text**: Upload images → Click "Generate Alt Text" → Copy results
2. **Convert Formats**: Upload images → Select target format → Click "Convert All" → Download

## Environment

No API keys required! The AI vision model is powered by the built-in `z-ai-web-dev-sdk`.

## License

MIT
