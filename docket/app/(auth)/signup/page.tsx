"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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

function formatAbn(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  if (digits.length <= 8)
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
}

function validateAbn(abn: string): boolean {
  const digits = abn.replace(/\s/g, "")
  if (digits.length !== 11 || !/^\d+$/.test(digits)) return false
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  const chars = digits.split("").map(Number)
  chars[0] -= 1
  const sum = chars.reduce((acc, d, i) => acc + d * weights[i], 0)
  return sum % 89 === 0
}

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    businessName: "",
    abn: "",
    email: "",
    whatsapp: "",
  })
  const [abnValid, setAbnValid] = useState<boolean | null>(null)

  function handleAbnChange(value: string) {
    const formatted = formatAbn(value)
    setForm((f) => ({ ...f, abn: formatted }))
    const digits = formatted.replace(/\s/g, "")
    if (digits.length === 11) {
      setAbnValid(validateAbn(digits))
    } else {
      setAbnValid(null)
    }
  }

  function formatWhatsappNumber(value: string): string {
    const digits = value.replace(/\D/g, "")
    if (digits.startsWith("0")) {
      return "+61" + digits.slice(1)
    }
    if (digits.startsWith("61")) {
      return "+" + digits
    }
    return value
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!validateAbn(form.abn.replace(/\s/g, ""))) {
      setError("Invalid ABN. Please check and try again.")
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: crypto.randomUUID(),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      const { error: insertError } = await supabase.from("tradies").insert({
        user_id: authData.user.id,
        business_name: form.businessName,
        abn: form.abn.replace(/\s/g, ""),
        email: form.email,
        whatsapp_number: formatWhatsappNumber(form.whatsapp),
        subscription_status: "trialing" as const,
        subscription_tier: "starter" as const,
        trial_ends_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        gst_registered: true,
        weekly_summary_enabled: true,
        reminders_enabled: true,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_onboarding_complete: false,
      })

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
    }

    router.push("/dashboard?onboarding=true")
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Get started with Docket</CardTitle>
          <CardDescription>
            30-day free trial. No credit card needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                placeholder="Dave's Plumbing"
                value={form.businessName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, businessName: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abn">ABN</Label>
              <Input
                id="abn"
                placeholder="12 345 678 901"
                value={form.abn}
                onChange={(e) => handleAbnChange(e.target.value)}
                className={
                  abnValid === false
                    ? "border-destructive"
                    : abnValid === true
                      ? "border-green-500"
                      : ""
                }
                required
              />
              {abnValid === false && (
                <p className="text-xs text-destructive">
                  Invalid ABN — check the number and try again
                </p>
              )}
              {abnValid === true && (
                <p className="text-xs text-green-600">Valid ABN</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="dave@davesplumbing.com.au"
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
                type="tel"
                placeholder="0412 345 678"
                value={form.whatsapp}
                onChange={(e) =>
                  setForm((f) => ({ ...f, whatsapp: e.target.value }))
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                The number you use for WhatsApp
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Start free trial"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
