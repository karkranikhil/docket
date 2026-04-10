"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Download, Send, CheckCircle } from "lucide-react"
import type { InvoiceStatus } from "@/types/database"

interface InvoiceActionsProps {
  invoiceId: string
  pdfPath: string | null
  status: InvoiceStatus
}

export function InvoiceActions({
  invoiceId,
  pdfPath,
  status,
}: InvoiceActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleDownloadPdf() {
    if (!pdfPath) return
    setLoading("pdf")
    const supabase = createClient()
    const { data } = await supabase.storage
      .from("invoices")
      .createSignedUrl(pdfPath, 60 * 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank")
    }
    setLoading(null)
  }

  async function handleMarkPaid() {
    setLoading("paid")
    const supabase = createClient()
    await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoiceId)
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-3">
      {pdfPath && (
        <Button
          variant="outline"
          onClick={handleDownloadPdf}
          disabled={loading === "pdf"}
        >
          <Download className="mr-2 h-4 w-4" />
          {loading === "pdf" ? "Loading..." : "Download PDF"}
        </Button>
      )}
      {(status === "sent" || status === "overdue") && (
        <>
          <Button variant="outline" disabled>
            <Send className="mr-2 h-4 w-4" />
            Resend to client
          </Button>
          <Button onClick={handleMarkPaid} disabled={loading === "paid"}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {loading === "paid" ? "Updating..." : "Mark as paid"}
          </Button>
        </>
      )}
    </div>
  )
}
