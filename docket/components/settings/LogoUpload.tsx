"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

interface LogoUploadProps {
  currentPath: string
  tradieId: string
  onUpload: (path: string) => void
}

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ACCEPTED = ["image/png", "image/jpeg"]

export function LogoUpload({
  currentPath,
  tradieId,
  onUpload,
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED.includes(file.type)) {
      setError("Only PNG and JPEG files are allowed")
      return
    }
    if (file.size > MAX_SIZE) {
      setError("File must be under 2MB")
      return
    }

    setError(null)
    setUploading(true)

    const ext = file.name.split(".").pop()
    const path = `${tradieId}/logo.${ext}`

    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    setPreviewUrl(URL.createObjectURL(file))
    onUpload(path)
    setUploading(false)
  }

  const displayUrl = previewUrl ?? (currentPath ? undefined : null)

  return (
    <div className="space-y-3">
      {(displayUrl || currentPath) && (
        <div className="h-16 w-16 overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl ?? ""}
            alt="Business logo"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Uploading..." : "Upload logo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        PNG or JPEG, max 2MB
      </p>
    </div>
  )
}
