"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LogoUpload } from "./LogoUpload"
import type { Tradie } from "@/types/database"

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]

interface ProfileFormProps {
  tradie: Tradie
  abnLocked: boolean
}

export function ProfileForm({ tradie, abnLocked }: ProfileFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    business_name: tradie.business_name,
    abn: tradie.abn,
    licence_number: tradie.licence_number ?? "",
    state: tradie.state ?? "",
    email: tradie.email,
    whatsapp_number: tradie.whatsapp_number,
    logo_path: tradie.logo_path ?? "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)

    const supabase = createClient()
    const updates: Partial<Tradie> = {
      business_name: form.business_name,
      licence_number: form.licence_number || null,
      state: form.state || null,
      email: form.email,
      logo_path: form.logo_path || null,
    }

    if (!abnLocked) {
      updates.abn = form.abn
    }

    await supabase.from("tradies").update(updates).eq("id", tradie.id)

    setLoading(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business details</CardTitle>
          <CardDescription>
            This information appears on your invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              value={form.business_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, business_name: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="abn">ABN</Label>
            <Input
              id="abn"
              value={form.abn}
              onChange={(e) =>
                setForm((f) => ({ ...f, abn: e.target.value }))
              }
              disabled={abnLocked}
              required
            />
            {abnLocked && (
              <p className="text-xs text-muted-foreground">
                ABN cannot be changed after your first invoice
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="licence">Licence number</Label>
            <Input
              id="licence"
              value={form.licence_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, licence_number: e.target.value }))
              }
              placeholder="e.g. QBCC 12345678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Select
              value={form.state}
              onValueChange={(val) => setForm((f) => ({ ...f, state: val ?? "" }))}
            >
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {AU_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <LogoUpload
              currentPath={form.logo_path}
              tradieId={tradie.id}
              onUpload={(path) => setForm((f) => ({ ...f, logo_path: path }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp number</Label>
            <Input
              id="whatsapp"
              value={form.whatsapp_number}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Contact support to change your WhatsApp number
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save changes"}
        </Button>
        {saved && (
          <p className="text-sm text-green-600">Changes saved</p>
        )}
      </div>
    </form>
  )
}
