"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function PaymentsSetup({ mode }: { mode: "setup" | "complete" }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch("/api/stripe/connect", { method: "POST" })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    }
    setLoading(false)
  }

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading
        ? "Loading..."
        : mode === "setup"
          ? "Set up payments"
          : "Complete setup"}
    </Button>
  )
}
