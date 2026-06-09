import React, { useRef, useState, useEffect } from 'react'
import { X, FileAudio, FileImage } from 'lucide-react'

interface UploadZoneProps {
  accept: string
  acceptLabel: string
  icon: React.ReactNode
  title: string
  subtitle: string
  file: File | null
  onFileChange: (file: File | null) => void
  preview: 'audio' | 'image'
}

export function UploadZone({
  accept,
  acceptLabel,
  icon,
  title,
  subtitle,
  file,
  onFileChange,
  preview
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0])
    }
  }

  const handleZoneClick = () => {
    inputRef.current?.click()
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFileChange(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={handleZoneClick}
      className={`relative border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all duration-300 group
        ${isDragActive 
          ? 'border-primary bg-primary/5 shadow-glow scale-[1.01]' 
          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30 hover:shadow-soft'
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      {file ? (
        <div className="space-y-4 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
          <div className="relative max-w-xs mx-auto rounded-2xl overflow-hidden shadow-elegant border border-border/60 bg-muted/20">
            {preview === 'image' && previewUrl ? (
              <img
                src={previewUrl}
                alt="Upload preview"
                className="w-full h-40 object-cover object-center transition-transform duration-500 hover:scale-105"
              />
            ) : (
              <div className="h-36 flex flex-col items-center justify-center p-4 bg-muted/10 gap-2">
                <FileAudio className="h-10 w-10 text-primary" />
                {previewUrl && (
                  <audio
                    src={previewUrl}
                    controls
                    className="w-full max-w-[240px] h-8 scale-90 accent-primary"
                  />
                )}
              </div>
            )}
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors shadow-lg cursor-pointer"
              title="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-sm text-foreground truncate max-w-md mx-auto">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatSize(file.size)}
            </p>
          </div>

          <button
            onClick={handleZoneClick}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            Change file
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-3 py-4">
          <div className="p-4 rounded-2xl bg-muted text-muted-foreground transition-all duration-300 group-hover:bg-primary/10 group-hover:text-primary group-hover:scale-110">
            {icon}
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-foreground text-sm tracking-tight">{title}</h4>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <span className="inline-block px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase bg-muted/80 text-muted-foreground rounded-full border border-border/50">
            {acceptLabel}
          </span>
        </div>
      )}
    </div>
  )
}
