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
  Images,
  Type,
  Zap,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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
      if (disabled) return
      if (e.dataTransfer.files?.length) {
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
      if (e.target.files?.length) {
        onFilesSelected(e.target.files)
      }
      // Reset input so re-selecting the same file works
      e.target.value = ''
    },
    [onFilesSelected]
  )

  return (
    <div className="space-y-3">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${
            isDragOver
              ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 scale-[1.01]'
              : 'border-muted-foreground/25 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
          }
          p-8 md:p-12 text-center
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />

        <motion.div
          animate={isDragOver ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex flex-col items-center gap-3"
        >
          <div
            className={`rounded-full p-4 transition-colors duration-300 ${
              isDragOver
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Upload className="size-8" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              {isDragOver ? 'Drop images here' : 'Drag & drop images here'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or <span className="text-emerald-600 font-medium underline underline-offset-2">browse files</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground/70">
            PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF · Up to {MAX_FILES} files · 10MB each
          </p>
        </motion.div>
      </div>

      {/* Selected files preview */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                  {files.length} / {MAX_FILES}
                </Badge>
                <span className="text-sm text-muted-foreground">files selected</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onClear()
                }}
                disabled={disabled}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-4 mr-1" />
                Clear all
              </Button>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-2 mt-3 pb-1">
                {files.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative shrink-0 group"
                  >
                    <div className="size-16 rounded-lg overflow-hidden border bg-muted">
                      <img
                        src={f.preview}
                        alt={f.file.name}
                        className="size-full object-cover"
                      />
                    </div>
                    <Badge
                      variant="secondary"
                      className="absolute -top-1.5 -right-1.5 text-[10px] px-1 py-0 h-4 bg-emerald-600 text-white border-0"
                    >
                      {getFileExtension(f.file.name)}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Alt Text Result Card ────────────────────────────────────────────────────

function AltTextCard({ result, index }: { result: AltTextResult; index: number }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result.altText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Copied!', description: 'Alt text copied to clipboard' })
    } catch {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' })
    }
  }, [result.altText])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200 group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 size-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <Type className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate text-foreground">{result.filename}</p>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {getFileExtension(result.filename)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.altText}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="shrink-0 size-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copied ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Convert Result Card ─────────────────────────────────────────────────────

function ConvertResultCard({ result, index }: { result: ConvertResult; index: number }) {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 size-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center overflow-hidden">
              <img
                src={`data:${result.mimeType};base64,${result.data}`}
                alt={result.convertedFilename}
                className="size-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-medium truncate">{result.convertedFilename}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(result.originalSize)}
                </span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {formatFileSize(result.convertedSize)}
                </span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] border-0 ${
                    isSmaller
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  }`}
                >
                  {isSmaller ? '↓' : '↑'} {Math.abs(parseFloat(sizeChangePercent))}%
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="shrink-0 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  // Alt Text state
  const [altFiles, setAltFiles] = useState<UploadedFile[]>([])
  const [altResults, setAltResults] = useState<AltTextResult[]>([])
  const [altLoading, setAltLoading] = useState(false)
  const [altProgress, setAltProgress] = useState(0)

  // Convert state
  const [convertFiles, setConvertFiles] = useState<UploadedFile[]>([])
  const [convertFormat, setConvertFormat] = useState('webp')
  const [convertResults, setConvertResults] = useState<ConvertResult[]>([])
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertProgress, setConvertProgress] = useState(0)

  // ── File selection handler ──────────────────────────────────────────────────

  const processFiles = useCallback(
    (fileList: FileList, currentFiles: UploadedFile[]): UploadedFile[] => {
      const newFiles: UploadedFile[] = []
      const fileArray = Array.from(fileList)

      for (const file of fileArray) {
        // Stop if we'd exceed the max
        if (currentFiles.length + newFiles.length >= MAX_FILES) {
          toast({
            title: 'Maximum files reached',
            description: `You can upload up to ${MAX_FILES} files at once`,
            variant: 'destructive',
          })
          break
        }

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
            description: `${file.name} exceeds the 10MB limit`,
            variant: 'destructive',
          })
          continue
        }

        newFiles.push({
          file,
          preview: URL.createObjectURL(file),
          id: crypto.randomUUID(),
        })
      }

      return [...currentFiles, ...newFiles]
    },
    []
  )

  const handleAltFilesSelected = useCallback(
    (fileList: FileList) => {
      setAltFiles((prev) => processFiles(fileList, prev))
      setAltResults([])
    },
    [processFiles]
  )

  const handleConvertFilesSelected = useCallback(
    (fileList: FileList) => {
      setConvertFiles((prev) => processFiles(fileList, prev))
      setConvertResults([])
    },
    [processFiles]
  )

  // ── Alt text generation ─────────────────────────────────────────────────────

  const handleGenerateAltText = useCallback(async () => {
    if (altFiles.length === 0) {
      toast({ title: 'No images', description: 'Please upload at least one image', variant: 'destructive' })
      return
    }

    setAltLoading(true)
    setAltProgress(0)
    setAltResults([])

    try {
      const formData = new FormData()
      for (const uf of altFiles) {
        formData.append('images', uf.file)
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setAltProgress((prev) => Math.min(prev + Math.random() * 15, 90))
      }, 500)

      const response = await fetch('/api/generate-alt-text', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      setAltResults(data.results || [])
      setAltProgress(100)
      toast({
        title: 'Success!',
        description: `Generated alt text for ${data.results?.length || 0} images`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate alt text'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setAltLoading(false)
    }
  }, [altFiles])

  const handleCopyAll = useCallback(async () => {
    if (altResults.length === 0) return
    const allText = altResults.map((r) => `${r.filename}:\n${r.altText}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(allText)
      toast({ title: 'All copied!', description: `${altResults.length} alt texts copied to clipboard` })
    } catch {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' })
    }
  }, [altResults])

  // ── Format conversion ───────────────────────────────────────────────────────

  const handleConvertFormat = useCallback(async () => {
    if (convertFiles.length === 0) {
      toast({ title: 'No images', description: 'Please upload at least one image', variant: 'destructive' })
      return
    }

    setConvertLoading(true)
    setConvertProgress(0)
    setConvertResults([])

    try {
      const formData = new FormData()
      for (const uf of convertFiles) {
        formData.append('images', uf.file)
      }
      formData.append('format', convertFormat)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setConvertProgress((prev) => Math.min(prev + Math.random() * 15, 90))
      }, 500)

      const response = await fetch('/api/convert-format', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      setConvertResults(data.results || [])
      setConvertProgress(100)
      toast({
        title: 'Success!',
        description: `Converted ${data.results?.length || 0} images to ${convertFormat.toUpperCase()}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to convert images'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setConvertLoading(false)
    }
  }, [convertFiles, convertFormat])

  // ── Total size stats for converter ──────────────────────────────────────────

  const totalOriginal = convertResults.reduce((s, r) => s + r.originalSize, 0)
  const totalConverted = convertResults.reduce((s, r) => s + r.convertedSize, 0)
  const totalSavings = totalOriginal > 0 ? ((totalOriginal - totalConverted) / totalOriginal * 100).toFixed(1) : '0'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  AltForge
                </h1>
                <p className="hidden sm:block text-xs text-muted-foreground -mt-0.5">
                  AI Alt Text & Image Format Converter
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                <Zap className="size-3 mr-1" />
                AI-Powered
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 md:py-10">
          {/* Hero section */}
          <div className="text-center mb-8 md:mb-10">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground"
            >
              Transform your images with{' '}
              <span className="text-emerald-600 dark:text-emerald-400">AI power</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto"
            >
              Generate descriptive alt text for accessibility and SEO, or convert your images
              between formats with instant size optimization.
            </motion.p>
          </div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Tabs defaultValue="alt-text" className="w-full">
              <div className="flex justify-center mb-6">
                <TabsList className="bg-muted/60 p-1 rounded-xl">
                  <TabsTrigger
                    value="alt-text"
                    className="rounded-lg gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm px-4 sm:px-6"
                  >
                    <Type className="size-4" />
                    <span className="hidden sm:inline">Alt Text</span> Generator
                  </TabsTrigger>
                  <TabsTrigger
                    value="converter"
                    className="rounded-lg gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm px-4 sm:px-6"
                  >
                    <FileImage className="size-4" />
                    <span className="hidden sm:inline">Format</span> Converter
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── Alt Text Tab ─────────────────────────────────────────────── */}
              <TabsContent value="alt-text">
                <Card className="border-0 shadow-lg shadow-emerald-500/5">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Images className="size-5 text-emerald-600 dark:text-emerald-400" />
                          AI Alt Text Generator
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Upload images and get AI-generated descriptive alt text for accessibility &amp; SEO
                        </CardDescription>
                      </div>
                      {altResults.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyAll}
                          className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                        >
                          <Copy className="size-3.5" />
                          Copy All
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Drop zone */}
                    <DropZone
                      files={altFiles}
                      onFilesSelected={handleAltFilesSelected}
                      onClear={() => {
                        setAltFiles([])
                        setAltResults([])
                      }}
                      disabled={altLoading}
                    />

                    {/* Generate button */}
                    {altFiles.length > 0 && altResults.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-center"
                      >
                        <Button
                          size="lg"
                          onClick={handleGenerateAltText}
                          disabled={altLoading}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25 min-w-[200px]"
                        >
                          {altLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-4" />
                              Generate Alt Text
                            </>
                          )}
                        </Button>
                      </motion.div>
                    )}

                    {/* Progress */}
                    {altLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Analyzing images with AI...</span>
                          <span>{Math.round(altProgress)}%</span>
                        </div>
                        <Progress value={altProgress} className="h-2 [&>div]:bg-emerald-600" />
                      </motion.div>
                    )}

                    {/* Results */}
                    {altResults.length > 0 && (
                      <div className="space-y-3">
                        <Separator />
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">Results</h3>
                          <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0">
                            {altResults.length} images
                          </Badge>
                        </div>
                        <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                          {altResults.map((result, i) => (
                            <AltTextCard key={result.filename} result={result} index={i} />
                          ))}
                        </div>
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAltFiles([])
                              setAltResults([])
                            }}
                            className="gap-2"
                          >
                            <RefreshCw className="size-4" />
                            Start Over
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Format Converter Tab ─────────────────────────────────────── */}
              <TabsContent value="converter">
                <Card className="border-0 shadow-lg shadow-emerald-500/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileImage className="size-5 text-emerald-600 dark:text-emerald-400" />
                      Image Format Converter
                    </CardTitle>
                    <CardDescription>
                      Convert images between formats and compare file sizes instantly
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Drop zone */}
                    <DropZone
                      files={convertFiles}
                      onFilesSelected={handleConvertFilesSelected}
                      onClear={() => {
                        setConvertFiles([])
                        setConvertResults([])
                      }}
                      disabled={convertLoading}
                    />

                    {/* Format selector + Convert button */}
                    {convertFiles.length > 0 && convertResults.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-3"
                      >
                        <div className="flex items-center gap-2">
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
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25 min-w-[180px]"
                        >
                          {convertLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Converting...
                            </>
                          ) : (
                            <>
                              <FileImage className="size-4" />
                              Convert All
                            </>
                          )}
                        </Button>
                      </motion.div>
                    )}

                    {/* Progress */}
                    {convertLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Converting images to {convertFormat.toUpperCase()}...</span>
                          <span>{Math.round(convertProgress)}%</span>
                        </div>
                        <Progress value={convertProgress} className="h-2 [&>div]:bg-emerald-600" />
                      </motion.div>
                    )}

                    {/* Results */}
                    {convertResults.length > 0 && (
                      <div className="space-y-4">
                        <Separator />

                        {/* Summary stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-muted/50 p-3 text-center">
                            <p className="text-xs text-muted-foreground">Original</p>
                            <p className="text-sm font-semibold text-foreground">{formatFileSize(totalOriginal)}</p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3 text-center">
                            <p className="text-xs text-muted-foreground">Converted</p>
                            <p className="text-sm font-semibold text-foreground">{formatFileSize(totalConverted)}</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">Savings</p>
                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                              {parseFloat(totalSavings) > 0 ? '-' : '+'}{totalSavings}%
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">Converted Files</h3>
                          <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0">
                            {convertResults.length} files
                          </Badge>
                        </div>
                        <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                          {convertResults.map((result, i) => (
                            <ConvertResultCard key={result.convertedFilename} result={result} index={i} />
                          ))}
                        </div>
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setConvertFiles([])
                              setConvertResults([])
                            }}
                            className="gap-2"
                          >
                            <RefreshCw className="size-4" />
                            Start Over
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Info cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 grid sm:grid-cols-2 gap-4"
          >
            <Card className="border-0 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="shrink-0 size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <Type className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Alt Text Generator</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AI-powered descriptions that improve accessibility and search engine optimization for your images.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="shrink-0 size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <FileImage className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Format Converter</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Convert between WebP, PNG, JPEG, AVIF and more. Optimize file sizes while maintaining quality.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-foreground">AltForge</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              AI-powered image tools · Built with Next.js &amp; shadcn/ui
            </p>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="size-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                All processing happens securely on the server
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
