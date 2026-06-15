'use client'

import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Image as ImageIcon,
  Copy,
  Check,
  Download,
  Loader2,
  FileImage,
  Sparkles,
  RefreshCw,
  X,
  AlertCircle,
  ArrowRight,
  Type,
  Zap,
  Eye,
  FileDown,
  Trash2,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadedFile {
  file: File
  preview: string
  id: string
}

interface AltTextResult {
  filename: string
  altText: string
  error?: string
}

interface ConvertResult {
  filename: string
  convertedFilename: string
  originalSize: number
  convertedSize: number
  data: string
  mimeType: string
}

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/avif',
]

const MAX_FILES = 15
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB (Vercel body limit)

const FORMAT_OPTIONS = [
  { value: 'webp', label: 'WebP', mime: 'image/webp' },
  { value: 'png', label: 'PNG', mime: 'image/png' },
  { value: 'jpeg', label: 'JPEG', mime: 'image/jpeg' },
  { value: 'avif', label: 'AVIF', mime: 'image/avif' },
  { value: 'tiff', label: 'TIFF', mime: 'image/tiff' },
  { value: 'gif', label: 'GIF', mime: 'image/gif' },
  { value: 'bmp', label: 'BMP', mime: 'image/bmp' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toUpperCase() || 'IMG'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

// ─── Drop Zone Component ─────────────────────────────────────────────────────

function DropZone({
  files,
  onFilesSelected,
  onClear,
  disabled,
}: {
  files: UploadedFile[]
  onFilesSelected: (files: FileList) => void
  onClear: () => void
  disabled: boolean
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) setIsDragOver(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (!disabled && e.dataTransfer.files.length > 0) {
        onFilesSelected(e.dataTransfer.files)
      }
    },
    [disabled, onFilesSelected]
  )

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFilesSelected(e.target.files)
        e.target.value = ''
      }
    },
    [onFilesSelected]
  )

  if (files.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 font-medium">
              {files.length} / {MAX_FILES} files
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={disabled}
            className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
          >
            <Trash2 className="size-3" />
            Clear all
          </Button>
        </div>

        <ScrollArea className="max-h-40">
          <div className="flex flex-wrap gap-2">
            {files.map((uf) => (
              <div
                key={uf.id}
                className="relative group rounded-lg overflow-hidden border bg-muted/30 shadow-sm"
              >
                <img
                  src={uf.preview}
                  alt={uf.file.name}
                  className="size-16 object-cover"
                />
                <Badge
                  variant="secondary"
                  className="absolute bottom-0.5 right-0.5 text-[8px] px-1 py-0 h-4 leading-none"
                >
                  {getFileExtension(uf.file.name)}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full border-dashed h-8 text-xs text-muted-foreground"
        >
          + Add more files
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </div>
    )
  }

  return (
    <div>
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        animate={isDragOver ? { scale: 1.02, borderColor: '#10b981' } : { scale: 1, borderColor: '#e5e7eb' }}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 sm:p-10 text-center transition-colors duration-200 ${
          isDragOver
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400'
            : 'bg-muted/20 hover:bg-muted/40 border-muted-foreground/25'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          onChange={handleChange}
          className="hidden"
        />
        <motion.div
          animate={isDragOver ? { y: -5 } : { y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <div className={`size-12 rounded-full flex items-center justify-center transition-colors ${
            isDragOver ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-muted/50'
          }`}>
            <Upload className={`size-5 ${isDragOver ? 'text-emerald-600' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Drag & drop images here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or <span className="text-emerald-600 font-medium underline underline-offset-2">browse files</span>
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF · Up to {MAX_FILES} files · 4MB each
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── Alt Text Result Card (Image Left, Content Right) ────────────────────────

function AltTextCard({ result, preview, index }: { result: AltTextResult; preview?: string; index: number }) {
  const [copied, setCopied] = useState(false)
  const hasError = !!result.error
  const hasAltText = !!result.altText

  const handleCopy = useCallback(async () => {
    if (!hasAltText) return
    try {
      await navigator.clipboard.writeText(result.altText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Copied!', description: 'Alt text copied to clipboard' })
    } catch {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' })
    }
  }, [result.altText, hasAltText])

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <div className={`rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md ${hasError ? 'border-destructive/30' : 'border-border/60'}`}>
        <div className="flex flex-col sm:flex-row">
          {/* Image thumbnail - left side */}
          <div className="shrink-0 sm:w-32 md:w-40 h-28 sm:h-auto bg-muted/30 relative overflow-hidden">
            {preview ? (
              <img
                src={preview}
                alt={result.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {hasError ? (
                  <AlertCircle className="size-8 text-destructive/50" />
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground/30" />
                )}
              </div>
            )}
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-[9px] px-1.5 py-0 h-5 leading-none font-semibold bg-black/60 text-white border-0"
            >
              {getFileExtension(result.filename)}
            </Badge>
          </div>

          {/* Content - right side */}
          <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-semibold truncate text-foreground">{result.filename}</p>
                {hasError && (
                  <Badge variant="destructive" className="text-[9px] shrink-0 px-1.5 h-5">Failed</Badge>
                )}
              </div>
              {hasError ? (
                <p className="text-xs text-destructive/80 leading-relaxed">{result.error}</p>
              ) : hasAltText ? (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{result.altText}</p>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground/50">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="text-xs">Generating...</span>
                </div>
              )}
            </div>
            {hasAltText && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground/50">{result.altText.length} characters</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  {copied ? (
                    <>
                      <Check className="size-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Convert Result Card (Image Left, Stats Right) ──────────────────────────

function ConvertResultCard({ result, preview, index }: { result: ConvertResult; preview?: string; index: number }) {
  const sizeDiff = result.originalSize - result.convertedSize
  const sizeChangePercent = ((sizeDiff / result.originalSize) * 100).toFixed(1)
  const isSmaller = sizeDiff > 0

  const handleDownload = useCallback(() => {
    const byteString = atob(result.data)
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([ab], { type: result.mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.convertedFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'Downloaded!', description: result.convertedFilename })
  }, [result])

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden transition-all duration-200 hover:shadow-md">
        <div className="flex flex-col sm:flex-row">
          {/* Converted image - left */}
          <div className="shrink-0 sm:w-32 md:w-40 h-28 sm:h-auto bg-muted/30 relative overflow-hidden">
            {preview ? (
              <img
                src={preview}
                alt={result.convertedFilename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileImage className="size-8 text-muted-foreground/30" />
              </div>
            )}
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-[9px] px-1.5 py-0 h-5 leading-none font-semibold bg-black/60 text-white border-0"
            >
              {getFileExtension(result.convertedFilename)}
            </Badge>
          </div>

          {/* Stats - right */}
          <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
            <div>
              <p className="text-sm font-semibold truncate text-foreground mb-2">{result.convertedFilename}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{formatFileSize(result.originalSize)}</span>
                <ArrowRight className="size-3 text-muted-foreground/40" />
                <span className="font-medium text-foreground">{formatFileSize(result.convertedSize)}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] h-5 px-1.5 border-0 ${
                    isSmaller
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  }`}
                >
                  {isSmaller ? '' : '+'}{sizeChangePercent}%
                </Badge>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-7 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <FileDown className="size-3" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState('alt-text')
  const [altFiles, setAltFiles] = useState<UploadedFile[]>([])
  const [altLoading, setAltLoading] = useState(false)
  const [altProgress, setAltProgress] = useState(0)
  const [altResults, setAltResults] = useState<AltTextResult[]>([])
  const [convertFiles, setConvertFiles] = useState<UploadedFile[]>([])
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertProgress, setConvertProgress] = useState(0)
  const [convertResults, setConvertResults] = useState<ConvertResult[]>([])
  const [convertFormat, setConvertFormat] = useState('webp')

  // Map filename -> preview for result cards
  const [altPreviews, setAltPreviews] = useState<Record<string, string>>({})
  const [convertPreviews, setConvertPreviews] = useState<Record<string, string>>({})

  const processFiles = useCallback((fileList: FileList, prev: UploadedFile[]): UploadedFile[] => {
    const newFiles: UploadedFile[] = []
    const totalAfter = prev.length + fileList.length

    if (totalAfter > MAX_FILES) {
      toast({
        title: 'Too many files',
        description: `Maximum ${MAX_FILES} files. You tried to add ${fileList.length} to ${prev.length} existing.`,
        variant: 'destructive',
      })
      return prev
    }

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]

      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a supported image format`,
          variant: 'destructive',
        })
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 4MB limit`,
          variant: 'destructive',
        })
        continue
      }

      newFiles.push({
        file,
        preview: URL.createObjectURL(file),
        id: `${Date.now()}-${i}-${file.name}`,
      })
    }

    return [...prev, ...newFiles]
  }, [])

  const handleAltFilesSelected = useCallback(
    (fileList: FileList) => {
      const newFiles = processFiles(fileList, altFiles)
      setAltFiles(newFiles)
      setAltResults([])
      // Build preview map
      const previews: Record<string, string> = {}
      newFiles.forEach((uf) => {
        previews[uf.file.name] = uf.preview
      })
      setAltPreviews(previews)
    },
    [processFiles, altFiles]
  )

  const handleConvertFilesSelected = useCallback(
    (fileList: FileList) => {
      const newFiles = processFiles(fileList, convertFiles)
      setConvertFiles(newFiles)
      setConvertResults([])
      const previews: Record<string, string> = {}
      newFiles.forEach((uf) => {
        previews[uf.file.name] = uf.preview
      })
      setConvertPreviews(previews)
    },
    [processFiles, convertFiles]
  )

  // ── Alt text generation (one image at a time) ──────────────────────────────

  const handleGenerateAltText = useCallback(async () => {
    if (altFiles.length === 0) {
      toast({ title: 'No images', description: 'Please upload at least one image', variant: 'destructive' })
      return
    }

    setAltLoading(true)
    setAltProgress(0)
    setAltResults([])

    const totalFiles = altFiles.length
    const allResults: AltTextResult[] = []

    for (let i = 0; i < altFiles.length; i++) {
      const uf = altFiles[i]
      setAltProgress(Math.round(((i) / totalFiles) * 100))

      try {
        const formData = new FormData()
        formData.append('images', uf.file)

        const response = await fetch('/api/generate-alt-text', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`)
        }

        const data = await response.json()
        const results = data.results || []
        allResults.push(...results)
        setAltResults([...allResults])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate alt text'
        allResults.push({ filename: uf.file.name, altText: '', error: message })
        setAltResults([...allResults])
      }

      if (i < altFiles.length - 1) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    setAltProgress(100)

    const successCount = allResults.filter((r) => r.altText && !r.error).length
    const failCount = allResults.filter((r) => r.error).length

    if (failCount === 0) {
      toast({ title: 'Success!', description: `Generated alt text for all ${successCount} images` })
    } else if (successCount > 0) {
      toast({
        title: 'Partial Success',
        description: `${successCount} succeeded, ${failCount} failed.`,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Error', description: 'All images failed. Please try again.', variant: 'destructive' })
    }

    setAltLoading(false)
  }, [altFiles])

  const handleCopyAll = useCallback(async () => {
    if (altResults.length === 0) return
    const successResults = altResults.filter((r) => r.altText && !r.error)
    if (successResults.length === 0) {
      toast({ title: 'Nothing to copy', description: 'No successful alt texts', variant: 'destructive' })
      return
    }
    const allText = successResults.map((r) => r.altText).join('\n\n')
    try {
      await navigator.clipboard.writeText(allText)
      toast({ title: 'All copied!', description: `${successResults.length} alt texts copied` })
    } catch {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' })
    }
  }, [altResults])

  // ── Format conversion (one image at a time) ────────────────────────────────

  const handleConvertFormat = useCallback(async () => {
    if (convertFiles.length === 0) {
      toast({ title: 'No images', description: 'Please upload at least one image', variant: 'destructive' })
      return
    }

    setConvertLoading(true)
    setConvertProgress(0)
    setConvertResults([])

    const totalFiles = convertFiles.length
    const allResults: ConvertResult[] = []
    const newPreviews: Record<string, string> = {}

    for (let i = 0; i < convertFiles.length; i++) {
      const uf = convertFiles[i]
      setConvertProgress(Math.round(((i) / totalFiles) * 100))

      try {
        const formData = new FormData()
        formData.append('images', uf.file)
        formData.append('format', convertFormat)

        const response = await fetch('/api/convert-format', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`)
        }

        const data = await response.json()
        const results = data.results || []
        allResults.push(...results)

        // Create preview for converted images
        for (const r of results) {
          if (r.data) {
            newPreviews[r.convertedFilename] = `data:${r.mimeType};base64,${r.data}`
          }
        }
        setConvertPreviews((prev) => ({ ...prev, ...newPreviews }))
        setConvertResults([...allResults])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to convert image'
        toast({ title: `Error: ${uf.file.name}`, description: message, variant: 'destructive' })
      }
    }

    setConvertProgress(100)

    if (allResults.length > 0) {
      toast({ title: 'Success!', description: `Converted ${allResults.length} images to ${convertFormat.toUpperCase()}` })
    }

    setConvertLoading(false)
  }, [convertFiles, convertFormat])

  const totalOriginal = convertResults.reduce((s, r) => s + r.originalSize, 0)
  const totalConverted = convertResults.reduce((s, r) => s + r.convertedSize, 0)
  const totalSavings = totalOriginal > 0 ? ((totalOriginal - totalConverted) / totalOriginal * 100).toFixed(1) : '0'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="AltForge" className="size-8 rounded-lg" />
              <div>
                <h1 className="text-base font-bold tracking-tight text-foreground">
                  AltForge
                </h1>
              </div>
            </div>
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px]">
              <Zap className="size-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 md:py-8">

          {/* Tabbed interface */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 h-11 bg-muted/50">
              <TabsTrigger value="alt-text" className="gap-2 text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Eye className="size-4" />
                Alt Text Generator
              </TabsTrigger>
              <TabsTrigger value="converter" className="gap-2 text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <FileDown className="size-4" />
                Format Converter
              </TabsTrigger>
            </TabsList>

            {/* ── Alt Text Generator Tab ─────────────────────────────────────── */}
            <TabsContent value="alt-text" className="space-y-4">
              {/* Upload area */}
              <Card className="border-border/40 shadow-sm">
                <CardContent className="p-5">
                  <DropZone
                    files={altFiles}
                    onFilesSelected={handleAltFilesSelected}
                    onClear={() => { setAltFiles([]); setAltResults([]) }}
                    disabled={altLoading}
                  />
                </CardContent>
              </Card>

              {/* Generate button + progress */}
              {altFiles.length > 0 && altResults.length === 0 && (
                <div className="space-y-3">
                  <Button
                    size="lg"
                    onClick={handleGenerateAltText}
                    disabled={altLoading}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 h-12 text-sm font-medium"
                  >
                    {altLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generating... {altProgress}%
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Generate Alt Text for {altFiles.length} Image{altFiles.length > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                  {altLoading && <Progress value={altProgress} className="h-1.5" />}
                </div>
              )}

              {/* Results */}
              {altResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Results</h3>
                      <Badge variant="secondary" className="text-[10px] h-5">{altResults.length} images</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyAll}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Copy className="size-3" />
                        Copy All
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {altResults.map((result, i) => (
                      <AltTextCard
                        key={result.filename + i}
                        result={result}
                        preview={altPreviews[result.filename]}
                        index={i}
                      />
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => { setAltFiles([]); setAltResults([]) }}
                    className="w-full gap-2 h-10 text-sm"
                  >
                    <RefreshCw className="size-4" />
                    Start Over
                  </Button>
                </div>
              )}

              {/* Still generating more results */}
              {altLoading && altResults.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Processing image {altResults.length + 1}...
                </div>
              )}
            </TabsContent>

            {/* ── Format Converter Tab ───────────────────────────────────────── */}
            <TabsContent value="converter" className="space-y-4">
              {/* Upload area */}
              <Card className="border-border/40 shadow-sm">
                <CardContent className="p-5">
                  <DropZone
                    files={convertFiles}
                    onFilesSelected={handleConvertFilesSelected}
                    onClear={() => { setConvertFiles([]); setConvertResults([]) }}
                    disabled={convertLoading}
                  />
                </CardContent>
              </Card>

              {/* Format selector + Convert button */}
              {convertFiles.length > 0 && convertResults.length === 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Convert to:</span>
                    <Select value={convertFormat} onValueChange={setConvertFormat}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleConvertFormat}
                    disabled={convertLoading}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 h-12 text-sm font-medium"
                  >
                    {convertLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Converting... {convertProgress}%
                      </>
                    ) : (
                      <>
                        <FileDown className="size-4" />
                        Convert {convertFiles.length} Image{convertFiles.length > 1 ? 's' : ''} to {convertFormat.toUpperCase()}
                      </>
                    )}
                  </Button>
                  {convertLoading && <Progress value={convertProgress} className="h-1.5" />}
                </div>
              )}

              {/* Conversion results */}
              {convertResults.length > 0 && (
                <div className="space-y-4">
                  {/* Stats summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-card p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Original</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{formatFileSize(totalOriginal)}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Converted</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatFileSize(totalConverted)}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saved</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{totalSavings}%</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {convertResults.map((result, i) => (
                      <ConvertResultCard
                        key={result.convertedFilename + i}
                        result={result}
                        preview={convertPreviews[result.convertedFilename]}
                        index={i}
                      />
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => { setConvertFiles([]); setConvertResults([]) }}
                    className="w-full gap-2 h-10 text-sm"
                  >
                    <RefreshCw className="size-4" />
                    Start Over
                  </Button>
                </div>
              )}

              {convertLoading && convertResults.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Converting image {convertResults.length + 1}...
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-foreground">AltForge</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              AI-powered image tools · Built with Next.js & shadcn/ui
            </p>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="size-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                Processing happens securely on the server
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
