"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function MarkResolved({ messageId }: { messageId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleMark() {
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from("message_log")
      .update({ processing_status: "replied" })
      .eq("id", messageId)
    setLoading(false)
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleMark}
      disabled={loading}
    >
      {loading ? "..." : "Resolve"}
    </Button>
  )
}
